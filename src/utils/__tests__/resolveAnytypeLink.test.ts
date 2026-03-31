import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAnytypeLink, resolveAnytypeObject } from "../resolveAnytypeLink";

// ---------------------------------------------------------------------------
// parseAnytypeLink
// ---------------------------------------------------------------------------
describe("parseAnytypeLink", () => {
  it("returns parsed params for a valid link", () => {
    const result = parseAnytypeLink(
      "anytype://object?objectId=bafyreiabc&spaceId=bafyreidxyz.31e0h928360j5",
    );
    expect(result).toEqual({
      objectId: "bafyreiabc",
      spaceId: "bafyreidxyz.31e0h928360j5",
    });
  });

  it("trims whitespace from param values", () => {
    const result = parseAnytypeLink(
      "anytype://object?objectId=bafyreiabc%20&spaceId=%20bafyreidxyz",
    );
    expect(result).toEqual({ objectId: "bafyreiabc", spaceId: "bafyreidxyz" });
  });

  it("returns null for wrong scheme", () => {
    expect(parseAnytypeLink("https://object?objectId=abc&spaceId=xyz")).toBeNull();
  });

  it("returns null when objectId is missing", () => {
    expect(parseAnytypeLink("anytype://object?spaceId=xyz")).toBeNull();
  });

  it("returns null when spaceId is missing", () => {
    expect(parseAnytypeLink("anytype://object?objectId=abc")).toBeNull();
  });

  it("returns null for plain string", () => {
    expect(parseAnytypeLink("some instructions text")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAnytypeLink("")).toBeNull();
  });

  it("returns null for anytype:// link to non-object path", () => {
    expect(parseAnytypeLink("anytype://space?spaceId=xyz")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveAnytypeObject
// ---------------------------------------------------------------------------
describe("resolveAnytypeObject", () => {
  let mockAxios: ReturnType<typeof axios.create>;

  beforeEach(() => {
    mockAxios = { get: vi.fn() } as any;
  });

  it("returns heading + markdown on success", async () => {
    vi.mocked(mockAxios.get).mockResolvedValue({
      data: { object: { name: "My Instructions", markdown: "## Rules\n\nDo stuff." } },
    });

    const result = await resolveAnytypeObject("spaceId", "objectId", mockAxios);

    expect(result).toBe("# My Instructions\n\n## Rules\n\nDo stuff.");
    expect(mockAxios.get).toHaveBeenCalledWith("/v1/spaces/spaceId/objects/objectId");
  });

  it("encodes special characters in path segments", async () => {
    vi.mocked(mockAxios.get).mockResolvedValue({
      data: { object: { name: "X", markdown: "" } },
    });

    await resolveAnytypeObject(
      "space/with spaces",
      "object&id",
      mockAxios,
    );

    expect(mockAxios.get).toHaveBeenCalledWith(
      "/v1/spaces/space%2Fwith%20spaces/objects/object%26id",
    );
  });

  it("omits heading when name is empty", async () => {
    vi.mocked(mockAxios.get).mockResolvedValue({
      data: { object: { name: "", markdown: "content" } },
    });

    const result = await resolveAnytypeObject("s", "o", mockAxios);
    expect(result).toBe("content");
  });

  it("returns empty string when both name and markdown are absent", async () => {
    vi.mocked(mockAxios.get).mockResolvedValue({ data: { object: {} } });
    const result = await resolveAnytypeObject("s", "o", mockAxios);
    expect(result).toBe("");
  });

  it("throws on 404", async () => {
    vi.mocked(mockAxios.get).mockRejectedValue(
      Object.assign(new Error("Request failed with status code 404"), { response: { status: 404 } }),
    );
    await expect(resolveAnytypeObject("s", "o", mockAxios)).rejects.toThrow("404");
  });

  it("throws on network error", async () => {
    vi.mocked(mockAxios.get).mockRejectedValue(new Error("connect ECONNREFUSED"));
    await expect(resolveAnytypeObject("s", "o", mockAxios)).rejects.toThrow("ECONNREFUSED");
  });
});
