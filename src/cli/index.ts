import type { CliCommand } from "../types.js";
import { ConnectCommand } from "./connect.js";
import { DisconnectCommand } from "./disconnect.js";
import { McpCommand } from "./mcp.js";
import { ProfileCommand } from "./profiles.js";

export const commands: ReadonlyArray<CliCommand> = [
  new ProfileCommand(),
  new ConnectCommand(),
  new DisconnectCommand(),
  new McpCommand(),
];
