## proxy.ts diff

### imports — add
```ts
import {
  discoverSpacesTool,
  DISCOVER_SPACES_TOOL_NAME,
  makeDiscoverSpacesHandler,
  type DiscoverSpacesParams,
} from "./tools/discovery";
```

### class fields — add
```ts
private discoverSpaces: (params: DiscoverSpacesParams) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
```

### constructor — after httpClient init
```ts
this.discoverSpaces = makeDiscoverSpacesHandler(
  getConfig().httpClient,
  getConfig().tools?.discoverSpaces,
);
```

### setupHandlers / ListToolsRequestSchema — prepend hand-crafted tool
```ts
tools.unshift(discoverSpacesTool);
```

### setupHandlers / CallToolRequestSchema — before findOperation()
```ts
if (name === DISCOVER_SPACES_TOOL_NAME) {
  return this.discoverSpaces(params as DiscoverSpacesParams);
}
```

### clone() — after instance.openApiLookup = ...
```ts
instance.discoverSpaces = this.discoverSpaces; // shared — handler closes over its own cache
```
