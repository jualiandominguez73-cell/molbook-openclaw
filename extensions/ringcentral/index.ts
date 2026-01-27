import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { ringcentralDock, ringcentralPlugin } from "./src/channel.js";
import { setRingCentralRuntime } from "./src/runtime.js";

const plugin = {
  id: "ringcentral",
  name: "RingCentral",
  description: "Clawdbot RingCentral Team Messaging channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setRingCentralRuntime(api.runtime);
    api.registerChannel({ plugin: ringcentralPlugin, dock: ringcentralDock });
    // WebSocket mode: no HTTP handler needed
  },
};

export default plugin;
