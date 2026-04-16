import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import { createJsonResource, createJsonResult } from "./helpers.js";
import { parseFiniteNumber } from "../number.js";
import { packageMetadata } from "../package-metadata.js";
import { WhatsAppChannel } from "../whatsapp/channel.js";
import type { WhatsAppSession } from "../whatsapp/session.js";

const instructions = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../instructions.md"),
  "utf8",
);

export class WhatsAppMcpServer {
  readonly mcp: McpServer;

  private constructor(
    private readonly session: WhatsAppSession,
    private readonly channel?: string,
  ) {
    this.mcp = new McpServer(
      {
        name: packageMetadata.name,
        version: packageMetadata.version,
      },
      {
        capabilities: {
          experimental: channel
            ? {
                [channel]: {},
              }
            : undefined,
        },
        instructions,
      },
    );
  }

  static create(session: WhatsAppSession, channel?: string): WhatsAppMcpServer {
    const server = new WhatsAppMcpServer(session, channel);
    server.registerResources();
    server.registerTools();
    return server;
  }

  async start(transport: Transport): Promise<void> {
    await this.mcp.connect(transport);
  }

  async subscribe() {
    if (!this.channel) {
      throw new Error("Channel not specified");
    }

    const channel = new WhatsAppChannel(
      this.session,
      this.mcp.server,
      this.channel,
    );
    await channel.start();
  }

