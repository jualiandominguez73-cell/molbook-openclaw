// Bedrock proxy server: converts Anthropic API format to Bedrock format
// and signs requests with AWS Signature V4

import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import express from "express";
import type { Request, Response } from "express";

// Use inference profile ID format (required for on-demand throughput)
// Pattern: us.anthropic.claude-{version}
// For Sonnet 4.5, try the inference profile ID pattern
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const BEDROCK_REGION = process.env.AWS_REGION || "us-east-1";
const PROXY_PORT = 18794;

const client = new BedrockRuntimeClient({
  region: BEDROCK_REGION,
  credentials: fromIni({ profile: process.env.AWS_PROFILE || "bedrock-clawdis" }),
});

const app = express();
app.use(express.json({ limit: "10mb" }));

// ============================================================================
// XML Tool Call Parser
// ============================================================================
// When the model outputs XML tool calls as text (due to system prompt influence),
// we parse them and convert to native tool_use format.

interface ParsedToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Parse XML tool calls from text content.
 * Handles formats like:
 * <function_calls>
 *   <invoke name="write">
 *     <parameter name="path">/some/path.md</parameter>
 *     <parameter name="content">Some content</parameter>
 *   </invoke>
 * </function_calls>
 * 
 * Also handles truncated/unclosed tags (when response is cut off by max_tokens)
 */
function parseXmlToolCalls(text: string): { toolCalls: ParsedToolCall[]; remainingText: string } {
  const toolCalls: ParsedToolCall[] = [];
  let remainingText = text;
  const blocks: string[] = [];

  // First try to match complete <function_calls>...</function_calls> blocks
  const functionCallsRegex = /<function_?calls\s*>([\s\S]*?)<\/function_?calls\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = functionCallsRegex.exec(text)) !== null) {
    blocks.push(match[1]);
    remainingText = remainingText.replace(match[0], "");
  }

  // If no complete blocks found, try to find unclosed <function_calls> (truncated response)
  if (blocks.length === 0) {
    const unclosedMatch = /<function_?calls\s*>([\s\S]*)$/i.exec(text);
    if (unclosedMatch) {
      blocks.push(unclosedMatch[1]);
      remainingText = text.substring(0, unclosedMatch.index);
      console.log("[bedrock-proxy] Found unclosed <function_calls> block (truncated response)");
    }
  }

  if (blocks.length === 0) {
    return { toolCalls, remainingText: text };
  }

  for (const blockContent of blocks) {
    // Match <invoke> tags within the block (complete or unclosed)
    // First try complete invoke tags
    const invokeRegex = /<invoke\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/invoke\s*>/gi;
    let invokeMatch: RegExpExecArray | null;
    let lastIndex = 0;

    while ((invokeMatch = invokeRegex.exec(blockContent)) !== null) {
      const toolName = invokeMatch[1];
      const invokeContent = invokeMatch[2];
      const input = parseInvokeParameters(invokeContent);
      lastIndex = invokeRegex.lastIndex;
      if (Object.keys(input).length > 0) {
        toolCalls.push({ name: toolName, input });
      }
    }

    // If we didn't find any complete invoke tags, or there might be a trailing unclosed one
    const trailing = blockContent.slice(lastIndex);
    const unclosedInvokeMatch = /<invoke\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*)$/i.exec(trailing);
    if (unclosedInvokeMatch) {
      const toolName = unclosedInvokeMatch[1];
      const invokeContent = unclosedInvokeMatch[2];
      const input = parseInvokeParameters(invokeContent);
      if (Object.keys(input).length > 0) {
        toolCalls.push({ name: toolName, input });
        console.log("[bedrock-proxy] Parsed unclosed <invoke> tag for tool:", toolName);
      }
    }
  }

  // Clean up remaining text
  remainingText = remainingText.replace(/\n{3,}/g, "\n\n").trim();

  return { toolCalls, remainingText };
}

/**
 * Parse parameters from invoke content (handles both complete and unclosed parameter tags)
 */
