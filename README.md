# @spranab/discord-mcp

[![npm](https://img.shields.io/npm/v/@spranab/discord-mcp)](https://www.npmjs.com/package/@spranab/discord-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@spranab/discord-mcp)](https://www.npmjs.com/package/@spranab/discord-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Moderating a Discord server means clicking: open the server, find the channel,
scroll for the message, open the member list, apply the timeout, write the
note somewhere. Every Discord MCP server that exposes one tool per operation
also costs you thousands of tokens of context before the model reads your
question.

This one gives an AI assistant the whole server — 30+ actions across messages,
channels, roles, members, moderation, threads, webhooks, invites, emojis and
the audit log — behind a **single `discord` tool** with three-level discovery,
so the model pays for the actions it uses and nothing else.

## Install (60 seconds)

Claude Code — add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@spranab/discord-mcp"],
      "env": { "bot_token": "YOUR_BOT_TOKEN" }
    }
  }
}
```

Need a bot token? See [Discord Bot Setup](#discord-bot-setup) below — about
two minutes in the Developer Portal.

## What it looks like

**You:** "Someone's spamming #general. Clear the last 20 messages there, time
that user out for an hour, and log it for the mods."

```
→ discord(category: "messages", action: "bulk_delete",
          params: { channel_id: "9876...", count: 20 })
→ discord(category: "moderation", action: "timeout",
          params: { guild_id: "1234...", user_id: "5555...",
                    duration_minutes: 60, reason: "Spam in #general" })
→ discord(category: "messages", action: "send",
          params: { channel_id: "4321...",
                    content: "Timed out spammer (1h), cleared 20 messages in #general" })
```

The model found `bulk_delete` and `timeout` by calling `discord()` and then
`discord(category: "moderation")` — it never had 30+ tool schemas sitting in
its prompt. Channel and user IDs come from `channels: list` and
`members: list` in the same way.

## Features

One `discord` tool with 11 categories and 30+ actions:

| Category | Actions | Description |
|---|---|---|
| **server** | `list`, `info` | List servers, get server details |
| **channels** | `list`, `create`, `edit`, `delete` | Full channel management |
| **messages** | `send`, `read`, `edit`, `delete`, `bulk_delete`, `pin`, `react`, `search` | Send, read, moderate messages |
| **roles** | `list`, `create`, `edit`, `delete`, `assign` | Role CRUD + assignment |
| **members** | `list`, `info`, `nickname` | Member listing and management |
| **moderation** | `kick`, `ban`, `unban`, `timeout`, `list_bans` | Server moderation |
| **threads** | `create` | Thread creation |
| **webhooks** | `list`, `create` | Webhook management |
| **invites** | `create`, `list` | Invite management |
| **emojis** | `list` | Custom emoji listing |
| **audit** | `log` | Audit log access |

## How It Works

The tool uses 3-level navigation to keep your tool list clean:

```
discord()                                          → list categories
discord(category="messages")                       → list actions & params
discord(category="messages", action="send", params={...}) → execute
```

## Other clients

Same JSON shape for Cursor, Windsurf, Claude Desktop and Cline:

```json
{
  "mcpServers": {
    "discord": {
      "command": "npx",
      "args": ["-y", "@spranab/discord-mcp"],
      "env": {
        "bot_token": "YOUR_BOT_TOKEN"
      }
    }
  }
}
```

### Manual

```bash
npm install -g @spranab/discord-mcp
```

Run with `bot_token` environment variable set:

```bash
bot_token=YOUR_BOT_TOKEN discord-mcp
```

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **Bot** and copy the token
4. Enable **Privileged Gateway Intents** (all three):
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
5. Go to **Installation** > **Default Install Settings** > **Guild Install**
6. Add the `bot` scope and select `Administrator` permissions
7. Use the install link to add the bot to your server

## Tech Stack

- TypeScript
- [discord.js](https://discord.js.org/) v14
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Zod for validation

## Related projects

Other MCP servers and agent infrastructure by the same author:

- [yantrikdb](https://github.com/yantrikos/yantrikdb) — the Rust engine
  behind yantrikdb-mcp: temporal decay, contradiction detection and a
  knowledge graph as an embeddable library.
- [yantrikdb-mcp](https://github.com/yantrikos/yantrikdb-mcp) — persistent
  cognitive memory for Claude Code, Cursor and Windsurf.
- [yantrikdb-server](https://github.com/yantrikos/yantrikdb-server) —
  yantrikdb as an HTTP gateway and MCP server, with an openraft cluster mode
  instead of an embedded library.
- [yantrik-memory](https://github.com/yantrikos/yantrik-memory) — persistent
  cognitive memory for AI agents on the YantrikDB engine, with evolving
  personality traits and bond progression.
- [langchain-yantrikdb](https://github.com/yantrikos/langchain-yantrikdb) —
  YantrikDB as a LangChain VectorStore and ChatMessageHistory.
- [yantrikdb-client](https://github.com/yantrikos/yantrikdb-client) — typed
  Python client SDK for YantrikDB over HTTP: remember, recall with retrieval
  reasons, contradiction handling.
- [yantrikdb-hermes-plugin](https://github.com/yantrikos/yantrikdb-hermes-plugin)
  — YantrikDB memory provider for NousResearch/hermes-agent, with self-tuning
  ranking and contradiction tracking.
- [openclaw-memory-yantrikdb](https://github.com/yantrikos/openclaw-memory-yantrikdb)
  — OpenClaw memory plugin backed by YantrikDB: conflict-aware session
  briefings and auto-capture over plain HTTP.
- [saga-mcp](https://github.com/spranab/saga-mcp) — SQLite-backed project
  tracker so the agent doesn't lose the plan between sessions.
- [brainstorm-mcp](https://github.com/spranab/brainstorm-mcp) — multi-model
  debate as an MCP tool.
- [truenas-mcp](https://github.com/spranab/truenas-mcp) — 278 TrueNAS SCALE
  actions behind the same one-tool pattern used here.
- [mcpier](https://github.com/spranab/mcpier) — self-hosted MCP control plane
  that keeps API keys off your clients.
- [icantmarket-mcp](https://github.com/spranab/icantmarket-mcp) — browse
  products and post asks/reviews on icantmarket from any MCP client.
- [swarmcode](https://github.com/spranab/swarmcode) — real-time channel
  between Claude Code instances on different machines.
- [tier](https://github.com/yantrikos/tier) — adapts a tool list to the model
  behind it, so small models still pick the right one.
- [chronicler](https://github.com/yantrikos/chronicler) — self-hosted AI
  roleplay client with memory that survives long campaigns, and native MCP
  tool support.
- [contextcache](https://github.com/spranab/contextcache) — compiles tool
  schemas into a KV cache once and reuses it across sessions, instead of
  re-prefilling them on every request.

## License

MIT — see [LICENSE](LICENSE).
