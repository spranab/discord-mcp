#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  type Guild,
  type GuildChannel,
  type GuildChannelTypes,
} from "discord.js";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// --- Discord Client Setup ---

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
  ],
});

const BOT_TOKEN = process.env.bot_token;
if (!BOT_TOKEN) {
  console.error("bot_token not found in environment");
  process.exit(1);
}

let isReady = false;

discord.once("ready", () => {
  isReady = true;
  console.error(`Discord bot logged in as ${discord.user?.tag}`);
});

discord.login(BOT_TOKEN).catch((err) => {
  console.error("Failed to login to Discord:", err);
  process.exit(1);
});

// --- Helpers ---

async function getGuild(guildId: string): Promise<Guild> {
  const guild = await discord.guilds.fetch(guildId);
  if (!guild) throw new Error(`Guild ${guildId} not found`);
  return guild;
}

function requireReady() {
  if (!isReady) throw new Error("Discord bot is not ready yet. Please wait a moment and try again.");
}

// --- MCP Server Setup ---

const server = new McpServer({
  name: "discord-mcp",
  version: "1.0.0",
  description: "MCP server for managing Discord servers",
});

// --- Category/Action Registry ---

interface ActionDef {
  description: string;
  params: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>;
  handler: (params: Record<string, any>) => Promise<any>;
}

interface CategoryDef {
  description: string;
  actions: Record<string, ActionDef>;
}

