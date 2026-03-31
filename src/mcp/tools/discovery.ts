import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type AxiosInstance } from "axios";
import type { HttpClientConfig } from "../../utils/config";
import { getPlainAxios } from "../../utils/getPlainAxios";

// ---------------------------------------------------------------------------
// Config (Zod schema lives in discovery.schema.ts)
// ---------------------------------------------------------------------------

export interface SpaceFilterConfig {
  /** If omitted, all types in the space are included. */
  types?: Record<string, Record<string, never>>;
}

export interface DiscoveryToolConfig {
  /** Cache TTL in milliseconds. Default: 5 minutes. */
  ttlMs?: number;
  /**
   * Per-space opt-in filter. If omitted, all spaces and types are included.
   *
   * @example
   * { Career: { types: { JobApplication: {} } }, Attic: {} }
   */
  spaces?: Record<string, SpaceFilterConfig>;
}

const SKIPPED_PROPERTY_KEYS = new Set(["tag", "backlinks", "added_date", "created_date", "creator", "links"]);

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface SelectOptions {
  [optionName: string]: string; // name → tag object ID
}

export interface PropertyMeta {
  id: string;
  key: string;
  format: string;
  /** Populated for format === "select" | "multi_select" */
  select?: SelectOptions;
}

export interface TypeMeta {
  id: string;
  key: string;
  properties: Record<string, PropertyMeta>; // display name → meta
}

export interface SpaceMeta {
  id: string;
  description?: string;
  /** Space-scoped tags: display name → tag object ID */
  tags: Record<string, string>;
  types: Record<string, TypeMeta>; // display name → meta
}

export interface DiscoveryResult {
  spaces: Record<string, SpaceMeta>;
  fetched_at: string;
}

// ---------------------------------------------------------------------------
// Path resolution  (bracket notation: spaces["Career"].tags)
// ---------------------------------------------------------------------------

/**
 * Resolves a bracket-notation path against an object tree.
 *
 * Supported syntax:
 *   spaces["Career"].tags
 *   spaces["Attic"].types["Page"].properties
 *   spaces["Career"].types["JobApplication"].properties["Stage"].select
 *
 * Returns the matched sub-tree, or undefined if the path doesn't exist.
 */
export function resolvePath(data: unknown, path: string): unknown {
  const TOKEN_RE = /\["([^"]+)"\]|([^.[]+)/g;
  const tokens: string[] = [];
  for (const m of path.matchAll(TOKEN_RE)) {
    tokens.push(m[1] ?? m[2]!);
  }
  let current: unknown = data;
  for (const token of tokens) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function get<T>(ax: AxiosInstance, path: string): Promise<T> {
  const res = await ax.get<{ data: T }>(path);
  return res.data.data;
}

async function fetchTags(ax: AxiosInstance, spaceId: string, propertyId: string): Promise<SelectOptions> {
  const items = await get<Array<{ id: string; name: string }>>(
    ax,
    `/v1/spaces/${spaceId}/properties/${propertyId}/tags`,
  );
  return Object.fromEntries(items.map((t) => [t.name, t.id]));
}

async function fetchSpaceMeta(
  ax: AxiosInstance,
  spaceId: string,
  filter: SpaceFilterConfig | undefined,
): Promise<Pick<SpaceMeta, "tags" | "types">> {
  const properties = await get<Array<{ id: string; key: string; format: string }>>(
    ax,
    `/v1/spaces/${spaceId}/properties`,
  );

  const tagProp = properties.find((p) => p.key === "tag");
  if (!tagProp) throw new Error(`Space ${spaceId}: tag property not found`);

  const tags = await fetchTags(ax, spaceId, tagProp.id);

  const allTypes = await get<
    Array<{
      id: string;
      key: string;
      name: string;
      properties: Array<{ id: string; key: string; name: string; format: string }>;
    }>
  >(ax, `/v1/spaces/${spaceId}/types`);

  const includedTypeNames = filter?.types ? new Set(Object.keys(filter.types)) : null;
  const relevantTypes = includedTypeNames ? allTypes.filter((t) => includedTypeNames.has(t.name)) : allTypes;

  const types: Record<string, TypeMeta> = {};

  await Promise.all(
    relevantTypes.map(async (t) => {
      const properties: Record<string, PropertyMeta> = {};

      await Promise.all(
        t.properties
          .filter((p) => !SKIPPED_PROPERTY_KEYS.has(p.key))
          .map(async (p) => {
            const meta: PropertyMeta = { id: p.id, key: p.key, format: p.format };
            if (p.format === "select" || p.format === "multi_select") {
              meta.select = await fetchTags(ax, spaceId, p.id);
            }
            properties[p.name] = meta;
          }),
      );

      types[t.name] = { id: t.id, key: t.key, properties };
    }),
  );

  return { tags, types };
}

