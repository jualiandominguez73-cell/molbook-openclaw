import type { Command } from "commander";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { registerNodesCameraCommands } from "./register.camera.js";
import { registerNodesCanvasCommands } from "./register.canvas.js";
import { registerNodesInvokeCommands } from "./register.invoke.js";
import { registerNodesLocationCommands } from "./register.location.js";
import { registerNodesNotifyCommand } from "./register.notify.js";
import { registerNodesPairingCommands } from "./register.pairing.js";
import { registerNodesScreenCommands } from "./register.screen.js";
import { registerNodesStatusCommands } from "./register.status.js";

export function registerNodesCli(program: Command) {
  const nodes = program
    .command("nodes")
    .description("管理网关拥有的节点配对")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档:")} ${formatDocsLink("/cli/nodes", "docs.openclaw.ai/cli/nodes")}\n`,
    );

  registerNodesStatusCommands(nodes);
  registerNodesPairingCommands(nodes);
  registerNodesInvokeCommands(nodes);
  registerNodesNotifyCommand(nodes);
  registerNodesCanvasCommands(nodes);
  registerNodesCameraCommands(nodes);
  registerNodesScreenCommands(nodes);
  registerNodesLocationCommands(nodes);
}