const categories: Record<string, CategoryDef> = {
  server: {
    description: "Server/guild information and listing",
    actions: {
      list: {
        description: "List all Discord servers the bot is in",
        params: {},
        handler: async () => {
          const guilds = await discord.guilds.fetch();
          return guilds.map((g) => ({
            id: g.id,
            name: g.name,
          }));
        },
      },
      info: {
        description: "Get detailed information about a Discord server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
        },
        handler: async ({ guild_id }) => {
          const guild = await getGuild(guild_id);
          const full = await guild.fetch();
          return {
            id: full.id,
            name: full.name,
            description: full.description,
            memberCount: full.memberCount,
            ownerId: full.ownerId,
            createdAt: full.createdAt.toISOString(),
            icon: full.iconURL(),
            banner: full.bannerURL(),
            boostLevel: full.premiumTier,
            boostCount: full.premiumSubscriptionCount,
            verificationLevel: full.verificationLevel,
            features: full.features,
          };
        },
      },
    },
  },

  channels: {
    description: "Channel management — list, create, edit, delete channels",
    actions: {
      list: {
        description: "List all channels in a server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          type: { type: "string", description: "Filter: all, text, voice, category, forum, stage", enum: ["all", "text", "voice", "category", "forum", "stage"] },
        },
        handler: async ({ guild_id, type }) => {
          const guild = await getGuild(guild_id);
          const channels = await guild.channels.fetch();
          const typeMap: Record<string, ChannelType[]> = {
            text: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
            voice: [ChannelType.GuildVoice],
            category: [ChannelType.GuildCategory],
            forum: [ChannelType.GuildForum],
            stage: [ChannelType.GuildStageVoice],
          };
          const filtered = channels.filter((ch) => {
            if (!ch) return false;
            if (!type || type === "all") return true;
            return typeMap[type]?.includes(ch.type) ?? false;
          });
          return filtered.map((ch) => ({
            id: ch!.id,
            name: ch!.name,
            type: ChannelType[ch!.type],
            parentId: (ch as GuildChannel).parentId ?? null,
            position: (ch as GuildChannel).position,
          }));
        },
      },
      create: {
        description: "Create a new channel",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          name: { type: "string", description: "Channel name", required: true },
          type: { type: "string", description: "Channel type", required: true, enum: ["text", "voice", "category", "forum", "stage"] },
          parent_id: { type: "string", description: "Parent category ID" },
          topic: { type: "string", description: "Channel topic (text only)" },
          nsfw: { type: "boolean", description: "Whether the channel is NSFW" },
        },
        handler: async ({ guild_id, name, type, parent_id, topic, nsfw }) => {
          const guild = await getGuild(guild_id);
          const typeMap: Record<string, ChannelType> = {
            text: ChannelType.GuildText, voice: ChannelType.GuildVoice,
            category: ChannelType.GuildCategory, forum: ChannelType.GuildForum, stage: ChannelType.GuildStageVoice,
          };
          const channel = await guild.channels.create({
            name, type: typeMap[type] as GuildChannelTypes, parent: parent_id, topic, nsfw,
          });
          return { id: channel.id, name: channel.name, type: ChannelType[channel.type] };
        },
      },
      edit: {
        description: "Edit a channel's settings",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          name: { type: "string", description: "New channel name" },
          topic: { type: "string", description: "New channel topic" },
          nsfw: { type: "boolean", description: "Set NSFW status" },
          parent_id: { type: "string", description: "Move to a different category" },
          slowmode: { type: "number", description: "Slowmode in seconds (0 to disable)" },
        },
        handler: async ({ channel_id, name, topic, nsfw, parent_id, slowmode }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("edit" in channel)) throw new Error("Channel not found or not editable");
          const edited = await (channel as TextChannel).edit({ name, topic, nsfw, parent: parent_id, rateLimitPerUser: slowmode });
          return { updated: edited.name };
        },
      },
      delete: {
        description: "Delete a channel",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          reason: { type: "string", description: "Reason for deletion" },
        },
        handler: async ({ channel_id, reason }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("delete" in channel)) throw new Error("Channel not found");
          await (channel as GuildChannel).delete(reason);
          return { deleted: channel_id };
        },
      },
    },
  },

  messages: {
    description: "Message operations — send, read, edit, delete, pin, react, search",
    actions: {
      send: {
        description: "Send a message to a channel",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          content: { type: "string", description: "Message text content" },
          embed_title: { type: "string", description: "Embed title" },
          embed_description: { type: "string", description: "Embed description" },
          embed_color: { type: "string", description: "Embed color hex (e.g. '#ff0000')" },
        },
        handler: async ({ channel_id, content, embed_title, embed_description, embed_color }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("send" in channel)) throw new Error("Channel not found or not a text channel");
          const options: any = {};
          if (content) options.content = content;
          if (embed_title || embed_description) {
            const embed = new EmbedBuilder();
            if (embed_title) embed.setTitle(embed_title);
            if (embed_description) embed.setDescription(embed_description);
            if (embed_color) embed.setColor(embed_color as any);
            options.embeds = [embed];
          }
          const msg = await (channel as TextChannel).send(options);
          return { id: msg.id, channelId: msg.channelId };
        },
      },
      read: {
        description: "Read recent messages from a channel",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          limit: { type: "number", description: "Number of messages (default 20, max 100)" },
          before: { type: "string", description: "Get messages before this message ID" },
          after: { type: "string", description: "Get messages after this message ID" },
        },
        handler: async ({ channel_id, limit, before, after }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("messages" in channel)) throw new Error("Channel not found");
          const messages = await (channel as TextChannel).messages.fetch({
            limit: Math.min(limit ?? 20, 100), before, after,
          });
          return messages.map((msg) => ({
            id: msg.id,
            author: { id: msg.author.id, username: msg.author.username, bot: msg.author.bot },
            content: msg.content,
            embeds: msg.embeds.length,
            attachments: msg.attachments.size,
            timestamp: msg.createdAt.toISOString(),
            edited: msg.editedAt?.toISOString() ?? null,
            reactions: msg.reactions.cache.map((r) => ({ emoji: r.emoji.name, count: r.count })),
          }));
        },
      },
      edit: {
        description: "Edit a message sent by the bot",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          message_id: { type: "string", description: "The message ID", required: true },
          content: { type: "string", description: "New message content" },
        },
        handler: async ({ channel_id, message_id, content }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("messages" in channel)) throw new Error("Channel not found");
          const msg = await (channel as TextChannel).messages.fetch(message_id);
          const edited = await msg.edit({ content });
          return { updated: edited.id };
        },
      },
      delete: {
        description: "Delete a message",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          message_id: { type: "string", description: "The message ID", required: true },
        },
        handler: async ({ channel_id, message_id }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("messages" in channel)) throw new Error("Channel not found");
          const msg = await (channel as TextChannel).messages.fetch(message_id);
          await msg.delete();
          return { deleted: message_id };
        },
      },
      bulk_delete: {
        description: "Bulk delete messages (up to 100, max 14 days old)",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          count: { type: "number", description: "Number of messages to delete (max 100)", required: true },
        },
        handler: async ({ channel_id, count }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("bulkDelete" in channel)) throw new Error("Channel not found");
          const deleted = await (channel as TextChannel).bulkDelete(Math.min(count, 100), true);
          return { deleted: deleted.size };
        },
      },
      pin: {
        description: "Pin or unpin a message",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          message_id: { type: "string", description: "The message ID", required: true },
          pin: { type: "boolean", description: "true to pin, false to unpin", required: true },
        },
        handler: async ({ channel_id, message_id, pin }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("messages" in channel)) throw new Error("Channel not found");
          const msg = await (channel as TextChannel).messages.fetch(message_id);
          if (pin) await msg.pin(); else await msg.unpin();
          return { [pin ? "pinned" : "unpinned"]: message_id };
        },
      },
      react: {
        description: "Add a reaction to a message",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          message_id: { type: "string", description: "The message ID", required: true },
          emoji: { type: "string", description: "Emoji to react with", required: true },
        },
        handler: async ({ channel_id, message_id, emoji }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("messages" in channel)) throw new Error("Channel not found");
          const msg = await (channel as TextChannel).messages.fetch(message_id);
          await msg.react(emoji);
          return { reacted: emoji };
        },
      },
      search: {
        description: "Search messages in a channel by text",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          query: { type: "string", description: "Text to search for", required: true },
          limit: { type: "number", description: "Max messages to scan (default 100, max 500)" },
        },
        handler: async ({ channel_id, query, limit }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("messages" in channel)) throw new Error("Channel not found");
          const scanLimit = Math.min(limit ?? 100, 500);
          const messages = await (channel as TextChannel).messages.fetch({ limit: scanLimit });
          const matches = messages.filter((m) => m.content.toLowerCase().includes(query.toLowerCase()));
          return matches.map((msg) => ({
            id: msg.id, author: msg.author.username, content: msg.content,
            timestamp: msg.createdAt.toISOString(),
          }));
        },
      },
    },
  },

  roles: {
    description: "Role management — list, create, edit, delete, assign roles",
    actions: {
      list: {
        description: "List all roles in a server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
        },
        handler: async ({ guild_id }) => {
          const guild = await getGuild(guild_id);
          const roles = await guild.roles.fetch();
          return roles.sort((a, b) => b.position - a.position).map((r) => ({
            id: r.id, name: r.name, color: r.hexColor, position: r.position,
            memberCount: r.members.size, mentionable: r.mentionable, managed: r.managed,
          }));
        },
      },
      create: {
        description: "Create a new role",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          name: { type: "string", description: "Role name", required: true },
          color: { type: "string", description: "Role color hex (e.g. '#ff0000')" },
          mentionable: { type: "boolean", description: "Whether the role is mentionable" },
          hoist: { type: "boolean", description: "Display role members separately" },
        },
        handler: async ({ guild_id, name, color, mentionable, hoist }) => {
          const guild = await getGuild(guild_id);
          const role = await guild.roles.create({ name, color: color as any, mentionable, hoist });
          return { id: role.id, name: role.name, color: role.hexColor };
        },
      },
      edit: {
        description: "Edit an existing role",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          role_id: { type: "string", description: "The role ID", required: true },
          name: { type: "string", description: "New role name" },
          color: { type: "string", description: "New role color hex" },
          mentionable: { type: "boolean", description: "Whether the role is mentionable" },
          hoist: { type: "boolean", description: "Display role members separately" },
        },
        handler: async ({ guild_id, role_id, name, color, mentionable, hoist }) => {
          const guild = await getGuild(guild_id);
          const role = await guild.roles.fetch(role_id);
          if (!role) throw new Error("Role not found");
          const edited = await role.edit({ name, color: color as any, mentionable, hoist });
          return { updated: edited.name };
        },
      },
      delete: {
        description: "Delete a role",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          role_id: { type: "string", description: "The role ID", required: true },
          reason: { type: "string", description: "Reason for deletion" },
        },
        handler: async ({ guild_id, role_id, reason }) => {
          const guild = await getGuild(guild_id);
          const role = await guild.roles.fetch(role_id);
          if (!role) throw new Error("Role not found");
          await role.delete(reason);
          return { deleted: role_id };
        },
      },
      assign: {
        description: "Add or remove a role from a member",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
          role_id: { type: "string", description: "The role ID", required: true },
          action: { type: "string", description: "add or remove", required: true, enum: ["add", "remove"] },
        },
        handler: async ({ guild_id, user_id, role_id, action }) => {
          const guild = await getGuild(guild_id);
          const member = await guild.members.fetch(user_id);
          if (action === "add") await member.roles.add(role_id);
          else await member.roles.remove(role_id);
          return { [action === "add" ? "assigned" : "removed"]: role_id, user: member.user.username };
        },
      },
    },
  },

  members: {
    description: "Member management — list, info, nickname",
    actions: {
      list: {
        description: "List members in a server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          limit: { type: "number", description: "Number of members (default 50, max 1000)" },
        },
        handler: async ({ guild_id, limit }) => {
          const guild = await getGuild(guild_id);
          const members = await guild.members.fetch({ limit: Math.min(limit ?? 50, 1000) });
          return members.map((m) => ({
            id: m.id, username: m.user.username, displayName: m.displayName, bot: m.user.bot,
            joinedAt: m.joinedAt?.toISOString(),
            roles: m.roles.cache.map((r) => ({ id: r.id, name: r.name })),
            status: m.presence?.status ?? "offline",
          }));
        },
      },
      info: {
        description: "Get detailed info about a member",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
        },
        handler: async ({ guild_id, user_id }) => {
          const guild = await getGuild(guild_id);
          const member = await guild.members.fetch(user_id);
          return {
            id: member.id, username: member.user.username, displayName: member.displayName,
            bot: member.user.bot, avatar: member.user.avatarURL(),
            joinedAt: member.joinedAt?.toISOString(), createdAt: member.user.createdAt.toISOString(),
            roles: member.roles.cache.map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
            permissions: member.permissions.toArray(),
            status: member.presence?.status ?? "offline",
            nickname: member.nickname,
            boosting: member.premiumSince?.toISOString() ?? null,
          };
        },
      },
      nickname: {
        description: "Set or reset a member's nickname",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
          nickname: { type: "string", description: "New nickname (omit to reset)" },
        },
        handler: async ({ guild_id, user_id, nickname }) => {
          const guild = await getGuild(guild_id);
          const member = await guild.members.fetch(user_id);
          await member.setNickname(nickname ?? null);
          return { nickname: nickname ?? "(reset)", user: member.user.username };
        },
      },
    },
  },

  moderation: {
    description: "Moderation — kick, ban, unban, timeout, list bans",
    actions: {
      kick: {
        description: "Kick a member from the server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
          reason: { type: "string", description: "Reason for kick" },
        },
        handler: async ({ guild_id, user_id, reason }) => {
          const guild = await getGuild(guild_id);
          const member = await guild.members.fetch(user_id);
          await member.kick(reason);
          return { kicked: member.user.username };
        },
      },
      ban: {
        description: "Ban a user from the server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
          reason: { type: "string", description: "Reason for ban" },
          delete_message_days: { type: "number", description: "Days of messages to delete (0-7)" },
        },
        handler: async ({ guild_id, user_id, reason, delete_message_days }) => {
          const guild = await getGuild(guild_id);
          await guild.members.ban(user_id, { reason, deleteMessageSeconds: (delete_message_days ?? 0) * 86400 });
          return { banned: user_id };
        },
      },
      unban: {
        description: "Unban a user",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
          reason: { type: "string", description: "Reason for unban" },
        },
        handler: async ({ guild_id, user_id, reason }) => {
          const guild = await getGuild(guild_id);
          await guild.members.unban(user_id, reason);
          return { unbanned: user_id };
        },
      },
      timeout: {
        description: "Timeout (mute) a member",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          user_id: { type: "string", description: "The user ID", required: true },
          duration_minutes: { type: "number", description: "Duration in minutes (0 to remove)", required: true },
          reason: { type: "string", description: "Reason for timeout" },
        },
        handler: async ({ guild_id, user_id, duration_minutes, reason }) => {
          const guild = await getGuild(guild_id);
          const member = await guild.members.fetch(user_id);
          if (duration_minutes === 0) {
            await member.timeout(null, reason);
            return { timeout_removed: member.user.username };
          }
          await member.timeout(duration_minutes * 60 * 1000, reason);
          return { timed_out: member.user.username, minutes: duration_minutes };
        },
      },
      list_bans: {
        description: "List all banned users",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
        },
        handler: async ({ guild_id }) => {
          const guild = await getGuild(guild_id);
          const bans = await guild.bans.fetch();
          return bans.map((b) => ({ userId: b.user.id, username: b.user.username, reason: b.reason }));
        },
      },
    },
  },

  threads: {
    description: "Thread management",
    actions: {
      create: {
        description: "Create a thread in a text channel",
        params: {
          channel_id: { type: "string", description: "The text channel ID", required: true },
          name: { type: "string", description: "Thread name", required: true },
          message_id: { type: "string", description: "Message ID to start thread from (omit for standalone)" },
          auto_archive_duration: { type: "string", description: "Auto archive minutes: 60, 1440, 4320, 10080", enum: ["60", "1440", "4320", "10080"] },
        },
        handler: async ({ channel_id, name, message_id, auto_archive_duration }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("threads" in channel)) throw new Error("Channel not found or doesn't support threads");
          const archiveDuration = auto_archive_duration ? parseInt(auto_archive_duration) : undefined;
          const opts: any = { name, autoArchiveDuration: archiveDuration };
          if (message_id) opts.startMessage = message_id;
          const thread = await (channel as TextChannel).threads.create(opts);
          return { id: thread.id, name: thread.name };
        },
      },
    },
  },

  webhooks: {
    description: "Webhook management — list and create webhooks",
    actions: {
      list: {
        description: "List webhooks in a channel or guild",
        params: {
          guild_id: { type: "string", description: "Guild ID (lists all guild webhooks)" },
          channel_id: { type: "string", description: "Channel ID (lists channel webhooks)" },
        },
        handler: async ({ guild_id, channel_id }) => {
          if (channel_id) {
            const channel = await discord.channels.fetch(channel_id);
            if (!channel || !("fetchWebhooks" in channel)) throw new Error("Channel not found");
            const webhooks = await (channel as TextChannel).fetchWebhooks();
            return webhooks.map((w) => ({ id: w.id, name: w.name, channelId: w.channelId, url: w.url }));
          }
          if (guild_id) {
            const guild = await getGuild(guild_id);
            const webhooks = await guild.fetchWebhooks();
            return webhooks.map((w) => ({ id: w.id, name: w.name, channelId: w.channelId, url: w.url }));
          }
          throw new Error("Provide either guild_id or channel_id");
        },
      },
      create: {
        description: "Create a webhook in a channel",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          name: { type: "string", description: "Webhook name", required: true },
          reason: { type: "string", description: "Reason for creating" },
        },
        handler: async ({ channel_id, name, reason }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("createWebhook" in channel)) throw new Error("Channel not found");
          const webhook = await (channel as TextChannel).createWebhook({ name, reason });
          return { id: webhook.id, name: webhook.name, url: webhook.url };
        },
      },
    },
  },

  invites: {
    description: "Invite management — create and list invites",
    actions: {
      create: {
        description: "Create an invite link for a channel",
        params: {
          channel_id: { type: "string", description: "The channel ID", required: true },
          max_age: { type: "number", description: "Expiry in seconds (0 for never, default 86400)" },
          max_uses: { type: "number", description: "Max uses (0 for unlimited)" },
          unique: { type: "boolean", description: "Create a unique invite" },
        },
        handler: async ({ channel_id, max_age, max_uses, unique }) => {
          const channel = await discord.channels.fetch(channel_id);
          if (!channel || !("createInvite" in channel)) throw new Error("Channel not found");
          const invite = await (channel as TextChannel).createInvite({
            maxAge: max_age ?? 86400, maxUses: max_uses, unique,
          });
          return { code: invite.code, url: invite.url, expiresAt: invite.expiresAt?.toISOString() };
        },
      },
      list: {
        description: "List all active invites in a server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
        },
        handler: async ({ guild_id }) => {
          const guild = await getGuild(guild_id);
          const invites = await guild.invites.fetch();
          return invites.map((inv) => ({
            code: inv.code, url: inv.url, channel: inv.channel?.name,
            inviter: inv.inviter?.username, uses: inv.uses, maxUses: inv.maxUses,
            expiresAt: inv.expiresAt?.toISOString(),
          }));
        },
      },
    },
  },

  emojis: {
    description: "Emoji management",
    actions: {
      list: {
        description: "List all custom emojis in a server",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
        },
        handler: async ({ guild_id }) => {
          const guild = await getGuild(guild_id);
          const emojis = await guild.emojis.fetch();
          return emojis.map((e) => ({ id: e.id, name: e.name, animated: e.animated, url: e.url }));
        },
      },
    },
  },

  audit: {
    description: "Audit log access",
    actions: {
      log: {
        description: "Get recent audit log entries",
        params: {
          guild_id: { type: "string", description: "The Discord server ID", required: true },
          limit: { type: "number", description: "Number of entries (default 20, max 100)" },
        },
        handler: async ({ guild_id, limit }) => {
          const guild = await getGuild(guild_id);
          const auditLogs = await guild.fetchAuditLogs({ limit: Math.min(limit ?? 20, 100) });
          return auditLogs.entries.map((entry) => ({
            id: entry.id, action: entry.action,
            executor: entry.executor ? { id: entry.executor.id, username: entry.executor.username } : null,
            target: entry.targetId, reason: entry.reason,
            createdAt: entry.createdAt.toISOString(),
          }));
        },
      },
    },
  },
};

