import type { MoltbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { dingtalkDock, dingtalkPlugin } from "./src/channel.js";
import { setDingTalkRuntime } from "./src/runtime.js";

const plugin = {
  id: "dingtalk",
  name: "DingTalk",
  description: "Moltbot DingTalk channel plugin (Stream mode)",
  configSchema: emptyPluginConfigSchema(),
  register(api: MoltbotPluginApi) {
    setDingTalkRuntime(api.runtime);
    api.registerChannel({ plugin: dingtalkPlugin, dock: dingtalkDock });
  },
};

export default plugin;
