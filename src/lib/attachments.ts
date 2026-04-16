import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Message as WwebMessage } from "whatsapp-web.js";
import { attachmentsRoot } from "./paths.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, "_").slice(0, 200) || "file";
}

export async function saveMessageMedia(
  message: WwebMessage,
): Promise<string | undefined> {
  if (!message.hasMedia) return undefined;
  try {
    const media = await message.downloadMedia();
    if (!media?.data) return undefined;
    const originalName = sanitizeFilename(
      media.filename ?? `attachment-${Date.now()}`,
    );
    const buffer = Buffer.from(media.data, "base64");
    const root = attachmentsRoot();
    await mkdir(root, { recursive: true });
    const localPath = join(root, `${randomUUID()}-${originalName}`);
    await writeFile(localPath, buffer);
    return localPath;
  } catch {
    return undefined;
  }
}
