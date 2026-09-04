# Installing discord-mcp

discord-mcp runs a Discord server from an AI assistant: 30+ actions across
messages, channels, roles, members, moderation, threads, webhooks, invites,
emojis and the audit log, behind one hierarchical `discord` tool (three-level
discovery — category, then action, then params — so the model never loads
30+ tool schemas at once).

## Steps

1. **Create a Discord bot and get a token** (about two minutes, required —
   there is no way to use this server without one):
   1. Open the [Discord Developer Portal](https://discord.com/developers/applications)
      and create a new application.
   2. Go to **Bot** and copy the token.
   3. Enable all three **Privileged Gateway Intents**: Presence, Server
      Members, and Message Content.
   4. Go to **Installation** > **Default Install Settings** > **Guild
      Install**, add the `bot` scope with `Administrator` permissions, and
      use the generated install link to add the bot to the target server.
2. Add this to the client's MCP config, using the token from step 1:

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

3. Restart the client.

## Notes for the installing agent

- The env var is lowercase `bot_token`, not `BOT_TOKEN` or `DISCORD_BOT_TOKEN`
  — it must match exactly.
- Node.js 18+ must be on PATH for `npx` to work.
- If the three privileged intents in step 1.3 are not enabled, the bot logs
  in but member/presence-related actions fail or return empty data — this is
  the most common setup mistake.
- There are no other required settings; everything else is discovered through
  the `discord` tool's category/action/params navigation at runtime.
