import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AxiosInstance } from "axios";
import { parseAnytypeLink, resolveAnytypeObject } from "./resolveAnytypeLink";

/**
 * Resolves the bundled instructions string.
 * Returns the esbuild-injected constant in production, or reads the file in dev mode.
 */
function bundledInstructions(): string | undefined {
  try {
    return __BUNDLED_INSTRUCTIONS__;
  } catch {
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      return readFileSync(join(__dirname, "../../instructions.md"), "utf8");
    } catch {
      return undefined;
    }
  }
}

/**
 * Resolves MCP server instructions.
 *
 * Resolution order:
 *   false            → disabled (returns undefined)
 *   anytype://...    → fetch object markdown via Anytype API; falls back to bundled on error
 *   any other string → used as literal instructions content
 *   undefined        → bundled instructions.md
 *
 * @param configured - Parsed value from config.instructions
 * @param axiosInstance - Plain Axios instance for Anytype API calls (required for anytype:// links)
 */
export async function resolveInstructions(
  configured: string | false | undefined,
  axiosInstance?: AxiosInstance,
): Promise<string | undefined> {
  if (configured === false) return undefined;

  if (typeof configured === "string") {
    const link = parseAnytypeLink(configured);
    if (link) {
      if (!axiosInstance) {
        console.error(
          `[resolveInstructions] anytype:// link configured but no axios instance provided; falling back to bundled instructions.`,
        );
        return withFallbackWarning(configured, "no axios instance available");
      }
      try {
        return await resolveAnytypeObject(link.spaceId, link.objectId, axiosInstance);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[resolveInstructions] Failed to load instructions from Anytype (${configured}): ${reason}`);
        return withFallbackWarning(configured, reason);
      }
    }
    // Literal string content
    return configured;
  }

  // undefined → bundled default
  return bundledInstructions();
}

function withFallbackWarning(configured: string, reason: string): string | undefined {
  const warning =
    `> ⚠️ **MCP Instructions could not be loaded** from the configured source:\n` +
    `> \`${configured}\`\n` +
    `> Reason: ${reason}\n` +
    `> Falling back to default instructions. Verify Anytype is running and the link is valid.\n\n`;
  const fallback = bundledInstructions();
  return fallback ? `${warning}${fallback}` : warning;
}
