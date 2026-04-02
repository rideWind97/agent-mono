# MCP Learning Example (TypeScript)

This folder is a standalone MCP learning case, covering:

- Host / Client / Server architecture
- stdio transport
- resources / tools / prompts
- client integration flow

## Files

- `mcp-server.ts`: MCP server with one resource + one tool + one prompt.
- `mcp-client.ts`: MCP client that connects via stdio and invokes all three primitives.
- `package.json`: local dependencies and scripts.
- `tsconfig.json`: TypeScript config for this mini project.

## Install

```bash
cd examples/mcp-learning
pnpm install
```

## Run server only

```bash
pnpm server
```

## Run client demo

```bash
pnpm client
```

## What to learn from this case

1. **Protocol overview**: one standard interface for context/tools.
2. **Architecture**: client talks to server, host uses client.
3. **Transport**: stdio is easiest for local first step.
4. **Primitives**:
   - `resource`: read static context
   - `tool`: execute function with validated args
   - `prompt`: reusable typed prompt template
5. **Server development**: use MCP TypeScript SDK to register capabilities.
6. **Client integration**: connect, discover, call, and consume results.
