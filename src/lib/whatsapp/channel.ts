import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { WhatsAppSession } from "./session.js";
import type {
  Entity,
  Message,
  MessageWithParent,
  WwebMessage,
} from "./types.js";
import { saveMessageMedia } from "../attachments.js";

const PERMISSION_REPLY_RE =
  /^\s*(yes|y|always|a|no|n)\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i;

export interface MessageChannelEvent {
  source: "whatsapp";
  self: Entity;
  message: Message | MessageWithParent;
  text: string;
}

/**
 * Bridges the WhatsApp `message` (incoming-only) event stream to MCP channel
 * notifications. Owns the listener lifecycle: call {@link start} after the
 * MCP transport is connected and the returned unsubscribe runs automatically
 * when the underlying `Server` closes.
 */
export class WhatsAppChannel {
  private unsubscribe?: () => void;
  private self?: Entity;

  constructor(
    private readonly session: WhatsAppSession,
    private readonly mcp: Server,
    private readonly channel: string,
  ) {}

  async start(): Promise<void> {
    this.self = await this.session.getMe();

    const onMessage = (message: WwebMessage) => {
      void (async () => {
        try {
          const verdict = parsePermissionVerdict(message.body ?? "");
          if (verdict) {
            await this.mcp.notification({
              method: "notifications/hooman/channel/permission",
              params: {
                request_id: verdict.requestId,
                behavior: verdict.behavior,
              },
            } as never);
            return;
          }

          const event = await this.createEvent(message);
          await this.mcp.notification({
            method: `notifications/${this.channel}`,
            params: {
              content: JSON.stringify(event),
              meta: {
                source: "whatsapp",
                user: event.message.sender.id,
                session: event.message.chat.id,
                thread: event.message.id,
              },
            },
          } as never);
        } catch {
          // Transport closed, unsupported client, or other send failure.
        }
      })();
    };

    this.session.client!.on("message", onMessage);
    this.unsubscribe = () => this.session.client?.off("message", onMessage);

    const onclose = this.mcp.onclose;
    this.mcp.onclose = () => {
      this.stop();
      onclose?.();
    };
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private async createEvent(
    message: WwebMessage,
  ): Promise<MessageChannelEvent> {
    let quoted: WwebMessage | undefined;
    if (message.hasQuotedMsg) {
      try {
        quoted = await message.getQuotedMessage();
      } catch {
        // Quoted message may have been deleted.
      }
    }

    const attachments: string[] = [];
    if (message.hasMedia) {
      const path = await saveMessageMedia(message);
      if (path) attachments.push(path);
    }

    if (quoted?.hasMedia) {
      const path = await saveMessageMedia(quoted);
      if (path) attachments.push(path);
    }

    const msg = await this.session.transform(message);
    const parent = quoted ? await this.session.transform(quoted) : undefined;

    return {
      source: "whatsapp",
      self: this.self!,
      message: { ...msg, attachments, parent },
      text: msg.body,
    };
  }
}

function parsePermissionVerdict(text: string): {
  requestId: string;
  behavior: "allow_once" | "allow_always" | "deny";
} | null {
  const match = PERMISSION_REPLY_RE.exec(text);
  if (!match) {
    return null;
  }
  const command = match[1]!.toLowerCase();
  const requestId = match[2]!.toLowerCase();
  if (command === "yes" || command === "y") {
    return { requestId, behavior: "allow_once" };
  }
  if (command === "always" || command === "a") {
    return { requestId, behavior: "allow_always" };
  }
  return { requestId, behavior: "deny" };
}