  private registerResources(): void {
    this.mcp.registerResource(
      "whatsapp_me",
      "whatsapp://me",
      {
        title: "WhatsApp connected user",
        description:
          "Return the current session details for this WhatsApp user (me).",
        mimeType: "application/json",
      },
      async (uri) => createJsonResource(uri, await this.session.getMe()),
    );

    this.mcp.registerResource(
      "whatsapp_status",
      "whatsapp://status",
      {
        title: "WhatsApp connection status",
        description:
          "Return the current connection status for this WhatsApp profile.",
        mimeType: "application/json",
      },
      async (uri) => createJsonResource(uri, await this.session.getStatus()),
    );

    this.mcp.registerResource(
      "whatsapp_chats",
      "whatsapp://chats",
      {
        title: "WhatsApp chats",
        description:
          "List all chats available in the connected WhatsApp account.",
        mimeType: "application/json",
      },
      async (uri) => createJsonResource(uri, await this.session.listChats()),
    );

    this.mcp.registerResource(
      "whatsapp_chat",
      new ResourceTemplate("whatsapp://chats/{chatId}", { list: undefined }),
      {
        title: "WhatsApp chat",
        description:
          "Get details for a chat by ID, including participants for groups.",
        mimeType: "application/json",
      },
      async (uri, { chatId }) => {
        const resolvedChatId = Array.isArray(chatId) ? chatId[0] : chatId;
        return createJsonResource(
          uri,
          await this.session.getChatInfo(resolvedChatId),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_chat_participants",
      new ResourceTemplate("whatsapp://chats/{chatId}/participants", {
        list: undefined,
      }),
      {
        title: "WhatsApp chat participants",
        description:
          "List participants in a group chat. Returns an empty list for non-group chats.",
        mimeType: "application/json",
      },
      async (uri, { chatId }) => {
        const single = Array.isArray(chatId) ? chatId[0] : chatId;
        return createJsonResource(
          uri,
          await this.session.getChatParticipants(single),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_chat_messages",
      new ResourceTemplate("whatsapp://chats/{chatId}/messages{?limit}", {
        list: undefined,
      }),
      {
        title: "WhatsApp chat messages",
        description:
          "Fetch recent messages from a chat for context. Optional limit query parameter defaults to 50.",
        mimeType: "application/json",
      },
      async (uri, { chatId }) => {
        const single = Array.isArray(chatId) ? chatId[0] : chatId;
        const limit = parseFiniteNumber(uri.searchParams.get("limit"), "limit");
        if (limit !== undefined && limit < 1) {
          throw new Error("limit must be a positive number");
        }

        return createJsonResource(
          uri,
          await this.session.getChatMessages(single, limit),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_message_search",
      new ResourceTemplate(
        "whatsapp://messages/search{?query,chatId,page,limit}",
        {
          list: undefined,
        },
      ),
      {
        title: "WhatsApp message search",
        description:
          "Search messages globally or within a chat using query and optional chatId, page, and limit parameters.",
        mimeType: "application/json",
      },
      async (uri) => {
        const page = parseFiniteNumber(uri.searchParams.get("page"), "page");
        const limit = parseFiniteNumber(uri.searchParams.get("limit"), "limit");

        if (page !== undefined && page < 1) {
          throw new Error("page must be a positive number");
        }

        if (limit !== undefined && limit < 1) {
          throw new Error("limit must be a positive number");
        }

        return createJsonResource(
          uri,
          await this.session.searchMessages(
            uri.searchParams.get("query") ?? "",
            uri.searchParams.get("chatId") ?? undefined,
            page,
            limit,
          ),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_message",
      new ResourceTemplate("whatsapp://messages/{messageId}", {
        list: undefined,
      }),
      {
        title: "WhatsApp message",
        description: "Get a message snapshot by message ID.",
        mimeType: "application/json",
      },
      async (uri, { messageId }) => {
        const single = Array.isArray(messageId) ? messageId[0] : messageId;
        return createJsonResource(uri, await this.session.getMessage(single));
      },
    );

    this.mcp.registerResource(
      "whatsapp_contacts",
      "whatsapp://contacts",
      {
        title: "WhatsApp contacts",
        description:
          "List all contacts available in the connected WhatsApp account.",
        mimeType: "application/json",
      },
      async (uri) => createJsonResource(uri, await this.session.listContacts()),
    );

    this.mcp.registerResource(
      "whatsapp_contact",
      new ResourceTemplate("whatsapp://contacts/{contactId}", {
        list: undefined,
      }),
      {
        title: "WhatsApp contact",
        description: "Get details for a specific contact by contact ID.",
        mimeType: "application/json",
      },
      async (uri, { contactId }) => {
        const single = Array.isArray(contactId) ? contactId[0] : contactId;
        return createJsonResource(
          uri,
          await this.session.getContactInfo(single),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_contact_search",
      new ResourceTemplate("whatsapp://contacts/search{?query,limit}", {
        list: undefined,
      }),
      {
        title: "WhatsApp contact search",
        description:
          "Search contacts by name, pushname, short name, number, or ID using query and optional limit parameters.",
        mimeType: "application/json",
      },
      async (uri) => {
        const limit = parseFiniteNumber(uri.searchParams.get("limit"), "limit");
        if (limit !== undefined && limit < 1) {
          throw new Error("limit must be a positive number");
        }

        return createJsonResource(
          uri,
          await this.session.searchContacts(
            uri.searchParams.get("query") ?? "",
            limit,
          ),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_contact_lid",
      new ResourceTemplate("whatsapp://contacts/{contactId}/lid", {
        list: undefined,
      }),
      {
        title: "WhatsApp contact LID",
        description:
          "Return the LID mapping for a contact ID, when available from the current client.",
        mimeType: "application/json",
      },
      async (uri, { contactId }) => {
        const single = Array.isArray(contactId) ? contactId[0] : contactId;
        return createJsonResource(
          uri,
          await this.session.getLidForContact(single),
        );
      },
    );

    this.mcp.registerResource(
      "whatsapp_number",
      new ResourceTemplate("whatsapp://numbers/{number}", { list: undefined }),
      {
        title: "WhatsApp number lookup",
        description:
          "Look up whether a number is registered on WhatsApp and return normalized metadata for it.",
        mimeType: "application/json",
      },
      async (uri, { number }) => {
        const single = Array.isArray(number) ? number[0] : number;
        return createJsonResource(uri, await this.session.lookupNumber(single));
      },
    );
  }

  private registerTools(): void {
    this.mcp.registerTool(
      "whatsapp_send_message",
      {
        title: "Send a WhatsApp message",
        description: "Send a plain text message to a WhatsApp chat or group.",
        inputSchema: z.object({
          chatId: z.string().describe("Target chat ID."),
          text: z.string().describe("Message text."),
        }),
      },
      async ({ chatId, text }) => {
        const messageId = await this.session.sendMessage(chatId, text);
        return createJsonResult({ messageId });
      },
    );

    this.mcp.registerTool(
      "whatsapp_send_media_from_base64",
      {
        title: "Send WhatsApp media from base64",
        description:
          "Send media to a WhatsApp chat using a base64 payload plus MIME type and optional filename/caption.",
        inputSchema: z.object({
          chatId: z.string(),
          data: z.string().describe("Base64-encoded file content."),
          mimetype: z
            .string()
            .describe("MIME type, for example image/png or application/pdf."),
          filename: z.string().optional(),
          caption: z.string().optional(),
        }),
      },
      async ({ chatId, data, mimetype, filename, caption }) => {
        const messageId = await this.session.sendMediaFromBase64(
          chatId,
          mimetype,
          data,
          filename,
          caption,
        );
        return createJsonResult({ messageId });
      },
    );

    this.mcp.registerTool(
      "whatsapp_send_media_from_path",
      {
        title: "Send WhatsApp media from path",
        description: "Send a local file to a WhatsApp chat by file path.",
        inputSchema: z.object({
          chatId: z.string(),
          path: z.string().describe("Absolute or relative local file path."),
          caption: z.string().optional(),
        }),
      },
      async ({ chatId, path, caption }) => {
        const messageId = await this.session.sendMediaFromPath(
          chatId,
          path,
          caption,
        );
        return createJsonResult({ messageId });
      },
    );

    this.mcp.registerTool(
      "whatsapp_reply_to_message",
      {
        title: "Reply to a WhatsApp message",
        description: "Send a quoted reply to an existing WhatsApp message.",
        inputSchema: z.object({
          messageId: z.string().describe("Message ID to reply to."),
          text: z.string().describe("Reply text."),
          chatId: z.string().optional().describe("Optional chat ID override."),
        }),
      },
      async ({ messageId, text, chatId }) => {
        const newMessageId = await this.session.replyToMessage(
          messageId,
          text,
          chatId,
        );
        return createJsonResult({ messageId: newMessageId });
      },
    );

    this.mcp.registerTool(
      "whatsapp_react_to_message",
      {
        title: "React to a WhatsApp message",
        description: "Add an emoji reaction to an existing WhatsApp message.",
        inputSchema: z.object({
          messageId: z.string().describe("Target message ID."),
          emoji: z
            .string()
            .optional()
            .describe("Emoji reaction. Default is thumbs up."),
        }),
      },
      async ({ messageId, emoji }) => {
        await this.session.reactToMessage(messageId, emoji ?? "👍");
        return createJsonResult({ ok: true });
      },
    );

    this.mcp.registerTool(
      "whatsapp_edit_message",
      {
        title: "Edit a WhatsApp message",
        description: "Edit a previously sent message by ID.",
        inputSchema: z.object({
          messageId: z.string().describe("Target message ID."),
          text: z.string().describe("Updated message text."),
        }),
      },
      async ({ messageId, text }) => {
        await this.session.editMessage(messageId, text);
        return createJsonResult({ ok: true });
      },
    );

    this.mcp.registerTool(
      "whatsapp_delete_message",
      {
        title: "Delete a WhatsApp message",
        description:
          "Delete a message by ID. Use everyone=true to try deleting for everyone when supported.",
        inputSchema: z.object({
          messageId: z.string().describe("Target message ID."),
          everyone: z
            .boolean()
            .optional()
            .describe("Whether to delete the message for everyone."),
        }),
      },
      async ({ messageId, everyone }) => {
        await this.session.deleteMessage(messageId, everyone ?? false);
        return createJsonResult({ ok: true });
      },
    );

    this.mcp.registerTool(
      "whatsapp_forward_message",
      {
        title: "Forward a WhatsApp message",
        description: "Forward an existing message to another chat.",
        inputSchema: z.object({
          messageId: z.string().describe("Source message ID."),
          chatId: z.string().describe("Destination chat ID."),
        }),
      },
      async ({ messageId, chatId }) => {
        await this.session.forwardMessage(chatId, messageId);
        return createJsonResult({ ok: true });
      },
    );

    this.mcp.registerTool(
      "whatsapp_send_typing",
      {
        title: "Show WhatsApp typing state",
        description: "Show the typing indicator in a target chat.",
        inputSchema: z.object({
          chatId: z.string().describe("Target chat ID."),
        }),
      },
      async ({ chatId }) => {
        await this.session.sendTyping(chatId);
        return createJsonResult({ ok: true });
      },
    );
  }
}
