#!/usr/bin/env node
/**
 * Brave Search API Client
 * Usage: node search.mjs "search query" [--count 5] [--type web|news] [--format json|text]
 */

import { config } from 'dotenv';
import { writeFileSync, readFileSync } from 'fs';

config();

const BRAVE_API_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const BRAVE_NEWS_ENDPOINT = 'https://api.search.brave.com/res/v1/news/search';

// Parse CLI args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node search.mjs "search query" [--count 5] [--type web|news] [--format json|text]');
  process.exit(1);
}

const query = args[0];
const options = {
  count: 5,
  type: 'web', // web or news
  format: 'json' // json or text
};

// Parse options
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) {
    options.count = parseInt(args[++i], 10);
  } else if (args[i] === '--type' && args[i + 1]) {
    options.type = args[++i];
  } else if (args[i] === '--format' && args[i + 1]) {
    options.format = args[++i];
  }
}

// Validate API key
const apiKey = process.env.BRAVE_API_KEY || process.env.BRAVE_SEARCH_API_KEY;
if (!apiKey) {
  console.error('❌ ERROR: BRAVE_API_KEY environment variable not set');
  console.error('Get API key from: https://brave.com/search/api');
  process.exit(1);
}

// Validate query
if (!query || query.trim().length < 3) {
  console.error('❌ ERROR: Query too short (minimum 3 characters)');
  process.exit(1);
}

// Make API request
async function searchBrave(query, options) {
  try {
    const endpoint = options.type === 'news' ? BRAVE_NEWS_ENDPOINT : BRAVE_API_ENDPOINT;
    const url = new URL(endpoint);
    url.searchParams.set('q', query);
    url.searchParams.set('count', options.count.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'Clawdis-App/1.0'
      },
      timeout: options.timeout || 15000 // 15 second timeout
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Check BRAVE_API_KEY environment variable.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

// Format results
function formatResults(data, options) {
  if (options.format === 'json') {
    return JSON.stringify({
      success: true,
      query,
      type: options.type,
      results: data.results || [],
      metadata: {
        totalResults: data.totalResults || 0,
        timestamp: new Date().toISOString(),
        source: 'brave-search'
      }
    }, null, 2);
  }

  // Text format
  let output = `🔍 Search Results for: "${query}"\n`;
  output += `📊 Type: ${options.type} | Results: ${data.totalResults || 0}\n\n`;

  if (data.results && data.results.length > 0) {
    data.results.slice(0, options.count).forEach((result, idx) => {
      output += `${idx + 1}. ${result.title}\n`;
      output += `   ${result.description || 'No description'}\n`;
      output += `   ${result.url}\n\n`;
    });
  } else {
    output += 'No results found.\n';
  }

  return output;
}

// Main execution
(async () => {
  try {
    const startTime = Date.now();
    const data = await searchBrave(query, options);
    const duration = Date.now() - startTime;

    // Add performance metadata
    if (options.format === 'json') {
      data.searchMetadata = {
        durationMs: duration,
        endpoint: options.type,
        countRequested: options.count,
        countReturned: data.results?.length || 0
      };
    } else {
      console.log(`⏱️ Search completed in ${duration}ms\n`);
    }

    console.log(formatResults(data, options));
    process.exit(0);
  } catch (error) {
    console.error(`❌ Search failed: ${error.message}`);
    
    // Output error in expected format for tooling
    if (options.format === 'json') {
      console.log(JSON.stringify({
        success: false,
        error: error.message,
        query,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
    
    process.exit(1);
  }
})();