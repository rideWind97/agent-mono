# MCP Learning Guide

This guide maps directly to the MCP knowledge points in `LEARNING_PLAN.md`:

- Protocol overview
- Host / Client / Server architecture
- Transport layer (stdio, SSE, Streamable HTTP)
- Resources / Tools / Prompts
- MCP Server development (TypeScript SDK)
- MCP Client integration

## 1) Why MCP

Without MCP, every model provider / agent framework needs custom adapters for:

- tool schema
- tool invocation
- prompt templating
- resource discovery

MCP provides one standard protocol so the "Host + Client + Server" model is reusable.

## 2) Architecture

- **Host**: the application that owns the AI workflow (IDE, desktop app, web app).
- **Client**: protocol adapter in host, talks MCP transport + handles MCP messages.
- **Server**: exposes capabilities (`resources`, `tools`, `prompts`) to clients.

## 3) Transport

- **stdio**: easiest for local development (spawn process, use stdin/stdout).
- **SSE**: good for remote one-way push + request/response.
- **Streamable HTTP**: suitable for web infra and multi-tenant deployment.

This repo's example uses **stdio** first because it is simplest to debug.

## 4) Three MCP primitives

- **Resources**: read-only context sources (documents, config, metadata).
- **Tools**: executable functions (weather, calculator, DB query).
- **Prompts**: reusable prompt templates with typed arguments.

## 5) Hands-on example in this repo

See:

- `examples/mcp-learning/mcp-server.ts`
- `examples/mcp-learning/mcp-client.ts`
- `examples/mcp-learning/README.md`

The server exports:

- Resource: `guide://intro`
- Tool: `get_weather`
- Prompt: `weather_compare_prompt`

The client demonstrates:

- connect to server via stdio
- list and invoke tool
- read resource
- fetch prompt

## 6) Suggested learning order

1. Run server + client as-is.
2. Add a second tool (`get_current_time`) and call both from client.
3. Add retries and timeout around tool invocation.
4. Replace mock weather data with real HTTP API.
5. Switch transport from stdio to SSE/HTTP.

## 7) Security checklist (must-have)

- Validate tool args (zod / json schema)
- Restrict input domain (city whitelist, max length)
- Add timeouts + retry policy
- Avoid passing secrets into prompt/resource content
- Log tool call audit trail
