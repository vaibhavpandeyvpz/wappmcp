import process from "node:process";
import qrcode from "qrcode-terminal";
import type { Connection } from "./whatsapp/types.js";

export class CliIO {
  constructor(
    private readonly stdout: NodeJS.WriteStream = process.stdout,
    private readonly stderr: NodeJS.WriteStream = process.stderr,
  ) {}

  line(message: string): void {
    this.stdout.write(`${message}\n`);
  }

  error(message: string): void {
    this.stderr.write(`${message}\n`);
  }

  qr(value: string): void {
    this.stdout.write(
      "Scan this QR code with WhatsApp (or WhatsApp Business):\n\n",
    );
    qrcode.generate(value, { small: true }, (rendered) => {
      this.stdout.write(`${rendered}\n`);
    });
  }

  info(info: Connection): void {
    this.line(`Profile path: ${info.profile.path}`);
    this.line(`Connection status: ${info.status}`);
  }
}
