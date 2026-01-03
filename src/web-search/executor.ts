/**
 * Web Search CLI Executor
 */

import type { WebSearchResult } from './messages.js';
import type { ExecuteResult, ExecuteOptions } from '../deep-research/executor.js';
import { executeGeminiSearch } from './gemini-cli.js';
import { formatErrorMessage } from '../infra/errors.js';

export interface ExecuteWebSearchOptions extends Omit<ExecuteOptions, 'topic'> {
  cliPath?: string;
  timeoutMs?: number;
}

export interface ExecuteWebSearchResult extends Omit<ExecuteResult, 'resultJsonPath'> {
  result?: WebSearchResult;
}

/**
 * Execute web search via Gemini CLI
 */
export async function executeWebSearch(
  query: string,
  options: ExecuteWebSearchOptions = {}
): Promise<ExecuteWebSearchResult> {
  const {
    cliPath = "/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh",
    timeoutMs = 30000,
    dryRun = false,
  } = options;
  
  if (dryRun) {
    return {
      success: true,
      runId: `dry-run-${Date.now()}`,
      result: {
        response: "DRY RUN: Would search for: " + query,
        session_id: `dry-run-${Date.now()}`,
        stats: {
          models: {
            "gemini-1.5": {
              api: { totalRequests: 0, totalErrors: 0 },
              tokens: { input: 0, candidates: 0, total: 0 }
            }
          }
        }
      },
      stdout: "",
      stderr: ""
    };
  }
  
  try {
    // Simple query validation
    if (!query || query.length < 2) {
      throw new Error("Query too short or empty");
    }
    
    if (query.length > 200) {
      throw new Error("Query too long (max 200 characters)");
    }
    
    // Use the standalone gemini CLI module
    const result = await executeGeminiSearch(query, { timeoutMs });
    
    return {
      success: true,
      runId: result.session_id,
      result,
      stdout: JSON.stringify(result),
      stderr: ""
    };
    
  } catch (error) {
    // Simple error handling
    const errorStr = String(error);
    
    let errorMessage = `Search failed: ${errorStr}`;
    
    // Make error messages more user-friendly
    if (errorStr.includes('timeout')) {
      errorMessage = '⏱️ Поиск занял слишком много времени';
    } else if (errorStr.includes('not found')) {
      errorMessage = '❌ Gemini CLI не найден. Проверьте установку.';
    } else if (errorStr.includes('too short')) {
      errorMessage = '❌ Запрос слишком короткий';
    } else if (errorStr.includes('too long')) {
      errorMessage = '❌ Запрос слишком длинный (макс. 200 символов)';
    }
    
    return {
      success: false,
      runId: `error-${Date.now()}`,
      error: errorMessage,
      stdout: "",
      stderr: errorStr
    };
  }
}

// Additional cleaning patterns for very malformed queries
function aggressivelyCleanQuery(query: string): string {
  let cleaned = query.toLowerCase();
  
  // Remove misspelled search commands
  cleaned = cleaned.replace(/\b(googel\s+it|web\s+searhc?|seach\s+web|serach)\b/gi, ' ');
  
  // Remove "сделай в интернете" and similar
  cleaned = cleaned.replace(/\b(сделай\s+в\s+интернете|в\s+интернете|in\s+internet|on\s+web)\b/gi, ' ');
  
  // Extract the most likely actual query (look for topic patterns)
  const patterns = [
    /погода\s+(в\s+)?\w+/i,      // weather
    /курс\s+\w+/i,               // exchange rate
    /новости(\s+\w+)*/i,         // news
    /[а-яА-Я]{4,}/,              // any Russian word (topic)
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[0].length > 3) {
      console.log(`[web-search] Extracted topic: "${match[0]}" from "${query}"`);
      return match[0];
    }
  }
  
  return cleaned;
}
