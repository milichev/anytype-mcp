import { z } from "zod";

const SpaceFilterConfigSchema = z.object({
  types: z.record(z.string(), z.object({})).optional(),
});

export const DiscoveryToolConfigSchema = z.object({
  ttlMs: z.number().int().positive().optional(),
  spaces: z.record(z.string(), SpaceFilterConfigSchema).optional(),
});

export type DiscoveryToolConfigInput = z.input<typeof DiscoveryToolConfigSchema>;