// --- Single Hierarchical Tool ---

server.tool(
  "discord",
  "Discord server management. Call with no args to list categories. Call with category to list actions. Call with category + action + params to execute.",
  {
    category: z.string().optional().describe("Category: server, channels, messages, roles, members, moderation, threads, webhooks, invites, emojis, audit"),
    action: z.string().optional().describe("Action within the category"),
    params: z.record(z.string(), z.any()).optional().describe("Parameters for the action"),
  },
  async ({ category, action, params }: { category?: string; action?: string; params?: Record<string, any> }) => {
    requireReady();

    // Level 1: List categories
    if (!category) {
      const list = Object.entries(categories).map(([name, cat]) => ({
        category: name,
        description: cat.description,
        actions: Object.keys(cat.actions),
      }));
      return {
        content: [{
          type: "text",
          text: "Available categories:\n\n" + JSON.stringify(list, null, 2) +
            "\n\nUsage: call with category to see actions, or category + action + params to execute.",
        }],
      };
    }

    const cat = categories[category];
    if (!cat) {
      return {
        content: [{ type: "text", text: `Unknown category "${category}". Available: ${Object.keys(categories).join(", ")}` }],
        isError: true,
      };
    }

    // Level 2: List actions in category
    if (!action) {
      const list = Object.entries(cat.actions).map(([name, act]) => ({
        action: name,
        description: act.description,
        params: Object.entries(act.params).map(([pName, pDef]) => ({
          name: pName,
          type: pDef.type,
          required: pDef.required ?? false,
          description: pDef.description,
          ...(pDef.enum ? { enum: pDef.enum } : {}),
        })),
      }));
      return {
        content: [{
          type: "text",
          text: `Category "${category}" — ${cat.description}\n\nActions:\n\n` + JSON.stringify(list, null, 2) +
            "\n\nUsage: call with category + action + params to execute.",
        }],
      };
    }

    const act = cat.actions[action];
    if (!act) {
      return {
        content: [{ type: "text", text: `Unknown action "${action}" in category "${category}". Available: ${Object.keys(cat.actions).join(", ")}` }],
        isError: true,
      };
    }

    // Validate required params
    const p = params ?? {};
    for (const [pName, pDef] of Object.entries(act.params)) {
      if (pDef.required && (p[pName] === undefined || p[pName] === null)) {
        return {
          content: [{ type: "text", text: `Missing required parameter "${pName}": ${pDef.description}` }],
          isError: true,
        };
      }
    }

    // Level 3: Execute
    try {
      const result = await act.handler(p);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Discord MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
