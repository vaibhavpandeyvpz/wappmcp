export type {
  Chat as WwebChat,
  Contact as WwebContact,
  GroupParticipant as WwebGroupParticipant,
  Message as WwebMessage,
  MessageAck as WwebMessageAck,
  WAState as WwebWAState,
} from "whatsapp-web.js";

import type { Message as WwebMessage } from "whatsapp-web.js";

export interface Entity {
  id: string;
  name?: string;
  number?: string;
  pushname?: string;
  wids?: string[];
}

export type ConnectionState =
  | "idle"
  | "starting"
  | "pairing"
  | "connected"
  | "disconnected";

export interface Battery {
  battery: number;
  plugged: boolean;
}

export interface Device {
  version: string;
  platform: string;
  battery?: Battery;
}

export interface Connection {
  profile: {
    name: string;
    path: string;
  };
  status: ConnectionState;
  device?: Device;
}

export interface MessageFlags {
  outgoing: boolean;
  forwarded: boolean;
  starred: boolean;
}

export interface MessageRelationships {
  media: boolean;
  quoted: boolean;
  reaction: boolean;
}

export interface Message {
  id: string;
  body: string;
  type: WwebMessage["type"] | null;
  chat: Chat;
  sender: Entity;
  timestamp: Date;
  flags: MessageFlags;
  relationships: MessageRelationships;
  attachments: string[];
  links: string[];
  mentions: string[];
}

export interface MessageWithParent extends Message {
  parent: Message;
}

export interface ChatFlags {
  group: boolean;
}

export interface Chat {
  id: string;
  name?: string;
  flags: ChatFlags;
  unreads: number;
  timestamp: Date;
}

export interface ChatParticipantFlags {
  admin: boolean;
  superadmin: boolean;
}

export interface ChatParticipant extends Entity {
  flags: ChatParticipantFlags;
}

export interface ChatWithParticipants extends Chat {
  participants?: ChatParticipant[];
}

export interface ContactFlags {
  enterprise: boolean;
}

export interface Contact extends Entity {
  number?: string;
  flags: ContactFlags;
}

export interface LookupResult {
  q: string;
  id?: string;
  registered: boolean;
  number?: string;
}

export interface ContactSearchMeta {
  q: string;
  total: number;
  more: boolean;
}

export interface MessageSearchMeta {
  q: string;
  chat?: { id: string };
  page?: number;
  limit?: number;
}

export interface ContactSearchResult {
  contacts: Contact[];
  meta: ContactSearchMeta;
}

export interface MessageSearchResult {
  messages: Message[];
  meta: MessageSearchMeta;
}

export type ChannelPermissionBehavior = "allow_once" | "allow_always" | "deny";
