/**
 * Minimal tool compatibility filter for provider switching.
 * Only filters messages when specific tool compatibility errors occur.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";


/**
 * Simple filter to remove orphaned tool results when switching providers.
 * Reuses OpenClaw's existing tool format handling logic.
 */
/**
 * Extract tool calls from assistant message using OpenClaw's existing logic.
 * Based on extractToolCallsFromAssistant from session-transcript-repair.ts
 */
function extractToolCallsFromMessage(msg: Extract<AgentMessage, { role: "assistant" }>): Array<{ id: string }> {
  const content = msg.content;
  if (!Array.isArray(content)) {
    return [];
  }

  const toolCalls: Array<{ id: string }> = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as { type?: unknown; id?: unknown };
    if (typeof rec.id !== "string" || !rec.id) {
      continue;
    }

    // Support multiple provider formats: toolCall (OpenAI), toolUse (Anthropic), functionCall (Google)
    if (rec.type === "toolCall" || rec.type === "toolUse" || rec.type === "functionCall" || rec.type === "tool_use") {
      toolCalls.push({ id: rec.id });
    }
  }
  return toolCalls;
}

/**
 * Extract tool result ID using OpenClaw's existing logic.
 * Based on extractToolResultId from session-transcript-repair.ts
 */
function extractToolResultIdFromMessage(msg: Extract<AgentMessage, { role: "toolResult" }>): string | null {
  // OpenAI format
  const toolCallId = (msg as { toolCallId?: unknown }).toolCallId;
  if (typeof toolCallId === "string" && toolCallId) {
    return toolCallId;
  }
  // Anthropic format  
  const toolUseId = (msg as { toolUseId?: unknown }).toolUseId;
  if (typeof toolUseId === "string" && toolUseId) {
    return toolUseId;
  }
  return null;
}

export function filterOrphanedToolResults(messages: AgentMessage[]): { filtered: AgentMessage[], removedCount: number } {
  const result: AgentMessage[] = [];
  const availableToolCalls = new Set<string>();
  let removedCount = 0;
  
  // First pass: collect all tool call IDs using OpenClaw's existing logic
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      continue;
    }
    
    const role = (msg as { role?: string }).role;
    if (role === "assistant") {
      const assistantMsg = msg as Extract<AgentMessage, { role: "assistant" }>;
      const toolCalls = extractToolCallsFromMessage(assistantMsg);
      for (const toolCall of toolCalls) {
        availableToolCalls.add(toolCall.id);
      }
    }
  }
  
  // Second pass: filter out orphaned tool results
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      result.push(msg);
      continue;
    }
    
    const role = (msg as { role?: string }).role;
    
    // Check tool results using OpenClaw's existing logic
    if (role === "tool" || role === "toolResult") {
      const toolMsg = msg as Extract<AgentMessage, { role: "toolResult" }>;
      const toolCallId = extractToolResultIdFromMessage(toolMsg);
      
      // Only keep if we have a matching tool call
      if (toolCallId && availableToolCalls.has(toolCallId)) {
        result.push(msg);
      } else {
        removedCount++;
      }
    } else {
      // Keep all non-tool messages
      result.push(msg);
    }
  }
  
  return { filtered: result, removedCount };
}