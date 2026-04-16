import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Command as CommanderCommand } from "commander";
import { CliIO } from "../lib/cli-io.js";
import { ensureProfilesRoot } from "../lib/paths.js";
import type { CliCommand } from "../types.js";

export class ProfileCommand implements CliCommand {
  constructor(private readonly io = new CliIO()) {}

  register(program: CommanderCommand): void {
    program
      .command("profiles")
      .description("List available WhatsApp profiles")
      .action(this.action.bind(this));
  }

  private async action(): Promise<void> {
    const root = await ensureProfilesRoot();
    const entries = await readdir(root, { withFileTypes: true });
    const profiles = (
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const absolutePath = join(root, entry.name);
            const entryStat = await stat(absolutePath);

            return {
              name: entry.name,
              modifiedAt: entryStat.mtimeMs,
            };
          }),
      )
    )
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
      .map((entry) => entry.name);

    if (profiles.length === 0) {
      this.io.line("No profiles found.");
      return;
    }

    profiles.forEach((profile) => {
      this.io.line(profile);
    });
  }
}
