import type { Command as CommanderCommand } from "commander";
import type { CliCommand } from "../types.js";
import { configure } from "../configure/index.js";

export class ConfigureCommand implements CliCommand {
  register(program: CommanderCommand): void {
    program
      .command("configure")
      .description(
        "Interactively manage WhatsApp connection and event allowlist in .wappmcp/config.json.",
      )
      .option("--headless", "Run the WhatsApp browser without a visible window")
      .action(this.action.bind(this));
  }

  private async action(options: { headless?: boolean }): Promise<void> {
    await configure(Boolean(options.headless));
  }
}
