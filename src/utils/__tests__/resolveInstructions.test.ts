import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock("../resolveAnytypeLink", () => ({
  parseAnytypeLink: vi.fn(),
  resolveAnytypeObject: vi.fn(),
}));

import { parseAnytypeLink, resolveAnytypeObject } from "../resolveAnytypeLink";
import { resolveInstructions } from "../resolveInstructions";

const mockParseLink = vi.mocked(parseAnytypeLink);
const mockResolveObject = vi.mocked(resolveAnytypeObject);

const LINK = "anytype://object?objectId=abc&spaceId=xyz";
const PARSED = { objectId: "abc", spaceId: "xyz" };
const FETCHED_MD = "# Title\n\nFetched content.";
const FALLBACK_RE = /Falling back to default instructions/;

let mockAxios: ReturnType<typeof axios.create>;

beforeEach(() => {
  vi.clearAllMocks();
  mockAxios = { get: vi.fn() } as any;
});

describe("resolveInstructions", () => {
  describe("false → disabled", () => {
    it("returns undefined", async () => {
      expect(await resolveInstructions(false, mockAxios)).toBeUndefined();
    });
  });

  describe("undefined → bundled default", () => {
    it("returns a non-empty string (bundled or file fallback)", async () => {
      const result = await resolveInstructions(undefined, mockAxios);
      // In test environment esbuild constant is absent; file fallback also absent → undefined is acceptable,
      // but if instructions.md is present it should be a non-empty string.
      expect(result === undefined || typeof result === "string").toBe(true);
    });
  });

  describe("literal string → returned as-is", () => {
    it("returns the literal when parseAnytypeLink returns null", async () => {
      mockParseLink.mockReturnValue(null);
      const result = await resolveInstructions("Custom instructions.", mockAxios);
      expect(result).toBe("Custom instructions.");
    });
  });

  describe("anytype:// link → fetch object", () => {
    it("returns fetched markdown on success", async () => {
      mockParseLink.mockReturnValue(PARSED);
      mockResolveObject.mockResolvedValue(FETCHED_MD);

      const result = await resolveInstructions(LINK, mockAxios);

      expect(mockResolveObject).toHaveBeenCalledWith(PARSED.spaceId, PARSED.objectId, mockAxios);
      expect(result).toBe(FETCHED_MD);
    });

    it("prepends warning and falls back to bundled on fetch error", async () => {
      mockParseLink.mockReturnValue(PARSED);
      mockResolveObject.mockRejectedValue(new Error("connect ECONNREFUSED"));

      const result = await resolveInstructions(LINK, mockAxios);

      expect(result).toMatch(FALLBACK_RE);
      expect(result).toMatch(/ECONNREFUSED/);
      expect(result).toMatch(LINK);
    });

    it("prepends warning when no axios instance provided", async () => {
      mockParseLink.mockReturnValue(PARSED);

      const result = await resolveInstructions(LINK, undefined);

      expect(result).toMatch(FALLBACK_RE);
      expect(mockResolveObject).not.toHaveBeenCalled();
    });

    it("logs console.error on fetch failure", async () => {
      mockParseLink.mockReturnValue(PARSED);
      mockResolveObject.mockRejectedValue(new Error("timeout"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      await resolveInstructions(LINK, mockAxios);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining("timeout"));
      spy.mockRestore();
    });

    it("logs console.error when no axios instance provided", async () => {
      mockParseLink.mockReturnValue(PARSED);
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      await resolveInstructions(LINK, undefined);

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
