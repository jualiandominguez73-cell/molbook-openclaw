import { describe, expect, it } from "vitest";
import { stripReasoningTagsFromText } from "./reasoning-tags.js";

describe("stripReasoningTagsFromText", () => {
  it("strips paired think tags", () => {
    const input = "<think>reasoning here</think>actual response";
    expect(stripReasoningTagsFromText(input)).toBe("actual response");
  });

  it("strips nested think tags", () => {
    const input = "<think>outer<think>inner</think></think>response";
    expect(stripReasoningTagsFromText(input)).toBe("response");
  });

  it("handles orphaned closing tag at start (model compliance issue)", () => {
    // Kimi K2.5 sometimes outputs reasoning without opening tag
    const input = " The user wants me to say hi briefly. </think> Hey, fresh session started.";
    expect(stripReasoningTagsFromText(input)).toBe("Hey, fresh session started.");
  });

  it("handles orphaned closing tag with longer reasoning", () => {
    const input = `Looking at the runtime info:
- Runtime model: ollama-cloud/kimi-k2.5:cloud
- Default model: ollama-cloud/kimi-k2.5:cloud

They're the same, so I don't need to mention the default model.

I should keep it brief and friendly. </think> Hey, what's up?`;
    expect(stripReasoningTagsFromText(input)).toBe("Hey, what's up?");
  });

  it("preserves content when no tags present", () => {
    const input = "Just a normal response without any tags.";
    expect(stripReasoningTagsFromText(input)).toBe("Just a normal response without any tags.");
  });

  it("handles multiple think blocks", () => {
    const input = "<think>first</think>response<think>second</think>more";
    expect(stripReasoningTagsFromText(input)).toBe("responsemore");
  });

  it("strips final tags", () => {
    const input = "<final>content</final>";
    expect(stripReasoningTagsFromText(input)).toBe("content");
  });

  it("handles mixed think and final tags", () => {
    const input = "<think>reasoning</think><final>answer</final>";
    expect(stripReasoningTagsFromText(input)).toBe("answer");
  });

  it("does not strip orphaned close tag far from start", () => {
    // If the closing tag is far from the start (>500 chars), don't treat as orphaned
    const padding = "x".repeat(600);
    const input = `${padding}</think>response`;
    // Should keep the padding since it's too far to be considered orphaned reasoning
    expect(stripReasoningTagsFromText(input)).toContain(padding);
  });

  it("handles thinking variant tag", () => {
    const input = "<thinking>reasoning</thinking>response";
    expect(stripReasoningTagsFromText(input)).toBe("response");
  });

  it("handles thought variant tag", () => {
    const input = "<thought>reasoning</thought>response";
    expect(stripReasoningTagsFromText(input)).toBe("response");
  });
});
