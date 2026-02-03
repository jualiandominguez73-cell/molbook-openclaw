import type { App } from "@slack/bolt";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import type { RuntimeEnv } from "../../../runtime.js";
import type { ResolvedSlackAccount } from "../../accounts.js";
import type { SlackMessageEvent } from "../../types.js";
import { createSlackMonitorContext } from "../context.js";
import { prepareSlackMessage } from "./prepare.js";

describe("slack prepareSlackMessage thread_ts metadata", () => {
  it("includes thread_ts in metadata footer for thread replies", async () => {
    const slackCtx = createSlackMonitorContext({
      cfg: {
        channels: { slack: { enabled: true } },
      } as OpenClawConfig,
      accountId: "default",
      botToken: "token",
      app: { client: {} } as App,
      runtime: {} as RuntimeEnv,
      botUserId: "B1",
      teamId: "T1",
      apiAppId: "A1",
      historyLimit: 0,
      sessionScope: "per-sender",
      mainKey: "main",
      dmEnabled: true,
      dmPolicy: "open",
      allowFrom: [],
      groupDmEnabled: true,
      groupDmChannels: [],
      defaultRequireMention: true,
      groupPolicy: "open",
      useAccessGroups: false,
      reactionMode: "off",
      reactionAllowlist: [],
      replyToMode: "off",
      threadHistoryScope: "thread",
      threadInheritParent: false,
      slashCommand: {
        enabled: false,
        name: "openclaw",
        sessionPrefix: "slack:slash",
        ephemeral: true,
      },
      textLimit: 4000,
      ackReactionScope: "group-mentions",
      mediaMaxBytes: 1024,
      removeAckAfterReply: false,
    });
    // oxlint-disable-next-line typescript/no-explicit-any
    slackCtx.resolveUserName = async () => ({ name: "Alice" }) as any;

    const account: ResolvedSlackAccount = {
      accountId: "default",
      enabled: true,
      botTokenSource: "config",
      appTokenSource: "config",
      config: {},
    };

    // Thread reply with thread_ts
    const message: SlackMessageEvent = {
      channel: "C123",
      channel_type: "channel",
      user: "U1",
      text: "reply in thread",
      ts: "1234567890.000002",
      thread_ts: "1234567890.000001",
    } as SlackMessageEvent;

    const prepared = await prepareSlackMessage({
      ctx: slackCtx,
      account,
      message,
      opts: { source: "message" },
    });

    expect(prepared).toBeTruthy();
    expect(prepared!.ctxPayload.Body).toContain("thread_ts: 1234567890.000001");
    expect(prepared!.ctxPayload.Body).toMatch(
      /\[slack message id: 1234567890\.000002 channel: C123 thread_ts: 1234567890\.000001\]/,
    );
  });

  it("omits thread_ts from metadata footer for top-level messages", async () => {
    const slackCtx = createSlackMonitorContext({
      cfg: {
        channels: { slack: { enabled: true } },
      } as OpenClawConfig,
      accountId: "default",
      botToken: "token",
      app: { client: {} } as App,
      runtime: {} as RuntimeEnv,
      botUserId: "B1",
      teamId: "T1",
      apiAppId: "A1",
      historyLimit: 0,
      sessionScope: "per-sender",
      mainKey: "main",
      dmEnabled: true,
      dmPolicy: "open",
      allowFrom: [],
      groupDmEnabled: true,
      groupDmChannels: [],
      defaultRequireMention: true,
      groupPolicy: "open",
      useAccessGroups: false,
      reactionMode: "off",
      reactionAllowlist: [],
      replyToMode: "off",
      threadHistoryScope: "thread",
      threadInheritParent: false,
      slashCommand: {
        enabled: false,
        name: "openclaw",
        sessionPrefix: "slack:slash",
        ephemeral: true,
      },
      textLimit: 4000,
      ackReactionScope: "group-mentions",
      mediaMaxBytes: 1024,
      removeAckAfterReply: false,
    });
    // oxlint-disable-next-line typescript/no-explicit-any
    slackCtx.resolveUserName = async () => ({ name: "Alice" }) as any;

    const account: ResolvedSlackAccount = {
      accountId: "default",
      enabled: true,
      botTokenSource: "config",
      appTokenSource: "config",
      config: {},
    };

    // Top-level message (no thread_ts)
    const message: SlackMessageEvent = {
      channel: "C123",
      channel_type: "channel",
      user: "U1",
      text: "top level message",
      ts: "1234567890.000001",
    } as SlackMessageEvent;

    const prepared = await prepareSlackMessage({
      ctx: slackCtx,
      account,
      message,
      opts: { source: "message" },
    });

    expect(prepared).toBeTruthy();
    expect(prepared!.ctxPayload.Body).not.toContain("thread_ts:");
    expect(prepared!.ctxPayload.Body).toMatch(
      /\[slack message id: 1234567890\.000001 channel: C123\]$/m,
    );
  });

  it("includes thread_ts in thread starter metadata", async () => {
    const slackCtx = createSlackMonitorContext({
      cfg: {
        channels: { slack: { enabled: true } },
      } as OpenClawConfig,
      accountId: "default",
      botToken: "token",
      app: {
        client: {
          conversations: {
            // oxlint-disable-next-line typescript/no-explicit-any
            replies: async () => ({
              messages: [
                {
                  type: "message",
                  user: "U2",
                  text: "original thread starter",
                  ts: "1234567890.000001",
                },
              ],
            }),
          },
        },
        // oxlint-disable-next-line typescript/no-explicit-any
      } as any,
      runtime: {} as RuntimeEnv,
      botUserId: "B1",
      teamId: "T1",
      apiAppId: "A1",
      historyLimit: 0,
      sessionScope: "per-sender",
      mainKey: "main",
      dmEnabled: true,
      dmPolicy: "open",
      allowFrom: [],
      groupDmEnabled: true,
      groupDmChannels: [],
      defaultRequireMention: true,
      groupPolicy: "open",
      useAccessGroups: false,
      reactionMode: "off",
      reactionAllowlist: [],
      replyToMode: "off",
      threadHistoryScope: "thread",
      threadInheritParent: false,
      slashCommand: {
        enabled: false,
        name: "openclaw",
        sessionPrefix: "slack:slash",
        ephemeral: true,
      },
      textLimit: 4000,
      ackReactionScope: "group-mentions",
      mediaMaxBytes: 1024,
      removeAckAfterReply: false,
    });
    // oxlint-disable-next-line typescript/no-explicit-any
    slackCtx.resolveUserName = async () => ({ name: "Alice" }) as any;
    // oxlint-disable-next-line typescript/no-explicit-any
    slackCtx.resolveChannelName = async () => ({ name: "test-channel" }) as any;

    const account: ResolvedSlackAccount = {
      accountId: "default",
      enabled: true,
      botTokenSource: "config",
      appTokenSource: "config",
      config: {},
    };

    // Thread reply
    const message: SlackMessageEvent = {
      channel: "C123",
      channel_type: "channel",
      user: "U1",
      text: "reply in thread",
      ts: "1234567890.000002",
      thread_ts: "1234567890.000001",
    } as SlackMessageEvent;

    const prepared = await prepareSlackMessage({
      ctx: slackCtx,
      account,
      message,
      opts: { source: "message" },
    });

    expect(prepared).toBeTruthy();
    // Thread starter should include thread_ts
    expect(prepared!.ctxPayload.Body).toContain("original thread starter");
    expect(prepared!.ctxPayload.Body).toMatch(
      /original thread starter\n\[slack message id: 1234567890\.000001 channel: C123 thread_ts: 1234567890\.000001\]/,
    );
  });
});
