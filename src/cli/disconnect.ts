import { constants } from "node:fs";
import { access } from "node:fs/promises";
import type { Command as CommanderCommand } from "commander";
import { CliIO } from "../lib/cli-io.js";
import { parseFiniteNumber } from "../lib/number.js";
import { deleteProfile, profilePath } from "../lib/paths.js";
import { register } from "../lib/signal-handler.js";
import type { CliCommand } from "../types.js";

const DEFAULT_WAIT_FOR_MS = 60_000;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export class DisconnectCommand implements CliCommand {
  constructor(private readonly io = new CliIO()) {}

  register(program: CommanderCommand): void {
    program
      .command("disconnect")
      .description(
        "Log out a WhatsApp profile, close the client, and delete its profile folder",
      )
      .requiredOption("--profile <name>", "Profile name, for example sales")
      .option(
        "--wait-for <ms>",
        "Maximum time to wait for WhatsApp startup state before giving up",
        String(DEFAULT_WAIT_FOR_MS),
      )
      .action(this.action.bind(this));
  }

  private async action(options: {
    profile: string;
    waitFor: string;
  }): Promise<void> {
    const targetProfilePath = profilePath(options.profile);
    const waitForMs = parseFiniteNumber(options.waitFor, "--wait-for");

    if (!(await exists(targetProfilePath))) {
      this.io.line(`Profile "${options.profile}" does not exist.`);
      return;
    }

    if (waitForMs === undefined || waitForMs < 0) {
      throw new Error(
        "--wait-for must be a non-negative number of milliseconds",
      );
    }

    const { WhatsAppSession } = await import("../lib/whatsapp/session.js");
    const session = new WhatsAppSession({
      profile: options.profile,
      io: this.io,
    });
    let destroyed = false;
    const closeSession = async () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      await session.destroy();
    };
    const unregister = register(async () => {
      this.io.line("Shutting down WhatsApp session...");
      await closeSession();
    });

    try {
      this.io.line(`Starting WhatsApp for profile "${options.profile}"...`);
      await session.start();
      const outcome = await session.waitForStartup(waitForMs);

      if (outcome.kind === "ready") {
        this.io.line("Active session found. Logging out...");
        await session.logOut();
      } else if (outcome.kind === "qr") {
        this.io.line("No active login found; removing local profile data.");
      } else if (outcome.kind === "auth_failure") {
        this.io.line(`Authentication failed: ${outcome.message}`);
      } else if (outcome.kind === "disconnected") {
        this.io.line(`Disconnected: ${outcome.reason}`);
      } else {
        this.io.line(
          "Timed out waiting for startup state; removing local profile data.",
        );
      }
    } finally {
      unregister();
      await closeSession();
      await deleteProfile(options.profile);
    }

    this.io.line(`Deleted profile "${options.profile}".`);
  }
}
