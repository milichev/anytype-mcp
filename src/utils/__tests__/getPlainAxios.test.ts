import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetPlainAxios, getPlainAxios } from "../getPlainAxios";

describe("getPlainAxios", () => {
  beforeEach(() => _resetPlainAxios());
  afterEach(() => _resetPlainAxios());

  it("returns an axios instance", () => {
    const ax = getPlainAxios({ headers: {} });
    expect(ax).toBeDefined();
    expect(typeof ax.get).toBe("function");
  });

  it("returns the same instance on repeated calls", () => {
    const a = getPlainAxios({ headers: {} });
    const b = getPlainAxios({ headers: {} });
    expect(a).toBe(b);
  });

  it("sets baseURL from config", () => {
    const ax = getPlainAxios({ baseUrl: "http://127.0.0.1:9999", headers: {} });
    expect((ax.defaults as any).baseURL).toBe("http://127.0.0.1:9999");
  });

  it("falls back to DEFAULT_BASE_URL when baseUrl is absent", () => {
    const ax = getPlainAxios({ headers: {} });
    expect((ax.defaults as any).baseURL).toBe("http://127.0.0.1:31009");
  });
});
