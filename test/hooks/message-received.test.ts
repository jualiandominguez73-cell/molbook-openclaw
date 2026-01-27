/**
 * Tests for message:received hook event
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  registerInternalHook,
  unregisterInternalHook,
  clearInternalHooks,
  createInternalHookEvent,
  triggerInternalHook,
} from "../../src/hooks/internal-hooks.js";

describe("message:received hook event", () => {
  beforeEach(() => {
    clearInternalHooks();
  });

  afterEach(() => {
    clearInternalHooks();
  });

  it("triggers handler on message:received event", async () => {
    const handler = vi.fn();
    registerInternalHook("message:received", handler);

    const event = createInternalHookEvent("message", "received", "test-session", {
      senderId: "user123",
      channel: "telegram",
      messageBody: "Hello",
      timestamp: Date.now(),
    });

    await triggerInternalHook(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("includes message context in event", async () => {
    let capturedEvent: any = null;
    const handler = vi.fn((event) => {
      capturedEvent = event;
    });
    registerInternalHook("message:received", handler);

    const event = createInternalHookEvent("message", "received", "agent:main:dm:user123", {
      senderId: "user123",
      channel: "telegram",
      messageBody: "Test message content",
      timestamp: 1234567890,
    });

    await triggerInternalHook(event);

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe("message");
    expect(capturedEvent.action).toBe("received");
    expect(capturedEvent.sessionKey).toBe("agent:main:dm:user123");
    expect(capturedEvent.context.senderId).toBe("user123");
    expect(capturedEvent.context.channel).toBe("telegram");
    expect(capturedEvent.context.messageBody).toBe("Test message content");
    expect(capturedEvent.context.timestamp).toBe(1234567890);
  });

  it("allows multiple handlers for message:received", async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    registerInternalHook("message:received", handler1);
    registerInternalHook("message:received", handler2);

    const event = createInternalHookEvent("message", "received", "test-session", {});
    await triggerInternalHook(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("also triggers general message type handler", async () => {
    const generalHandler = vi.fn();
    const specificHandler = vi.fn();
    
    registerInternalHook("message", generalHandler);
    registerInternalHook("message:received", specificHandler);

    const event = createInternalHookEvent("message", "received", "test-session", {});
    await triggerInternalHook(event);

    expect(generalHandler).toHaveBeenCalledTimes(1);
    expect(specificHandler).toHaveBeenCalledTimes(1);
  });

  it("does not throw if handler errors", async () => {
    const failingHandler = vi.fn(() => {
      throw new Error("Handler error");
    });
    registerInternalHook("message:received", failingHandler);

    const event = createInternalHookEvent("message", "received", "test-session", {});
    
    // Should not throw
    await expect(triggerInternalHook(event)).resolves.not.toThrow();
  });

  it("continues to other handlers if one fails", async () => {
    const failingHandler = vi.fn(() => {
      throw new Error("First handler error");
    });
    const successHandler = vi.fn();
    
    registerInternalHook("message:received", failingHandler);
    registerInternalHook("message:received", successHandler);

    const event = createInternalHookEvent("message", "received", "test-session", {});
    await triggerInternalHook(event);

    expect(failingHandler).toHaveBeenCalled();
    expect(successHandler).toHaveBeenCalled();
  });
});
