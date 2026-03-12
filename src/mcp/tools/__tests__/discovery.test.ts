import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscoveryResult } from "../discovery";
import { fetchDiscovery, makeDiscoverSpacesHandler, resolvePath } from "../discovery";

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------

describe("resolvePath", () => {
  const data = {
    spaces: {
      Career: {
        id: "career-id",
        tags: { react: "tag-1", "~test~": "tag-2" },
        types: {
          JobApplication: {
            id: "type-id",
            key: "job_application",
            properties: {
              Stage: {
                id: "prop-id",
                key: "stage",
                format: "select",
                select: { New: "opt-1", Rejected: "opt-2" },
              },
            },
          },
        },
      },
    },
    fetched_at: "2026-01-01T00:00:00.000Z",
  };

  it("returns full data when path is omitted", () => {
    expect(resolvePath(data, "spaces")).toEqual(data.spaces);
  });

  it("resolves dot segment", () => {
    expect(resolvePath(data, "fetched_at")).toBe("2026-01-01T00:00:00.000Z");
  });

  it("resolves bracket notation", () => {
    expect(resolvePath(data, 'spaces["Career"].id')).toBe("career-id");
  });

  it("resolves nested bracket notation", () => {
    expect(resolvePath(data, 'spaces["Career"].tags["~test~"]')).toBe("tag-2");
  });

  it("resolves deep path", () => {
    expect(resolvePath(data, 'spaces["Career"].types["JobApplication"].properties["Stage"].select["New"]')).toBe(
      "opt-1",
    );
  });

  it("returns undefined for missing key", () => {
    expect(resolvePath(data, 'spaces["Attic"].tags')).toBeUndefined();
  });

  it("returns undefined when traversing into a non-object", () => {
    expect(resolvePath(data, "fetched_at.nested")).toBeUndefined();
  });

  it("handles keys with dots in bracket notation", () => {
    const d = { props: { "salary_(initial)": "id-1" } };
    expect(resolvePath(d, 'props["salary_(initial)"]')).toBe("id-1");
  });

  it("handles keys with slashes in bracket notation", () => {
    const d = { props: { "any/type": "id-2" } };
    expect(resolvePath(d, 'props["any/type"]')).toBe("id-2");
  });
});

// ---------------------------------------------------------------------------
// fetchDiscovery (axios mocked)
// ---------------------------------------------------------------------------

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof axios>();
  return {
    ...actual,
    default: {
      ...actual.defaults,
      create: vi.fn(),
    },
  };
});

const mockGet = vi.fn();

function makeSpace(id: string, name: string, description?: string) {
  return { id, name, ...(description ? { description } : {}) };
}

function setupAxiosMock() {
  vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);
}

const FIXTURES = {
  spaces: [makeSpace("space-career", "Career", "Job hunting")],
  properties: [{ id: "prop-tag", key: "tag", format: "multi_select" }],
  tags: [
    { id: "tag-react", name: "react" },
    { id: "tag-mcp", name: "mcp-modified" },
  ],
  types: [
    {
      id: "type-ja",
      key: "job_application",
      name: "JobApplication",
      properties: [
        { id: "prop-stage", key: "stage", name: "Stage", format: "select" },
        { id: "prop-name", key: "company_name", name: "Company Name", format: "text" },
        // skipped
        { id: "prop-tag2", key: "tag", name: "Tag", format: "multi_select" },
        { id: "prop-bl", key: "backlinks", name: "Backlinks", format: "multi_select" },
      ],
    },
  ],
  stageTags: [
    { id: "opt-new", name: "New" },
    { id: "opt-rejected", name: "Rejected" },
  ],
};

function mockGetSequence(...responses: any[]) {
  responses.forEach((r) => {
    mockGet.mockResolvedValueOnce({ data: { data: r } });
  });
}

