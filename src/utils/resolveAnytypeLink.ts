import type { AxiosInstance } from "axios";

export interface AnytypeLinkParams {
  spaceId: string;
  objectId: string;
}

/**
 * Parses an `anytype://object?objectId=<id>&spaceId=<id>` deep link.
 * Returns null if the value is not a valid Anytype object deep link.
 */
export function parseAnytypeLink(value: string): AnytypeLinkParams | null {
  if (!value.startsWith("anytype://object?")) return null;
  try {
    // Use a dummy base so URL can parse the query string.
    const url = new URL(value.replace("anytype://", "https://anytype/"));
    const objectId = url.searchParams.get("objectId")?.trim() ?? "";
    const spaceId = url.searchParams.get("spaceId")?.trim() ?? "";
    if (!objectId || !spaceId) return null;
    return { objectId, spaceId };
  } catch {
    return null;
  }
}

/**
 * Fetches an Anytype object and returns its content as markdown,
 * prefixed with the object name as an H1 heading.
 *
 * Throws on non-2xx responses or network errors — callers are responsible
 * for fallback handling.
 */
export async function resolveAnytypeObject(
  spaceId: string,
  objectId: string,
  axiosInstance: AxiosInstance,
): Promise<string> {
  const response = await axiosInstance.get<{ object: { name?: string; markdown?: string } }>(
    `/v1/spaces/${encodeURIComponent(spaceId)}/objects/${encodeURIComponent(objectId)}`,
  );
  const { name = "", markdown = "" } = response.data?.object ?? {};
  const heading = name ? `# ${name}\n\n` : "";
  return `${heading}${markdown}`;
}
