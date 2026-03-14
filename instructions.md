# Anytype MCP Server — Instructions

You are connected to an Anytype knowledge base. Follow these rules precisely.

## Glossary

- **Space** (aka Channel): container within the Vault holding a graph of objects.
- **Object**: any entity in a Space. Has a *Name* (display) and *Key* (`lower_snake_case` identifier).
- **Object Type**: describes properties and layout. System types: Page, Note, Task, Bookmark, etc. Can be user-defined.
- **Property**: attribute of an Object Type. Intrinsic (read-only) keys: `id`, `links`, `backlinks`.
- **Tag**: classification label applied to page-like objects. Space-scoped — same name ≠ same ID across spaces.
- **Deeplink**: `anytype://object?objectId=<id>&spaceId=<id>`

## Session start — mandatory first step

Call `discover-spaces` (no args) **before any other tool call**.
It returns *Discover Info* — a JSON snapshot of all Spaces, Types, Properties, Tags, and their IDs, keyed by Name.
Cache mentally for the session. With *Discover Info* and a Deeplink you can get or modify any object directly.

### Force-refresh when:
- After creating/modifying a **type, property, tag, or space**.
- After a 404 on an ID-dependent call.

Wipe the old result; cache the new one.

## ID rules

- **Never invent IDs.** Every ID comes from *Discover Info*.
- **Tags are space-scoped.** Always look up from the correct space entry.
- **Property keys** (used in payloads) are at `.key` on each property, e.g. `"stage"`, `"company_name"`.

## Creating and updating objects

Payload shape: `{ key: <property key>, <format>: <value> }`

Resolve `key` and `format` from `spaces["<Space>"].types["<Type>"].properties["<Property>"]` in *Discover Info*.

| Format         | Payload                                            |
| -------------- | -------------------------------------------------- |
| `text`         | `{ key: "company_name", text: "Acme" }`            |
| `url`          | `{ key: "vacancy_url", url: "https://..." }`       |
| `number`       | `{ key: "salary", number: 120000 }`                |
| `date`         | `{ key: "applied_date", date: "2026-03-13" }`      |
| `select`       | `{ key: "stage", select: "<option-id>" }`          |
| `multi_select` | `{ key: "tag", multi_select: ["<id1>", "<id2>"] }` |

Select/multi-select option IDs: `spaces["<Space>"].types["<Type>"].properties["<Property>"].select["<Option>"]`

## Space routing

Route based on space descriptions from *Discover Info*. Ask if ambiguous.

## Mutation tagging — required on every write

Add `mcp-modified` tag after every `create`/`update` on page-like objects.
ID: `spaces["<Space>"].tags["mcp-modified"]` in *Discover Info*.

## Search

Use `API-search-global` when the containing space is unknown.

## Error handling

- `httpStatus: 404` — do not retry with same args.
- Never surface raw JSON errors to the user — summarise and state next action.

## Never

- Call `discover-spaces` more than once per session without a schema mutation or 404.
- Call list-spaces, list-types, list-tags, or list-properties to resolve IDs.
- Create objects without confirming space and type first.
- Perform bulk destructive operations without explicit per-object user confirmation.