function parseInvokeParameters(invokeContent: string): Record<string, unknown> {
  const input: Record<string, unknown> = {};

  // Match complete <parameter> tags
  const paramRegex = /<parameter\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/parameter\s*>/gi;
  let paramMatch: RegExpExecArray | null;

  while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
    const paramName = paramMatch[1];
    const paramValue = parseParameterValue(paramMatch[2]);
    input[paramName] = paramValue;
  }

  // If we found some parameters but there might be an unclosed one at the end
  // Try to find unclosed parameter (truncated)
  const lastClosingParam = invokeContent.lastIndexOf("</parameter>");
  const afterLastParam = lastClosingParam >= 0 ? invokeContent.substring(lastClosingParam + 12) : invokeContent;
  
  const unclosedParamMatch = /<parameter\s+name\s*=\s*["']([^"']+)["']\s*>([\s\S]*)$/i.exec(afterLastParam);
  if (unclosedParamMatch) {
    const paramName = unclosedParamMatch[1];
    // For unclosed parameters, take the content as-is (it's truncated)
    const paramValue = unclosedParamMatch[2].trim();
    if (paramValue) {
      input[paramName] = paramValue;
      console.log("[bedrock-proxy] Parsed unclosed <parameter> for:", paramName, "(truncated value)");
    }
  }

  return input;
}

/**
 * Parse parameter value with type conversion
 */
function parseParameterValue(rawValue: string): unknown {
  const trimmed = rawValue.trim();
  
  // Try to parse as JSON if it looks like JSON
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Keep as string
    }
  }
  
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  
  return trimmed;
}

/**
 * Convert parsed tool calls to Anthropic tool_use content blocks
 */
function convertToToolUseBlocks(toolCalls: ParsedToolCall[]): Array<{ type: "tool_use"; id: string; name: string; input: Record<string, unknown> }> {
  return toolCalls.map((tc, idx) => ({
    type: "tool_use" as const,
    id: `toolu_parsed_${Date.now()}_${idx}`,
    name: tc.name,
    input: tc.input,
  }));
}

/**
 * Process response content: extract XML tool calls and convert to native format
 */
function processResponseContent(content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>): {
  processedContent: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
  hasToolUse: boolean;
} {
  const processedContent: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> = [];
  let hasToolUse = false;

  for (const block of content) {
    if (block.type === "text" && block.text) {
      const { toolCalls, remainingText } = parseXmlToolCalls(block.text);
      
      if (toolCalls.length > 0) {
        hasToolUse = true;
        console.log(`[bedrock-proxy] Parsed ${toolCalls.length} XML tool call(s) from text`);
        
        // Add remaining text if any
        if (remainingText) {
          processedContent.push({ type: "text", text: remainingText });
        }
        
        // Add converted tool_use blocks
        const toolUseBlocks = convertToToolUseBlocks(toolCalls);
        processedContent.push(...toolUseBlocks);
      } else {
        // No XML tool calls found, keep original text
        processedContent.push(block);
      }
    } else if (block.type === "tool_use") {
      // Already a native tool_use block
      hasToolUse = true;
      processedContent.push(block);
    } else {
      processedContent.push(block);
    }
  }

  return { processedContent, hasToolUse };
}

