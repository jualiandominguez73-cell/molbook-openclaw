// @ts-nocheck
import { buildTelegramMessageContext } from "./bot-message-context.js";
import { dispatchTelegramMessage } from "./bot-message-dispatch.js";
import { diagnosticLogger as diag, logMessageQueued } from "../logging/diagnostic.js";

export const createTelegramMessageProcessor = (deps) => {
  const {
    bot,
    cfg,
    account,
    telegramCfg,
    historyLimit,
    groupHistories,
    dmPolicy,
    allowFrom,
    groupAllowFrom,
    ackReactionScope,
    logger,
    resolveGroupActivation,
    resolveGroupRequireMention,
    resolveTelegramGroupConfig,
    runtime,
    replyToMode,
    streamMode,
    textLimit,
    opts,
    resolveBotTopicsEnabled,
  } = deps;

  return async (primaryCtx, allMedia, storeAllowFrom, options) => {
    const chatId = primaryCtx?.message?.chat?.id ?? primaryCtx?.chat?.id ?? 'unknown';
    const messageId = primaryCtx?.message?.message_id ?? 'unknown';
    const startTime = Date.now();
    
    diag.info(`processMessage start: chatId=${chatId} messageId=${messageId} mediaCount=${allMedia?.length ?? 0}`);
    
    try {
      const context = await buildTelegramMessageContext({
        primaryCtx,
        allMedia,
        storeAllowFrom,
        options,
        bot,
        cfg,
        account,
        historyLimit,
        groupHistories,
        dmPolicy,
        allowFrom,
        groupAllowFrom,
        ackReactionScope,
        logger,
        resolveGroupActivation,
        resolveGroupRequireMention,
        resolveTelegramGroupConfig,
      });
      
      if (!context) {
        diag.debug(`processMessage skipped: chatId=${chatId} messageId=${messageId} reason=no_context`);
        return;
      }
      
      const sessionKey = context?.route?.sessionKey ?? 'unknown';
      diag.info(`processMessage dispatching: chatId=${chatId} messageId=${messageId} sessionKey=${sessionKey}`);
      logMessageQueued(sessionKey, 'telegram');
      
      await dispatchTelegramMessage({
        context,
        bot,
        cfg,
        runtime,
        replyToMode,
        streamMode,
        textLimit,
        telegramCfg,
        opts,
        resolveBotTopicsEnabled,
      });
      
      const durationMs = Date.now() - startTime;
      diag.info(`processMessage complete: chatId=${chatId} messageId=${messageId} sessionKey=${sessionKey} durationMs=${durationMs}`);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      diag.error(`processMessage error: chatId=${chatId} messageId=${messageId} durationMs=${durationMs} error="${String(err)}"`);
      throw err;
    }
  };
};
