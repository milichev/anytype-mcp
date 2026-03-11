import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { OpenAPIV3 } from "openapi-types";
import { startHttpTransport } from "./mcp/http-transport";
import { MCPProxy } from "./mcp/proxy";
import { ensureAnytypeRunning } from "./utils/anytype-launcher";
import { DEFAULT_BASE_URL, resolveSpecPath } from "./utils/base-url";
import { getConfig } from "./utils/config";

export class ValidationError extends Error {
  constructor(public errors: any[]) {
    super("OpenAPI validation failed");
    this.name = "ValidationError";
  }
}

export async function loadOpenApiSpec(): Promise<OpenAPIV3.Document> {
  const finalSpec = resolveSpecPath();
  let rawSpec: string | undefined;

  if (finalSpec.startsWith("http://") || finalSpec.startsWith("https://")) {
    const fetchSpec = async () => {
      const response = await axios.get(finalSpec);
      return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    };

    try {
      rawSpec = await fetchSpec();
    } catch (error: any) {
      if (error.code === "ECONNREFUSED") {
        const baseUrl = getConfig().httpClient.baseUrl ?? DEFAULT_BASE_URL;
        const launched = await ensureAnytypeRunning(baseUrl);
        if (launched) {
          try {
            rawSpec = await fetchSpec();
          } catch (retryError: any) {
            console.error(`Anytype started but API is still unreachable at ${baseUrl}:`, retryError.message);
            process.exit(1);
          }
        } else {
          console.error(`Cannot connect to Anytype API at ${baseUrl}. Please ensure the Anytype app is running.`);
          process.exit(1);
        }
      } else {
        console.error(`Failed to fetch OpenAPI specification from ${finalSpec}:`, error.message);
        process.exit(1);
      }
    }
  } else {
    const filePath = path.resolve(process.cwd(), finalSpec);
    try {
      rawSpec = fs.readFileSync(filePath, "utf-8");
    } catch (error: any) {
      console.error(`Failed to read OpenAPI specification file from ${finalSpec}:`, error.message || String(error));
      process.exit(1);
    }
  }

  try {
    return JSON.parse(rawSpec) as OpenAPIV3.Document;
  } catch (error: any) {
    console.error(`Failed to parse OpenAPI specification from ${finalSpec}:`, error.message);
    process.exit(1);
  }
}

export async function initProxy() {
  console.error("Initializing Anytype MCP Server...");
  const openApiSpec = await loadOpenApiSpec();
  const proxy = new MCPProxy("Anytype API", openApiSpec);
  const { transport: transportConfig } = getConfig();
  if (transportConfig.type === "http") {
    const { host, port, passthroughHeaders } = transportConfig;
    await startHttpTransport(proxy, host, port, passthroughHeaders);
  } else {
    await proxy.connect(new StdioServerTransport());
  }
  console.error(`Anytype MCP Server running on ${transportConfig.type}`);
}
