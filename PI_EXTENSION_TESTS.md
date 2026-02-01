# TDD Test Suite: openclaw-router Extension

**Status:** Test Specifications (RED phase)  
**Purpose:** Define behavior BEFORE implementation

---

## Test Suites

### 1. Message Channel Selection Tests

```typescript
describe("selectOptimalChannel", () => {
  it("should select Discord for code blocks", () => {
    const message = "Here's the fix:\n```typescript\nconst x = 1;\n```";
    expect(selectOptimalChannel(message)).toBe("discord");
  });

  it("should select Discord for threaded messages", () => {
    const message = "Main point → Related point → Action";
    expect(selectOptimalChannel(message)).toBe("discord");
  });

  it("should select Slack for long professional messages", () => {
    const message = "Lorem ipsum ".repeat(50); // > 500 chars
    expect(selectOptimalChannel(message)).toBe("slack");
  });

  it("should select Telegram for short messages", () => {
    const message = "Quick update: done!";
    expect(selectOptimalChannel(message)).toBe("telegram");
  });

  it("should select WhatsApp for very short messages", () => {
    const message = "Yes";
    expect(selectOptimalChannel(message)).toBe("whatsapp");
  });

  it("should respect user preferences when provided", () => {
    const message = "Short";
    expect(selectOptimalChannel(message, ["slack"])).toBe("slack");
  });

  it("should handle links preferentially for Discord", () => {
    const message = "Check https://example.com for details";
    expect(selectOptimalChannel(message)).toBe("discord");
  });

  it("should score multiple characteristics", () => {
    const message = "Long message with code:\n```\ncode\n```\nand https://link.com";
    const channel = selectOptimalChannel(message);
    expect(["discord", "slack"]).toContain(channel);
  });
});
```

### 2. Message Format Adaptation Tests

```typescript
describe("formatForChannel", () => {
  const message = "**Bold** `code` ```\ntypescript\nfunction test() {}\n```";

  describe("Discord formatting", () => {
    it("should preserve Markdown", () => {
      const formatted = formatForChannel(message, "discord");
      expect(formatted).toContain("**Bold**");
    });

    it("should add language hint to code blocks", () => {
      const formatted = formatForChannel(message, "discord");
      expect(formatted).toContain("```typescript");
    });

    it("should handle no code blocks", () => {
      const simple = "Just text";
      expect(formatForChannel(simple, "discord")).toBe("Just text");
    });
  });

  describe("Slack formatting", () => {
    it("should limit message length to 4000 chars", () => {
      const long = "x".repeat(5000);
      const formatted = formatForChannel(long, "slack");
      expect(formatted.length).toBeLessThanOrEqual(4000);
    });

    it("should convert code blocks to snippets", () => {
      const formatted = formatForChannel(message, "slack");
      expect(formatted).toContain("```");
    });
  });

  describe("Telegram formatting", () => {
    it("should limit message length to 4096 chars", () => {
      const long = "x".repeat(5000);
      const formatted = formatForChannel(long, "telegram");
      expect(formatted.length).toBeLessThanOrEqual(4096);
    });

    it("should convert markdown to HTML", () => {
      const formatted = formatForChannel(message, "telegram");
      expect(formatted).toContain("<code>");
    });
  });

  describe("WhatsApp formatting", () => {
    it("should limit message length to 4096 chars", () => {
      const long = "x".repeat(5000);
      const formatted = formatForChannel(long, "whatsapp");
      expect(formatted.length).toBeLessThanOrEqual(4096);
    });

    it("should remove all Markdown", () => {
      const formatted = formatForChannel(message, "whatsapp");
      expect(formatted).not.toContain("**");
      expect(formatted).not.toContain("`");
    });
  });
});
```

### 3. Priority Handling Tests

```typescript
describe("Priority Routing", () => {
  it("should route urgent messages immediately", async () => {
    const spy = vi.fn();
    const router = new OpenClawRouter({ onSend: spy });

    await router.routeMessage({
      content: "Urgent!",
      priority: "urgent",
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      immediate: true,
    }));
  });

  it("should batch bulk messages", async () => {
    const spy = vi.fn();
    const router = new OpenClawRouter({ onSend: spy });

    await router.routeMessage({
      content: "Item 1",
      priority: "bulk",
    });

    // Simulate batching delay
    await new Promise(r => setTimeout(r, 10));

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      batched: true,
    }));
  });

  it("should apply backoff to failed urgent messages", async () => {
    const router = new OpenClawRouter({ 
      onSend: async () => { throw new Error("Failed"); }
    });

    const result = await router.routeMessage({
      content: "Urgent",
      priority: "urgent",
    });

    expect(result.status).toBe("retry");
    expect(result.nextRetryMs).toBeGreaterThan(0);
  });
});
```

### 4. Delivery Orchestration Tests

```typescript
describe("Delivery Orchestration", () => {
  it("should attempt delivery to all channels", async () => {
    const channels = ["discord", "slack", "telegram"];
    const results = new Map();

    for (const channel of channels) {
      const result = await router.routeMessage({
        content: "Test",
        channels: [channel],
      });
      results.set(channel, result);
    }

    expect(results.size).toBe(3);
    for (const result of results.values()) {
      expect(["delivered", "failed"]).toContain(result.status);
    }
  });

  it("should handle partial failures", async () => {
    const router = new OpenClawRouter({
      onSend: (channel) => {
        if (channel === "discord") throw new Error("Down");
        return Promise.resolve();
      }
    });

    const result = await router.routeMessage({
      content: "Test",
      channels: ["discord", "slack", "telegram"],
    });

    expect(result.status).toBe("partial");
    expect(result.channels.discord).toBe("failed");
    expect(result.channels.slack).toBe("delivered");
  });

  it("should retry failed deliveries with exponential backoff", async () => {
    let attempts = 0;
    const router = new OpenClawRouter({
      onSend: () => {
        attempts++;
        if (attempts < 3) throw new Error("Temp failure");
        return Promise.resolve();
      }
    });

    const result = await router.routeMessage({
      content: "Test",
      retryStrategy: "exponential",
    });

    expect(result.status).toBe("delivered");
    expect(attempts).toBeGreaterThanOrEqual(3);
  });

  it("should timeout on slow deliveries", async () => {
    const router = new OpenClawRouter({
      onSend: () => new Promise(r => setTimeout(r, 10000)),
      timeout: 100,
    });

    const result = await router.routeMessage({
      content: "Test",
    });

    expect(result.status).toBe("timeout");
  });
});
```

### 5. Integration Tests

```typescript
describe("Integration with Pi", () => {
  it("should register as valid Pi tool", async () => {
    const tool = createOpenClawRouterTool();

    expect(tool.name).toBe("openclaw-router");
    expect(tool.parameters).toBeDefined();
    expect(tool.execute).toBeInstanceOf(Function);
  });

  it("should handle Pi parameter validation", async () => {
    const tool = createOpenClawRouterTool();

    const result = await tool.execute({
      message: "Test",
      priority: "normal",
      preferredChannels: ["discord"],
    });

    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("channels");
  });

  it("should integrate with OpenClaw message queue", async () => {
    const router = new OpenClawRouter({
      messageQueue: mockQueue,
    });

    await router.routeMessage({ content: "Test" });

    expect(mockQueue.push).toHaveBeenCalled();
  });
});
```

### 6. Error Handling Tests

```typescript
describe("Error Handling", () => {
  it("should gracefully handle missing channels", async () => {
    const result = await router.routeMessage({
      cont
