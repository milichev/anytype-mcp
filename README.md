# Anytype MCP Server

<a href="https://npmjs.org/package/@anyproto/anytype-mcp"><img src="https://img.shields.io/npm/v/@anyproto/anytype-mcp.svg" alt="NPM version" height="20" /></a>
<a href="https://cursor.com/en-US/install-mcp?name=anytype&config=eyJlbnYiOnsiT1BFTkFQSV9NQ1BfSEVBREVSUyI6IntcIkF1dGhvcml6YXRpb25cIjpcIkJlYXJlciA8WU9VUl9BUElfS0VZPlwiLCBcIkFueXR5cGUtVmVyc2lvblwiOlwiMjAyNS0xMS0wOFwifSJ9LCJjb21tYW5kIjoibnB4IC15IEBhbnlwcm90by9hbnl0eXBlLW1jcCJ9"><img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Add anytype MCP server to Cursor" height="20" /></a>
<a href="https://lmstudio.ai/install-mcp?name=anytype&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBhbnlwcm90by9hbnl0eXBlLW1jcCJdLCJlbnYiOnsiT1BFTkFQSV9NQ1BfSEVBREVSUyI6IntcIkF1dGhvcml6YXRpb25cIjpcIkJlYXJlciA8WU9VUl9BUElfS0VZPlwiLCBcIkFueXR5cGUtVmVyc2lvblwiOlwiMjAyNS0xMS0wOFwifSJ9fQ%3D%3D"><img src="https://files.lmstudio.ai/deeplink/mcp-install-light.svg" alt="Add MCP Server anytype to LM Studio" height="20" /></a>

