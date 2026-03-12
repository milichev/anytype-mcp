// ---------------------------------------------------------------------------
// Plain Axios singleton
// NOTE: header injection via interceptors is deferred to the next PR that
// refactors HttpClient.withHeaders() to the same pattern.
// ---------------------------------------------------------------------------

import axios, { type AxiosInstance } from "axios";
import { DEFAULT_BASE_URL } from "./base-url";
import { HttpClientConfig } from "./config";

let _axiosInstance: AxiosInstance | undefined;

/**
 * Returns a plain (non-OpenAPI-aware) Axios instance initialised from the
 * same HttpClientConfig as the main HttpClient. Singleton per process.
 */
export function getPlainAxios(config: HttpClientConfig): AxiosInstance {
  if (!_axiosInstance) {
    _axiosInstance = axios.create({
      baseURL: config.baseUrl ?? DEFAULT_BASE_URL,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "anytype-mcp-server",
        ...config.headers,
      },
    });
  }
  return _axiosInstance;
}

/** Exposed for tests only. */
export function _resetPlainAxios(): void {
  _axiosInstance = undefined;
}
