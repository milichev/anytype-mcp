import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ANYTYPE_APP_PATH = "/Applications/Anytype.app";
/** How long to wait for Anytype to become reachable after launch (ms). */
const LAUNCH_TIMEOUT_MS = 15_000;
/** Poll interval while waiting (ms). */
const POLL_INTERVAL_MS = 500;

/**
 * Returns true when the resolved base URL targets localhost / loopback,
 * making it safe to auto-launch the local Anytype application.
 */
export function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * Attempts to open the Anytype desktop application on macOS.
 * No-op on non-macOS platforms.
 * Resolves immediately after dispatching `open`; does NOT wait for readiness.
 */
export async function launchAnytypeApp(): Promise<void> {
  if (process.platform !== "darwin") return;
  console.error(`[launcher] Starting Anytype app: ${ANYTYPE_APP_PATH}`);
  try {
    await execFileAsync("open", ["-a", ANYTYPE_APP_PATH]);
  } catch (err: any) {
    console.error(`[launcher] Failed to open Anytype app: ${err.message}`);
  }
}

/**
 * Polls `url` until it responds (any HTTP status) or `timeoutMs` is exceeded.
 * Returns true if reachable within the timeout.
 */
export async function waitForUrl(url: string, timeoutMs = LAUNCH_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(POLL_INTERVAL_MS) });
      if (res.status > 0) return true;
    } catch {
      // not yet up
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * If the base URL is local, launches the Anytype app and waits for it to become
 * reachable. Returns true if the app came up within the timeout, false otherwise.
 * Safe to call on non-macOS (no-op, returns false).
 */
export async function ensureAnytypeRunning(baseUrl: string): Promise<boolean> {
  if (!isLocalBaseUrl(baseUrl) || process.platform !== "darwin") return false;
  await launchAnytypeApp();
  const specUrl = `${baseUrl}/docs/openapi.json`;
  console.error(`[launcher] Waiting for Anytype API at ${specUrl}…`);
  const reachable = await waitForUrl(specUrl);
  if (reachable) {
    console.error("[launcher] Anytype API is reachable.");
  } else {
    console.error(`[launcher] Anytype API did not become reachable within ${LAUNCH_TIMEOUT_MS / 1000}s.`);
  }
  return reachable;
}
