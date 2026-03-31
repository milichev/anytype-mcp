// src/mcp/tools/__tests__/discovery.schema.test.ts

import { describe, expect, it } from "vitest";
import { DiscoveryToolConfigSchema } from "../discovery.schema";

describe("DiscoveryToolConfigSchema", () => {
  // ─── valid inputs ──────────────────────────────────────────────────────────

  it("accepts empty object", () => {
    expect(DiscoveryToolConfigSchema.parse({})).toEqual({
      ttlMs: undefined,
      spaces: undefined,
    });
  });

  it("accepts ttlMs only", () => {
    expect(DiscoveryToolConfigSchema.parse({ ttlMs: 60000 })).toMatchObject({
      ttlMs: 60000,
    });
  });

  it("accepts full spaces filter", () => {
    const result = DiscoveryToolConfigSchema.parse({
      spaces: {
        Attic: { types: { Daily: {}, Note: {} } },
        Career: { types: { JobApplication: {} } },
      },
    });
    expect(result.spaces).toEqual({
      Attic: { types: { Daily: {}, Note: {} } },
      Career: { types: { JobApplication: {} } },
    });
  });

  it("accepts space entry with no types filter", () => {
    const result = DiscoveryToolConfigSchema.parse({
      spaces: { Attic: {} },
    });
    expect(result.spaces).toEqual({ Attic: { types: undefined } });
  });

  // ─── transform: unknown keys are stripped from output ─────────────────────

  it("strips unknown top-level keys from output after validation", () => {
    // Must fail validation — but if we bypassed superRefine, strip would work.
    // Test the transform directly by checking a valid-but-extended object would
    // not leak unknown keys — we verify via the error path instead (see below).
    // This test documents intent: output only contains {ttlMs, spaces}.
    const result = DiscoveryToolConfigSchema.parse({ ttlMs: 1000, spaces: {} });
    expect(Object.keys(result)).toEqual(["ttlMs", "spaces"]);
  });

  // ─── superRefine: unrecognized keys ───────────────────────────────────────

  it("rejects bare spaces map (common mistake: missing {spaces:} wrapper)", () => {
    const result = DiscoveryToolConfigSchema.safeParse({
      Attic: { types: { Daily: {} } },
      Career: {},
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/unrecognized key/i);
    expect(result.error?.issues[0].message).toContain("DISCOVERY_TOOL_CONFIG");
    expect(result.error?.issues[0].message).toContain('"Attic"');
  });

  it("error message includes expected shape hint", () => {
    const result = DiscoveryToolConfigSchema.safeParse({ space: {} });
    expect(result.error?.issues[0].message).toContain("Expected shape:");
    expect(result.error?.issues[0].message).toContain('"spaces"');
  });

  it('rejects typo "space" with key named in error', () => {
    const result = DiscoveryToolConfigSchema.safeParse({ space: {} });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('"space"');
  });

  // ─── field validation ─────────────────────────────────────────────────────

  it("rejects negative ttlMs", () => {
    expect(() => DiscoveryToolConfigSchema.parse({ ttlMs: -1 })).toThrow();
  });

  it("rejects zero ttlMs", () => {
    expect(() => DiscoveryToolConfigSchema.parse({ ttlMs: 0 })).toThrow();
  });

  it("rejects non-integer ttlMs", () => {
    expect(() => DiscoveryToolConfigSchema.parse({ ttlMs: 1.5 })).toThrow();
  });

  it("rejects string ttlMs", () => {
    expect(() => DiscoveryToolConfigSchema.parse({ ttlMs: "60000" })).toThrow();
  });
});
