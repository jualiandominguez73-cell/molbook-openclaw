import { describe, expect, it } from "vitest";
import { parseInlineDirectives } from "./directive-tags.js";

describe("parseInlineDirectives", () => {
  // --- empty / missing input ---
  it("returns defaults for undefined input", () => {
    const result = parseInlineDirectives(undefined);
    expect(result).toEqual({
      text: "",
      audioAsVoice: false,
      replyToCurrent: false,
      hasAudioTag: false,
      hasReplyTag: false,
    });
  });

  it("returns defaults for empty string", () => {
    const result = parseInlineDirectives("");
    expect(result).toEqual({
      text: "",
      audioAsVoice: false,
      replyToCurrent: false,
      hasAudioTag: false,
      hasReplyTag: false,
    });
  });

  // --- audio_as_voice tag ---
  it("detects [[audio_as_voice]] tag", () => {
    const result = parseInlineDirectives("hello [[ audio_as_voice ]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.hasAudioTag).toBe(true);
    expect(result.text).toBe("hello world");
  });

  it("strips audio tag by default", () => {
    const result = parseInlineDirectives("play [[audio_as_voice]] now");
    expect(result.text).not.toContain("audio_as_voice");
  });

  it("preserves audio tag when stripAudioTag is false", () => {
    const result = parseInlineDirectives("play [[audio_as_voice]] now", {
      stripAudioTag: false,
    });
    expect(result.text).toContain("audio_as_voice");
    expect(result.audioAsVoice).toBe(true);
  });

  it("handles audio tag case-insensitively", () => {
    const result = parseInlineDirectives("[[AUDIO_AS_VOICE]]");
    expect(result.audioAsVoice).toBe(true);
    expect(result.hasAudioTag).toBe(true);
  });

  // --- reply_to_current tag ---
  it("detects [[reply_to_current]] tag", () => {
    const result = parseInlineDirectives("[[reply_to_current]] response", {
      currentMessageId: "msg-123",
    });
    expect(result.replyToCurrent).toBe(true);
    expect(result.hasReplyTag).toBe(true);
    expect(result.replyToId).toBe("msg-123");
  });

  it("strips reply tag by default", () => {
    const result = parseInlineDirectives("[[reply_to_current]] text");
    expect(result.text).not.toContain("reply_to_current");
  });

  it("preserves reply tag when stripReplyTags is false", () => {
    const result = parseInlineDirectives("[[reply_to_current]] text", {
      stripReplyTags: false,
    });
    expect(result.text).toContain("reply_to_current");
  });

  it("returns undefined replyToId when no currentMessageId provided", () => {
    const result = parseInlineDirectives("[[reply_to_current]] text");
    expect(result.replyToCurrent).toBe(true);
    expect(result.replyToId).toBeUndefined();
  });

  // --- reply_to:<id> tag ---
  it("detects [[reply_to: <id>]] tag", () => {
    const result = parseInlineDirectives("[[reply_to: msg-456]] response");
    expect(result.hasReplyTag).toBe(true);
    expect(result.replyToId).toBe("msg-456");
    expect(result.replyToExplicitId).toBe("msg-456");
    expect(result.replyToCurrent).toBe(false);
  });

  it("trims whitespace in explicit reply_to id", () => {
    const result = parseInlineDirectives("[[reply_to:  abc  ]] text");
    expect(result.replyToExplicitId).toBe("abc");
  });

  // --- multiple tags ---
  it("handles both audio and reply tags", () => {
    const result = parseInlineDirectives("[[audio_as_voice]] hello [[reply_to_current]] world", {
      currentMessageId: "msg-1",
    });
    expect(result.audioAsVoice).toBe(true);
    expect(result.replyToCurrent).toBe(true);
    expect(result.replyToId).toBe("msg-1");
    expect(result.text).toBe("hello world");
  });

  it("explicit reply_to wins over reply_to_current for replyToId", () => {
    const result = parseInlineDirectives("[[reply_to_current]] [[reply_to: explicit-id]] text", {
      currentMessageId: "msg-current",
    });
    expect(result.replyToId).toBe("explicit-id");
    expect(result.replyToCurrent).toBe(true);
    expect(result.replyToExplicitId).toBe("explicit-id");
  });

  // --- whitespace normalization ---
  it("normalizes excessive whitespace", () => {
    const result = parseInlineDirectives("  hello   world  ");
    expect(result.text).toBe("hello world");
  });

  it("normalizes whitespace around newlines", () => {
    const result = parseInlineDirectives("hello  \n  world");
    expect(result.text).toBe("hello\nworld");
  });

  // --- plain text (no directives) ---
  it("passes through plain text unchanged (after whitespace normalization)", () => {
    const result = parseInlineDirectives("just a normal message");
    expect(result.text).toBe("just a normal message");
    expect(result.audioAsVoice).toBe(false);
    expect(result.hasAudioTag).toBe(false);
    expect(result.hasReplyTag).toBe(false);
    expect(result.replyToCurrent).toBe(false);
  });
});
