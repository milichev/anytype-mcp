import { z } from "zod";

const SpaceFilterConfigSchema = z.object({
  types: z.record(z.string(), z.object({})).optional(),
});

const DISCOVERY_CONFIG_KNOWN_KEYS = new Set(["ttlMs", "spaces"]);
const DISCOVERY_CONFIG_EXPECTED_SHAPE = `{ "spaces": { "<SpaceName>": { "types": { "<TypeName>": {} } } }, "ttlMs": <ms> }`;

export const DiscoveryToolConfigSchema = z
  .object({
    ttlMs: z.number().int().positive().optional(),
    spaces: z.record(z.string(), SpaceFilterConfigSchema).optional(),
  })
  .loose()
  .superRefine((val, ctx) => {
    const unknown = Object.keys(val).filter((k) => !DISCOVERY_CONFIG_KNOWN_KEYS.has(k));
    if (unknown.length) {
      ctx.addIssue({
        code: "custom",
        message:
          `DISCOVERY_TOOL_CONFIG: unrecognized key(s) ${unknown.map((k) => `"${k}"`).join(", ")}. ` +
          `Expected shape: ${DISCOVERY_CONFIG_EXPECTED_SHAPE}`,
      });
    }
  })
  .transform(({ ttlMs, spaces }) => ({ ttlMs, spaces })); // strip unknown keys after validation

export type DiscoveryToolConfigInput = z.input<typeof DiscoveryToolConfigSchema>;
