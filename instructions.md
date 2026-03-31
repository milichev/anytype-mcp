# Anytype MCP Server — Instructions

You are connected to an Anytype knowledge base via the **Anytype MCP server**.
Follow these rules precisely to avoid data loss or API errors.

## Session start — mandatory first step

Call `discover-spaces` with no arguments **before any other tool call** in a new session.
It returns every space, type, property, tag, and select-option ID you need.
Cache this result mentally for the session — do not call it again unless you have performed a schema-mutating operation (creating or modifying a type, property, tag, or space).

## ID resolution

- **Never invent or guess IDs.** Every object, space, type, property, tag, and select option has an opaque content-addressed ID returned by `discover-spaces`.
- **Tags are space-scoped.** The same tag name in two spaces has two different IDs. Always look up the ID from the correct space entry in the `discover-spaces` result.
- **Select option IDs** are nested under `spaces["<Space>"].types["<Type>"].properties["<Property>"].select["<Option>"]`.
- **Multi-Select option IDs** are nested under `spaces["<Space>"].types["<Type>"].properties["<Property>"].multi_select["<Option>"]`.
- **Property keys** (used in mutation payloads) are at `.key` on each property entry, e.g. `"stage"`, `"company_name"`.

Use bracket-notation `path` to narrow the result and avoid re-fetching:

```
discover-spaces(path='spaces["Career"].tags')
discover-spaces(path='spaces["Career"].types["JobApplication"].properties["Stage"].select')
```

## Creating and updating objects

Property payload shape: `{ key: <property key>, <format>: <value> }`

Examples by format:

| Format         | Payload                                            |
| -------------- | -------------------------------------------------- |
| `text`         | `{ key: "company_name", text: "Acme" }`            |
| `url`          | `{ key: "vacancy_url", url: "https://..." }`       |
| `number`       | `{ key: "salary", number: 120000 }`                |
| `date`         | `{ key: "applied_date", date: "2026-03-13" }`      |
| `select`       | `{ key: "stage", select: "<option-id>" }`          |
| `multi_select` | `{ key: "tag", multi_select: ["<id1>", "<id2>"] }` |

**Tag property** (`key: "tag"`) is valid on every object type. Use `multi_select` with tag IDs from the space's `tags` map.

## Space routing

When the user's intent determines the space, apply the default routing based on a space description.

If the target space is ambiguous, ask before creating.

## Mutation tagging — required on every write

After every `create` or `update` operation, add the space's `mcp-modified` tag to the mutated object.
Look up the ID from `spaces["<Space>"].tags["mcp-modified"]` in the `discover-spaces` result.

## Schema mutation — when to force-refresh

After any operation that creates or modifies a **type, property, tag, or space** (not ordinary objects), call `discover-spaces(force_refresh=true)` before continuing, so subsequent ID lookups reflect the updated schema.
Do **not** call `force_refresh` speculatively — it is a network round-trip for every space.

## Search

`API-search-global` searches across all spaces. Prefer it for discovery when you do not know which space contains an object.

## Error handling

- If an API tool returns `{ "httpStatus": 404, ... }`, the object or resource does not exist — do not retry with the same arguments.
- If an ID-dependent call fails, re-run `discover-spaces` (with `force_refresh=true` if schema may have changed) and re-resolve the ID before retrying.
- Do not surface raw JSON error payloads to the user — summarise the failure and state what you will do next.

## What not to do

- Do not call `discover-spaces` more than once per session unless a schema mutation has occurred or a stale-ID error is encountered.
- Do not call list-spaces, list-types, list-tags, or list-properties to resolve IDs — the `discover-spaces` result already contains everything needed.
- Do not create objects without first confirming the correct space and type.
- Do not perform bulk deletions, bulk moves, or any destructive operation on more than one object at a time without explicit per-object user confirmation.