The Anytype MCP Server is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server enabling AI assistants to seamlessly interact with [Anytype's API](https://github.com/anyproto/anytype-api) through natural language.

It bridges the gap between AI and Anytype's powerful features by converting Anytype's OpenAPI specification into MCP tools, allowing you to manage your knowledge base through conversation.

## Features

- Global & Space Search
- Spaces & Members
- Objects & Lists
- Properties & Tags
- Types & Templates

## Quick Start

### 1. Get Your API Key

1. Open Anytype
2. Go to App Settings
3. Navigate to API Keys section
4. Click on `Create new` button

<details>
<summary>Alternative: Get API key via CLI</summary>

You can also get your API key using the command line:

```bash
npx -y @anyproto/anytype-mcp get-key
```

</details>

### 2. Configure Your MCP Client

#### Claude Desktop, Cursor, Windsurf, Raycast, etc.

Add the following configuration to your MCP client settings after replacing `<YOUR_API_KEY>` with your actual API key:

```json
{
  "mcpServers": {
    "anytype": {
      "command": "npx",
      "args": ["-y", "@anyproto/anytype-mcp"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer <YOUR_API_KEY>\", \"Anytype-Version\":\"2025-11-08\"}"
      }
    }
  }
}
```

> **Tip:** After creating an API key in Anytype, you can copy that ready-to-use configuration snippet with your API key already filled in from the API Keys section.

#### Claude Code (CLI)

Run this command to add the Anytype MCP server after replacing `<YOUR_API_KEY>` with your actual API key:

```bash
claude mcp add anytype -e OPENAPI_MCP_HEADERS='{"Authorization":"Bearer <YOUR_API_KEY>", "Anytype-Version":"2025-11-08"}' -s user -- npx -y @anyproto/anytype-mcp
```

<details>
<summary>Alternative: Global Installation</summary>

If you prefer to install the package globally:

1. Install the package:

```bash
npm install -g @anyproto/anytype-mcp
```

2. Update your MCP client configuration to use the global installation:

```json
{
  "mcpServers": {
    "anytype": {
      "command": "anytype-mcp",
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer <YOUR_API_KEY>\", \"Anytype-Version\":\"2025-11-08\"}"
      }
    }
  }
}
```

</details>

## Environment Variables

| Variable                  | Default                         | Description                                                                                                                                                                          |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OPENAPI_MCP_HEADERS`     | —                               | JSON object of headers forwarded to the Anytype API on every request. Required for auth: `{"Authorization":"Bearer <key>", "Anytype-Version":"2025-11-08"}`                          |
| `ANYTYPE_API_BASE_URL`    | `http://127.0.0.1:31009`        | Anytype API base URL. Set to `http://localhost:31012` for `anytype-cli`.                                                                                                             |
| `MCP_TRANSPORT`           | `stdio`                         | Transport mode. Set to `http` to enable the Streamable HTTP server.                                                                                                                  |
| `MCP_HOST`                | `127.0.0.1`                     | Host to bind when `MCP_TRANSPORT=http`.                                                                                                                                              |
| `MCP_PORT`                | `3666`                          | Port to listen on when `MCP_TRANSPORT=http`. Must be in range 1024–65535.                                                                                                            |
| `MCP_PASSTHROUGH_HEADERS` | `authorization,anytype-version` | Comma-separated list of inbound HTTP header names (lowercase) forwarded from the MCP HTTP client to the Anytype API. Extend with caution — arbitrary headers must not be forwarded.  |
| `MCP_INSTRUCTIONS`        | bundled `instructions.md`       | Instructions broadcast to MCP clients on connect. `false` disables; a string overrides with custom content; `{file:/path}` loads content from a file; `anytype://object?objectId=<id>&spaceId=<id>` loads content from an Anytype page. |
| `DISCOVERY_TOOL_CONFIG`   | —                               | JSON config for the `discover-spaces` tool. Accepts inline JSON or `{file:/path/to/config.json}`. Options: `ttlMs` (cache TTL ms, default 300000), `spaces` (per-space/type filter). |



### Custom MCP Instructions

By default the server broadcasts the bundled `instructions.md` to MCP clients on every connection.
You can replace it with your own content via `MCP_INSTRUCTIONS`:

- **Disable:** `MCP_INSTRUCTIONS=false`
- **Inline string:** `MCP_INSTRUCTIONS="Your custom instructions here"`
- **File:** `MCP_INSTRUCTIONS="{file:/path/to/instructions.md}"`
- **Anytype page:** `MCP_INSTRUCTIONS="anytype://object?objectId=<id>&spaceId=<id>"`

The Anytype page option fetches the object's markdown content at startup and uses it as the instructions string.
This lets you maintain your MCP instructions as a regular Anytype page — edit it in the app, restart the server to pick up changes.

To get a page's deep link in Anytype: open the page → three-dot menu → **Copy link**. The link has the form:
```
anytype://object?objectId=bafyrei...&spaceId=bafyrei....31e0h...
```

If the page cannot be fetched (Anytype not running, invalid link, network error), the server logs a warning and falls back to the bundled instructions. The warning is also prepended to the instructions text so the connected AI client is aware.

### discover-spaces Tool

The `discover-spaces` tool returns a complete snapshot of your Anytype workspace — all spaces with their types, properties, tags, and select option IDs — in a single call. AI assistants use it to resolve IDs before creating or updating objects, eliminating the need to chain multiple list calls.

#### Path narrowing

Instead of fetching the full structure every time, you can request a sub-tree using bracket-notation path syntax:
```
discover-spaces(path='spaces["My Space"].tags')
discover-spaces(path='spaces["My Space"].types["Task"].properties["Status"].select')
```

#### Filtering spaces and types

By default all spaces and types are included.
Use `DISCOVERY_TOOL_CONFIG` to limit the scope:
```json
{
  "mcpServers": {
    "anytype": {
      "command": "npx",
      "args": ["-y", "@anyproto/anytype-mcp"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer <YOUR_API_KEY>\", \"Anytype-Version\":\"2025-11-08\"}",
        "DISCOVERY_TOOL_CONFIG": "{\"spaces\":{\"Work\":{\"types\":{\"Task\":{},\"Project\":{}}},\"Personal\":{}}}"
      }
    }
  }
}
```

For non-trivial configs, use a file reference instead of an inline JSON string:
```json
"DISCOVERY_TOOL_CONFIG": "{file:path/to/discovery-config.json}"
```

`discovery-config.json`:
```json
{
  "ttlMs": 300000,
  "spaces": {
    "Work": {
      "types": {
        "Task": {},
        "Project": {}
      }
    },
    "Personal": {}
  }
}
```

#### Cache

Results are cached for 5 minutes by default. Set `ttlMs` in `DISCOVERY_TOOL_CONFIG` to adjust. The AI assistant will call `discover-spaces(force_refresh=true)` automatically after schema-mutating operations (creating or modifying a type, property, tag, or space).

### Custom API Base URL

By default, the server connects to `http://127.0.0.1:31009`. For `anytype-cli` (port `31012`) or other custom base URLs, set `ANYTYPE_API_BASE_URL`:

<details>
<summary>Example Configuration</summary>

**MCP Client (Claude Desktop, Cursor, etc.):**

```json
{
  "mcpServers": {
    "anytype": {
      "command": "npx",
      "args": ["-y", "@anyproto/anytype-mcp"],
      "env": {
        "ANYTYPE_API_BASE_URL": "http://localhost:31012",
        "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer <YOUR_API_KEY>\", \"Anytype-Version\":\"2025-11-08\"}"
      }
    }
  }
}
```

**Claude Code (CLI):**

```bash
claude mcp add anytype \
  -e ANYTYPE_API_BASE_URL='http://localhost:31012' \
  -e OPENAPI_MCP_HEADERS='{"Authorization":"Bearer <YOUR_API_KEY>", "Anytype-Version":"2025-11-08"}' \
  -s user -- npx -y @anyproto/anytype-mcp
```

</details>

## Example Interactions

Here are some examples of how you can interact with your Anytype:

- "Create a new space called 'Project Ideas' with description 'A space for storing project ideas'"
- "Add a new object of type 'Task' with title 'Research AI trends' to the 'Project Ideas' space"
- "Create a second one with title 'Dive deep into LLMs' with due date in 3 days and assign it to me"
- "Now create a collection with the title "Tasks for this week" and add the two tasks to that list. Set due date of the first one to 10 days from now"

## Development

### Installation from Source

1. Clone the repository:

```bash
git clone https://github.com/anyproto/anytype-mcp.git
cd anytype-mcp
```

2. Install dependencies:

```bash
npm install -D
```

3. Build the project:

```bash
npm run build
```

4. Link the package globally (optional):

```bash
npm link
```

### Running in HTTP Transport Mode

Useful for browser-based clients such as [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
MCP_TRANSPORT=http MCP_HOST=127.0.0.1 MCP_PORT=3666 npm run dev
```

Then connect your MCP client to `http://127.0.0.1:3666/mcp`.

Auth is passed through from the MCP client — set `Authorization: Bearer <YOUR_API_KEY>` and `Anytype-Version: 2025-11-08` in your client's request headers. Alternatively, set `OPENAPI_MCP_HEADERS` as with stdio mode.

## Contribution

Thank you for your desire to develop Anytype together!

❤️ This project and everyone involved in it is governed by the [Code of Conduct](https://github.com/anyproto/.github/blob/main/docs/CODE_OF_CONDUCT.md).

🧑‍💻 Check out our [contributing guide](https://github.com/anyproto/.github/blob/main/docs/CONTRIBUTING.md) to learn about asking questions, creating issues, or submitting pull requests.

🫢 For security findings, please email [security@anytype.io](mailto:security@anytype.io) and refer to our [security guide](https://github.com/anyproto/.github/blob/main/docs/SECURITY.md) for more information.

🤝 Follow us on [Github](https://github.com/anyproto) and join the [Contributors Community](https://github.com/orgs/anyproto/discussions).

---

Made by Any — a Swiss association 🇨🇭

Licensed under [MIT](./LICENSE.md).