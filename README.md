# @spranab/discord-mcp

A Discord MCP (Model Context Protocol) server that lets AI assistants like Claude manage your Discord server. Single hierarchical tool design — one tool, tiered navigation, zero bloat.

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

## Installation

### With Claude Code

Add to your `.mcp.json`:

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

## License

MIT
