import { URL } from "node:url";
import { z } from "zod";
import { DiscoveryToolConfigSchema } from "../mcp/tools/discovery.schema";

export const ENV_KEYS = [
  "MCP_TRANSPORT",
  "MCP_HOST",
  "MCP_PORT",
  "MCP_PASSTHROUGH_HEADERS",
  "ANYTYPE_API_BASE_URL",
  "OPENAPI_MCP_HEADERS",
  "DISCOVERY_TOOL_CONFIG",
  "MCP_INSTRUCTIONS",
] as const;

export type ConfigEnv = Partial<Record<(typeof ENV_KEYS)[number], string>>;

/**
 * Headers allowed to be forwarded from MCP HTTP requests to the upstream API.
 * Prevents header injection attacks (Host, Content-Length, Transfer-Encoding, etc.).
 */
export const DEFAULT_PASSTHROUGH_HEADERS = ["authorization", "anytype-version"] as const;

/**
 * Parses a JSON string and validates it against the given schema.
 * Produces a Zod error on malformed JSON rather than throwing.
 */
const JsonString = <T extends z.ZodTypeAny>(schema: T, envKey?: string) =>
  z
    .string()
    .transform((val, ctx) => {
      try {
        return JSON.parse(val);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `${envKey ? `${envKey}: Invalid JSON` : "Invalid JSON"}: ${val}`,
        });
        return z.NEVER;
      }
    })
    .pipe(schema);

const TransportConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stdio") }),
  z.object({
    type: z.literal("http"),
    host: z.string().default("127.0.0.1"),
    port: z.coerce.number().int().min(1024).max(65535).default(3666),
    /**
     * Comma-separated list of inbound MCP HTTP transport header names (lowercase) to forward
     * to the upstream API. Defaults to DEFAULT_PASSTHROUGH_HEADERS.
     */
    passthroughHeaders: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((h) => h.trim().toLowerCase())
              .filter(Boolean)
          : [...DEFAULT_PASSTHROUGH_HEADERS],
      ),
  }),
]);

export type TransportConfig = z.infer<typeof TransportConfigSchema>;

const HttpClientConfigSchema = z.object({
  /**
   * Parses ANYTYPE_API_BASE_URL and returns the origin.
   * Falls back to OpenAPI spec servers[0].url, then http://127.0.0.1:31009.
   */
  baseUrl: z
    .url({ protocol: /^https?$/ })
    .transform((v) => new URL(v).origin)
    .optional(),

  /**
   * JSON object of headers forwarded to the upstream API on every request.
   * Parsed from OPENAPI_MCP_HEADERS.
   */
  headers: JsonString(z.record(z.string(), z.string()), "OPENAPI_MCP_HEADERS")
    .optional()
    .catch((ctx) => {
      console.error(ctx.issues.map(({ message }) => message).join("; "));
      return undefined;
    })
    .default({}),
});

export type HttpClientConfig = z.infer<typeof HttpClientConfigSchema>;

const ToolsConfigSchema = z.object({
  /**
   * Configuration for the discover-spaces tool.
   * Parsed from DISCOVERY_TOOL_CONFIG (JSON string).
   */
  discoverSpaces: JsonString(DiscoveryToolConfigSchema, "DISCOVERY_TOOL_CONFIG").optional(),
});

export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

/**
 * Instructions config.
 *
 * Env: MCP_INSTRUCTIONS
 *   unset / "true"  → bundled instructions.md content (injected at build time)
 *   "false"         → disabled; no instructions emitted
 *   any other string → used as literal instructions content
 *
 * Resolved value: string (content) | false (disabled) | undefined (use bundled default)
 */
const InstructionsSchema = z
  .string()
  .transform((v): string | false | undefined => {
    if (v === "false") return false;
    if (v === "true" || v === "") return undefined; // undefined → caller uses bundled
    return v;
  })
  .optional();

/**
 * Anytype MCP server config schema.
 */
const ConfigSchema = z.object({
  /**
   * MCP Server transport.
   * Currently can be either of: stdio (default) and http.
   */
  transport: TransportConfigSchema.default({ type: "stdio" }),

  /**
   * Target/upstream Anytype OpenAPI client config.
   */
  httpClient: HttpClientConfigSchema,

  /**
   * Hand-crafted tool configurations.
   */
  tools: ToolsConfigSchema.optional(),

  /**
   * Instructions broadcast to MCP clients on connect.
   * undefined = use bundled instructions.md; false = disabled; string = custom content.
   */
  instructions: InstructionsSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config | undefined;

export function getConfig() {
  if (!config) {
    config = ConfigSchema.parse({
      transport:
        process.env.MCP_TRANSPORT === "http"
          ? {
              type: "http",
              host: process.env.MCP_HOST,
              port: process.env.MCP_PORT,
              passthroughHeaders: process.env.MCP_PASSTHROUGH_HEADERS,
            }
          : { type: "stdio" },
      httpClient: {
        baseUrl: process.env.ANYTYPE_API_BASE_URL,
        headers: process.env.OPENAPI_MCP_HEADERS,
      },
      tools: process.env.DISCOVERY_TOOL_CONFIG ? { discoverSpaces: process.env.DISCOVERY_TOOL_CONFIG } : undefined,
      instructions: process.env.MCP_INSTRUCTIONS,
    });
  }

  return config;
}