export async function fetchDiscovery(
  config: HttpClientConfig,
  filter?: DiscoveryToolConfig["spaces"],
): Promise<DiscoveryResult> {
  const ax = getPlainAxios(config);

  const spaces = await get<Array<{ id: string; name: string; description?: string }>>(ax, "/v1/spaces");

  const includedSpaceNames = filter ? new Set(Object.keys(filter)) : null;
  const relevantSpaces = includedSpaceNames ? spaces.filter((s) => includedSpaceNames.has(s.name)) : spaces;

  const result: DiscoveryResult = { spaces: {}, fetched_at: new Date().toISOString() };

  await Promise.all(
    relevantSpaces.map(async (s) => {
      const spaceFilter = filter?.[s.name];
      const { tags, types } = await fetchSpaceMeta(ax, s.id, spaceFilter);
      result.spaces[s.name] = {
        id: s.id,
        ...(s.description ? { description: s.description } : {}),
        tags,
        types,
      };
    }),
  );

  return result;
}

// ---------------------------------------------------------------------------
// Tool definition + handler factory
// ---------------------------------------------------------------------------

export const DISCOVER_SPACES_TOOL_NAME = "discover-spaces";

export const discoverSpacesTool: Tool = {
  name: DISCOVER_SPACES_TOOL_NAME,
  description: [
    "Returns a JSON description of all Anytype spaces: space IDs, types, properties, tags, and select option IDs.",
    "Call this tool FIRST in any session to resolve IDs before calling create/update/search tools.",
    'Optional bracket-notation path returns only a sub-tree: spaces["Career"].tags',
    "Set force_refresh=true only after a schema-mutating operation (creating/modifying a type, tag, or space).",
  ].join("\n"),
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          'Bracket-notation path into the result, e.g. spaces["Career"].tags or spaces["Attic"].types["Page"]. Omit for full structure.',
      },
      force_refresh: {
        type: "boolean",
        description: "Bypass cache and re-fetch. Use only after schema-mutating operations, not speculatively.",
        default: false,
      },
    },
  },
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    readOnlyHint: true,
    title: DISCOVER_SPACES_TOOL_NAME,
  },
};

export interface DiscoverSpacesParams {
  path?: string;
  force_refresh?: boolean;
}

/**
 * Creates the tool handler closed over its own cache instance.
 * The cache is not exposed — callers interact only via force_refresh.
 */
export function makeDiscoverSpacesHandler(
  config: HttpClientConfig,
  toolConfig?: DiscoveryToolConfig,
): (params: DiscoverSpacesParams) => Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const cache = new DiscoveryCache(toolConfig?.ttlMs);
  const spaceFilter = toolConfig?.spaces;

  return async ({ path, force_refresh = false }) => {
    if (force_refresh) cache.invalidate();

    let data = cache.get();
    if (!data) {
      data = await fetchDiscovery(config, spaceFilter);
      cache.set(data);
    }

    const result = path !== undefined ? resolvePath(data, path) : data;

    if (result === undefined) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Path not found: ${path}` }) }],
      };
    }

    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  };
}

// ---------------------------------------------------------------------------
// Cache — implementation detail, not exported from the module index
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: DiscoveryResult;
  fetchedAt: number;
}

class DiscoveryCache {
  private entry: CacheEntry | undefined;
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  isStale(): boolean {
    return !this.entry || Date.now() - this.entry.fetchedAt > this.ttlMs;
  }

  get(): DiscoveryResult | undefined {
    return this.isStale() ? undefined : this.entry!.data;
  }

  set(data: DiscoveryResult): void {
    this.entry = { data, fetchedAt: Date.now() };
  }

  invalidate(): void {
    this.entry = undefined;
  }
}