describe("fetchDiscovery", () => {
  beforeEach(() => {
    setupAxiosMock();
    mockGet.mockReset();
  });

  it("fetches all spaces and resolves tags and types", async () => {
    mockGetSequence(
      FIXTURES.spaces, // GET /v1/spaces
      FIXTURES.properties, // GET /v1/spaces/space-career/properties
      FIXTURES.tags, // GET /v1/spaces/space-career/properties/prop-tag/tags (space tags)
      FIXTURES.types, // GET /v1/spaces/space-career/types
      FIXTURES.stageTags, // GET /v1/spaces/space-career/properties/prop-stage/tags
    );

    const result = await fetchDiscovery({ headers: {} });

    expect(result.spaces["Career"]).toMatchObject({
      id: "space-career",
      description: "Job hunting",
      tags: { react: "tag-react", "mcp-modified": "tag-mcp" },
      types: {
        JobApplication: {
          id: "type-ja",
          key: "job_application",
          properties: {
            Stage: {
              id: "prop-stage",
              key: "stage",
              format: "select",
              select: { New: "opt-new", Rejected: "opt-rejected" },
            },
            "Company Name": { id: "prop-name", key: "company_name", format: "text" },
          },
        },
      },
    });
  });

  it("skips tag and backlinks properties", async () => {
    mockGetSequence(FIXTURES.spaces, FIXTURES.properties, FIXTURES.tags, FIXTURES.types, FIXTURES.stageTags);

    const result = await fetchDiscovery({ headers: {} });
    const props = result.spaces["Career"]!.types["JobApplication"]!.properties;
    expect(props["Tag"]).toBeUndefined();
    expect(props["Backlinks"]).toBeUndefined();
  });

  it("filters spaces by config", async () => {
    mockGetSequence(
      [makeSpace("space-career", "Career"), makeSpace("space-attic", "Attic")],
      FIXTURES.properties,
      FIXTURES.tags,
      FIXTURES.types,
      FIXTURES.stageTags,
    );

    const result = await fetchDiscovery({ headers: {} }, { Career: {} });
    expect(Object.keys(result.spaces)).toEqual(["Career"]);
  });

  it("filters types by config", async () => {
    const allTypes = [...FIXTURES.types, { id: "type-page", key: "page", name: "Page", properties: [] }];

    mockGetSequence(FIXTURES.spaces, FIXTURES.properties, FIXTURES.tags, allTypes, FIXTURES.stageTags);

    const result = await fetchDiscovery({ headers: {} }, { Career: { types: { JobApplication: {} } } });
    const types = result.spaces["Career"]!.types;
    expect(Object.keys(types)).toEqual(["JobApplication"]);
  });

  it("throws if tag property is missing", async () => {
    mockGetSequence(
      FIXTURES.spaces,
      [], // no properties → tag prop not found
    );

    await expect(fetchDiscovery({ headers: {} })).rejects.toThrow("tag property not found");
  });

  it("includes fetched_at timestamp", async () => {
    mockGetSequence(FIXTURES.spaces, FIXTURES.properties, FIXTURES.tags, FIXTURES.types, FIXTURES.stageTags);
    const before = new Date().toISOString();
    const result = await fetchDiscovery({ headers: {} });
    const after = new Date().toISOString();
    expect(result.fetched_at >= before).toBe(true);
    expect(result.fetched_at <= after).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// makeDiscoverSpacesHandler
// ---------------------------------------------------------------------------

const MOCK_RESULT: DiscoveryResult = {
  spaces: { Career: { id: "sid", tags: { react: "tid" }, types: {} } },
  fetched_at: "2026-01-01T00:00:00.000Z",
};

describe("makeDiscoverSpacesHandler", () => {
  beforeEach(() => {
    setupAxiosMock();
    mockGet.mockReset();
  });

  function mockFetch() {
    mockGetSequence(FIXTURES.spaces, FIXTURES.properties, FIXTURES.tags, FIXTURES.types, FIXTURES.stageTags);
  }

  it("returns full result when no path given", async () => {
    mockFetch();
    const handle = makeDiscoverSpacesHandler({ headers: {} });
    const res = await handle({});
    const data = JSON.parse(res.content[0].text);
    expect(data.spaces["Career"]).toBeDefined();
    expect(data.fetched_at).toBeDefined();
  });

  it("returns sub-tree when path given", async () => {
    mockFetch();
    const handle = makeDiscoverSpacesHandler({ headers: {} });
    const res = await handle({ path: 'spaces["Career"].tags' });
    const data = JSON.parse(res.content[0].text);
    expect(data).toEqual({ react: "tag-react", "mcp-modified": "tag-mcp" });
  });

  it("returns error object for invalid path", async () => {
    mockFetch();
    const handle = makeDiscoverSpacesHandler({ headers: {} });
    const res = await handle({ path: 'spaces["NonExistent"]' });
    const data = JSON.parse(res.content[0].text);
    expect(data.error).toMatch(/Path not found/);
  });

  it("caches result — fetches only once across two calls", async () => {
    mockFetch();
    const handle = makeDiscoverSpacesHandler({ headers: {} });
    await handle({});
    await handle({});
    // /v1/spaces is the first GET — should be called exactly once
    expect(mockGet).toHaveBeenCalledTimes(5); // spaces + props + tags + types + stageTags
  });

  it("re-fetches when force_refresh=true", async () => {
    mockFetch();
    mockFetch(); // second fetch
    const handle = makeDiscoverSpacesHandler({ headers: {} });
    await handle({});
    await handle({ force_refresh: true });
    expect(mockGet).toHaveBeenCalledTimes(10);
  });

  it("respects ttlMs from toolConfig", async () => {
    vi.useFakeTimers();
    mockFetch();
    mockFetch();
    const handle = makeDiscoverSpacesHandler({ headers: {} }, { ttlMs: 100 });
    await handle({});
    vi.advanceTimersByTime(101);
    await handle({});
    expect(mockGet).toHaveBeenCalledTimes(10);
    vi.useRealTimers();
  });
});