// Proxy Anthropic Messages API to Bedrock
app.post("/v1/messages", async (req: Request, res: Response) => {
  try {
    // Convert Anthropic Messages format to Bedrock format
    const anthropicBody = req.body;
    const wantsStream = anthropicBody.stream === true || req.headers.accept?.includes("text/event-stream");
    const bodyKeys = Object.keys(anthropicBody || {});
    const hasTools = Array.isArray(anthropicBody.tools) && anthropicBody.tools.length > 0;
    const toolCount = anthropicBody.tools?.length || 0;
    const toolChoice = anthropicBody.tool_choice;
    console.log(
      "[bedrock-proxy] received request keys:",
      bodyKeys,
      "stream:",
      wantsStream,
      "hasTools:",
      hasTools,
      "toolCount:",
      toolCount,
      "tool_choice:",
      toolChoice,
    );
    
    // Bedrock expects a specific format for Claude models
    const bedrockBody: Record<string, unknown> = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: anthropicBody.max_tokens || 8192,
      messages: anthropicBody.messages || [],
    };
    
    if (anthropicBody.system) {
      bedrockBody.system = anthropicBody.system;
    }
    if (anthropicBody.temperature !== undefined) {
      bedrockBody.temperature = anthropicBody.temperature;
    }
    if (anthropicBody.top_p !== undefined) {
      bedrockBody.top_p = anthropicBody.top_p;
    }
    if (anthropicBody.top_k !== undefined) {
      bedrockBody.top_k = anthropicBody.top_k;
    }
    if (anthropicBody.stop_sequences) {
      bedrockBody.stop_sequences = anthropicBody.stop_sequences;
    }
    // Pass through tools and tool_choice so the model can actually call tools
    if (Array.isArray(anthropicBody.tools) && anthropicBody.tools.length > 0) {
      bedrockBody.tools = anthropicBody.tools;
      // Use tool_choice "auto" - model can choose between tool call and text response
      // Note: With the current system prompt from pi-coding-agent, the model may still
      // prefer XML text format. This is a known limitation.
      if (!anthropicBody.tool_choice) {
        bedrockBody.tool_choice = { type: "auto" };
      }
    }
    if (anthropicBody.tool_choice) {
      bedrockBody.tool_choice = anthropicBody.tool_choice;
    }

    const bedrockHasTools = Array.isArray(bedrockBody.tools) && (bedrockBody.tools as unknown[]).length > 0;
    console.log("[bedrock-proxy] sending to Bedrock hasTools:", bedrockHasTools, "toolChoice:", bedrockBody.tool_choice);
    if (bedrockHasTools) {
      console.log("[bedrock-proxy] first tool sample:", JSON.stringify((bedrockBody.tools as unknown[])[0], null, 2));
    }
    // Log full request body for debugging - check if tools are present
    const bodyStr = JSON.stringify(bedrockBody, null, 2);
    console.log("[bedrock-proxy] FULL REQUEST BODY length:", bodyStr.length, "has 'tools' key:", Object.keys(bedrockBody).includes("tools"));
    console.log("[bedrock-proxy] bedrockBody keys:", Object.keys(bedrockBody));
    // Log system prompt to check for XML instructions
    if (bedrockBody.system) {
      const sysStr = typeof bedrockBody.system === "string" ? bedrockBody.system : JSON.stringify(bedrockBody.system);
      console.log("[bedrock-proxy] system prompt (first 2000 chars):", sysStr.substring(0, 2000));
    }

    // For now, always use non-streaming (InvokeModelCommand)
    // Bedrock streaming requires InvokeModelWithResponseStreamCommand and SSE conversion
    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(bedrockBody),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log("[bedrock-proxy] Bedrock raw response:", JSON.stringify(responseBody, null, 2).substring(0, 500));

    // Process content: extract XML tool calls and convert to native tool_use format
    const originalContent = responseBody.content || [];
    const { processedContent, hasToolUse } = processResponseContent(originalContent);
    
    // If we parsed XML tool calls, update stop_reason to "tool_use"
    const effectiveStopReason = hasToolUse ? "tool_use" : responseBody.stop_reason;
    
    console.log("[bedrock-proxy] Processed content:", JSON.stringify(processedContent, null, 2).substring(0, 500));
    console.log("[bedrock-proxy] hasToolUse:", hasToolUse, "effectiveStopReason:", effectiveStopReason);

    // Normalize usage - pi-ai expects Anthropic format with input_tokens, output_tokens
    // Bedrock returns input_tokens but not output_tokens - we need to estimate
    const bedrockUsage = responseBody.usage || {};
    const inputTokens = bedrockUsage.input_tokens || bedrockUsage.cache_creation_input_tokens || 0;
    // Bedrock doesn't return output_tokens directly, estimate from content length
    const contentText = originalContent?.map((c: { text?: string }) => c.text || "").join("") || "";
    const estimatedOutputTokens = Math.max(0, Math.ceil(contentText.length / 4));
    const outputTokens = bedrockUsage.output_tokens || estimatedOutputTokens;
    
    // pi-ai expects Anthropic format: input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
    const normalizedUsage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: bedrockUsage.cache_read_input_tokens || 0,
      cache_creation_input_tokens: bedrockUsage.cache_creation_input_tokens || 0,
    };

    // Convert Bedrock response back to Anthropic format
    // Anthropic Messages API format: https://docs.anthropic.com/claude/reference/messages_post
    const anthropicResponse = {
      id: responseBody.id || `msg_${Date.now()}`,
      type: "message",
      role: "assistant",
      content: processedContent,
      model: BEDROCK_MODEL_ID,
      stop_reason: effectiveStopReason,
      stop_sequence: responseBody.stop_sequence || null,
      usage: normalizedUsage,
    };

    console.log("[bedrock-proxy] sending response:", JSON.stringify(anthropicResponse, null, 2).substring(0, 500));
    
    // If streaming was requested, convert to SSE format
    if (wantsStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      // Send initial message_start event - pi-ai reads usage from here: event.message.usage.input_tokens
      const usageForStart = anthropicResponse.usage || { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
      res.write(`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: anthropicResponse.id, type: "message", role: "assistant", content: [], model: anthropicResponse.model, usage: usageForStart } })}\n\n`);
      
      // Send content_block_start for each block (text or tool_use)
      if (anthropicResponse.content && anthropicResponse.content.length > 0) {
        let blockIndex = 0;
        for (const block of anthropicResponse.content) {
          if (block.type === "text") {
            res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: blockIndex, content_block: { type: "text", text: "" } })}\n\n`);
            
            // Send content_block_delta events (chunk the text)
            const text = block.text || "";
            const chunkSize = 10; // Small chunks for streaming effect
            for (let i = 0; i < text.length; i += chunkSize) {
              const chunk = text.slice(i, i + chunkSize);
              res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: blockIndex, delta: { type: "text_delta", text: chunk } })}\n\n`);
            }
            
            res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: blockIndex })}\n\n`);
            blockIndex++;
          } else if (block.type === "tool_use") {
            // Send tool_use block - pi-ai expects this format for tool calls
            res.write(`event: content_block_start\ndata: ${JSON.stringify({ 
              type: "content_block_start", 
              index: blockIndex, 
              content_block: { 
                type: "tool_use", 
                id: block.id, 
                name: block.name, 
                input: {} 
              } 
            })}\n\n`);
            
            // Send the input as a delta (JSON string)
            const inputJson = JSON.stringify(block.input || {});
            res.write(`event: content_block_delta\ndata: ${JSON.stringify({ 
              type: "content_block_delta", 
              index: blockIndex, 
              delta: { 
                type: "input_json_delta", 
                partial_json: inputJson 
              } 
            })}\n\n`);
            
            res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: blockIndex })}\n\n`);
            blockIndex++;
          }
        }
      }
      
      // Send message_delta with stop_reason and usage (Anthropic sends usage in message_delta)
      // pi-ai expects input_tokens, output_tokens format
      const usageForDelta = anthropicResponse.usage || { input_tokens: 0, output_tokens: 0 };
      res.write(`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: anthropicResponse.stop_reason, stop_sequence: anthropicResponse.stop_sequence }, usage: usageForDelta })}\n\n`);
      
      // Send message_stop event with full message including usage
      res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop", message: { id: anthropicResponse.id, type: "message", role: "assistant", content: anthropicResponse.content, model: anthropicResponse.model, stop_reason: anthropicResponse.stop_reason, stop_sequence: anthropicResponse.stop_sequence, usage: usageForDelta } })}\n\n`);
      
      res.end();
    } else {
      // Non-streaming response
      res.setHeader("Content-Type", "application/json");
      res.json(anthropicResponse);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[bedrock-proxy] error:", err);
    console.error("[bedrock-proxy] error stack:", err.stack);
    res.status(500).json({
      error: {
        type: "api_error",
        message: err.message || "Bedrock proxy error",
      },
    });
  }
});

// Always start server when this file is run directly
app.listen(PROXY_PORT, () => {
  console.log(`[bedrock-proxy] listening on http://127.0.0.1:${PROXY_PORT}`);
});

export { PROXY_PORT };
