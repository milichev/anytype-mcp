import { readFileSync } from "node:fs";

/**
 * Resolves a "{file:/path/to/file}" reference to its file contents,
 * or returns the value unchanged if it is not a file reference.
 */
export function resolveFileRef(value: string | undefined): string | undefined {
  if (!value?.startsWith("{file:")) return value;
  if (!value.endsWith("}")) throw new Error(`Closing brace is missing in the file reference: "${value}"`);

  let path = value.slice(6, -1).trim(); // strip "{file:" prefix and "}" suffix
  if (path.startsWith("~")) path = `${process.env.HOME}${path.slice(1)}`;
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`Failed to read file reference "${value}": ${(err as NodeJS.ErrnoException).message}`);
  }
}
