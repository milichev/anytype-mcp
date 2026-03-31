import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// isLocalBaseUrl — pure function, no mocking needed
// ---------------------------------------------------------------------------
describe("isLocalBaseUrl", () => {
  // Re-import each time to be safe, though it's a pure function
  async function load() {
    return (await import("../anytype-launcher")).isLocalBaseUrl;
  }

  it.each([
    ["http://127.0.0.1:31009", true],
    ["http://127.0.0.1:31009/some/path", true],
    ["http://localhost:3000", true],
    ["http://localhost", true],
    ["http://192.168.1.1:31009", false],
    ["https://api.example.com", false],
    ["https://anytype.io", false],
    ["not-a-url", false],
    ["", false],
  ])("%s → %s", async (url, expected) => {
    const isLocal = await load();
    expect(isLocal(url)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// launchAnytypeApp
// ---------------------------------------------------------------------------
describe("launchAnytypeApp", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("calls `open -a /Applications/Anytype.app` on macOS", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();

    const mockExecFile = vi.fn((_cmd: string, _args: string[], cb: (...a: any[]) => void) => cb(null, "", ""));
    vi.doMock("node:child_process", () => ({ execFile: mockExecFile }));

    const { launchAnytypeApp } = await import("../anytype-launcher");
    await launchAnytypeApp();

    expect(mockExecFile).toHaveBeenCalledWith("open", ["-a", "/Applications/Anytype.app"], expect.any(Function));
  });

  it("is a no-op on non-macOS", async () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    vi.resetModules();

    const mockExecFile = vi.fn();
    vi.doMock("node:child_process", () => ({ execFile: mockExecFile }));

    const { launchAnytypeApp } = await import("../anytype-launcher");
    await launchAnytypeApp();

    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("logs error but does not throw when `open` fails", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();

    vi.doMock("node:child_process", () => ({
      execFile: vi.fn((_cmd: string, _args: string[], cb: (...a: any[]) => void) =>
        cb(new Error("open: Application not found"), "", ""),
      ),
    }));

    const { launchAnytypeApp } = await import("../anytype-launcher");
    await expect(launchAnytypeApp()).resolves.toBeUndefined();
    // console.error is called with a single interpolated string
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[launcher] Failed to open Anytype app:"));
  });
});

// ---------------------------------------------------------------------------
// waitForUrl
// ---------------------------------------------------------------------------
describe("waitForUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns true immediately when the URL responds on the first poll", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));

    const { waitForUrl } = await import("../anytype-launcher");
    const result = await waitForUrl("http://127.0.0.1:31009/docs/openapi.json", 5_000);
    expect(result).toBe(true);
  });

  it("retries and returns true once reachable", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls++;
        if (calls < 3) return Promise.reject(new Error("ECONNREFUSED"));
        return Promise.resolve({ status: 200 });
      }),
    );

    const { waitForUrl } = await import("../anytype-launcher");
    const promise = waitForUrl("http://127.0.0.1:31009/docs/openapi.json", 10_000);
    // Advance past 2 poll intervals (500 ms each) + some margin
    await vi.advanceTimersByTimeAsync(1_200);
    const result = await promise;

    expect(result).toBe(true);
    expect(calls).toBe(3);
  });

  it("returns false when timeout expires before URL is reachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const { waitForUrl } = await import("../anytype-launcher");
    const promise = waitForUrl("http://127.0.0.1:31009/docs/openapi.json", 1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ensureAnytypeRunning
// ---------------------------------------------------------------------------
describe("ensureAnytypeRunning", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("returns false immediately for a non-local base URL", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    const { ensureAnytypeRunning } = await import("../anytype-launcher");
    expect(await ensureAnytypeRunning("https://api.example.com")).toBe(false);
  });

  it("returns false on non-macOS even for a localhost URL", async () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    const { ensureAnytypeRunning } = await import("../anytype-launcher");
    expect(await ensureAnytypeRunning("http://127.0.0.1:31009")).toBe(false);
  });

  it("launches app, polls the spec URL, and returns true when reachable on macOS", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

    // Stub child_process so open succeeds
    vi.doMock("node:child_process", () => ({
      execFile: vi.fn((_: string, __: string[], cb: (...a: any[]) => void) => cb(null, "", "")),
    }));
    // Stub fetch to succeed immediately
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));

    const { ensureAnytypeRunning } = await import("../anytype-launcher");
    const result = await ensureAnytypeRunning("http://127.0.0.1:31009");

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:31009/docs/openapi.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("launches app but returns false when API stays unreachable", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    vi.useFakeTimers();

    vi.doMock("node:child_process", () => ({
      execFile: vi.fn((_: string, __: string[], cb: (...a: any[]) => void) => cb(null, "", "")),
    }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const { ensureAnytypeRunning } = await import("../anytype-launcher");
    const promise = ensureAnytypeRunning("http://127.0.0.1:31009");
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(result).toBe(false);
    vi.useRealTimers();
  });
});
