import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolved at import time: bundled string in CLI, file read in dev/ts-node.
 */
export function resolveInstructions(configured: string | false | undefined): string | undefined {
  if (configured === false) return undefined;
  if (typeof configured === "string") return configured;
  // undefined → use bundled (injected by esbuild) or fall back to reading the file
  try {
    return __BUNDLED_INSTRUCTIONS__;
  } catch {
    // dev mode: not bundled, read from source tree
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      return readFileSync(join(__dirname, "../../instructions.md"), "utf8");
    } catch {
      return undefined;
    }
  }
}
