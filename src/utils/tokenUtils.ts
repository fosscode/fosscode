import { encode } from 'gpt-tokenizer';
import { Message } from '../types/index.js';

// Simple LRU cache for token counts to improve performance
const tokenCache = new Map<string, number>();
const MAX_CACHE_SIZE = 100;

export function countTokens(text: string): number {
  // For very large texts, use sampling to estimate token count
  if (text.length > 50000) {
    const sampleSize = 10000;
    const sample = text.substring(0, sampleSize);
    const sampleTokens = encode(sample).length;
    const estimatedTokens = Math.round((text.length / sampleSize) * sampleTokens);

    // Cache the result for large texts
    const cacheKey = `large_${text.length}_${sampleTokens}`;
    if (!tokenCache.has(cacheKey)) {
      if (tokenCache.size >= MAX_CACHE_SIZE) {
        const firstKey = tokenCache.keys().next().value;
        if (firstKey) {
          tokenCache.delete(firstKey);
        }
      }
      tokenCache.set(cacheKey, estimatedTokens);
    }

    return estimatedTokens;
  }

  // For smaller texts, use exact counting with caching
  const sampleText: string = text.substring(0, 100);
  const cacheKey = `exact_${text.length}_${sampleText}`;
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!;
  }

  const tokenCount = encode(text).length;
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey) {
      tokenCache.delete(firstKey);
    }
  }
  tokenCache.set(cacheKey, tokenCount);

  return tokenCount;
}

export function estimateSystemPromptTokens(
  _provider: string,
  _model: string,
  mode?: 'code' | 'thinking',
  messages?: Message[]
): number {
  // Estimate base system prompt size (rough approximation)
  let baseTokens = 2000; // Base system prompt

  // Add environment info (~200 tokens)
  baseTokens += 200;

  // Add project structure (~300 tokens)
  baseTokens += 300;

  // Add tools list - varies by mode
  if (mode === 'thinking') {
    baseTokens += 200; // Fewer tools in thinking mode
  } else {
    baseTokens += 500; // Full tool list
  }

  // Add custom rules if present (~200 tokens)
  baseTokens += 200;

  // Add conversation context if messages provided
  if (messages && messages.length > 0) {
    const recentMessages = messages.slice(-5); // Last 5 messages
    const conversationTokens = recentMessages.reduce((total, msg) => {
      return total + countTokens(msg.content);
    }, 0);
    baseTokens += conversationTokens + 100; // +100 for formatting
  }

  // Add file context (~200 tokens)
  baseTokens += 200;

  return baseTokens;
}

export function calculateEffectiveTokenLimit(
  provider: string,
  model: string,
  mode?: 'code' | 'thinking',
  messages?: Message[]
): number {
  const contextLimit = getContextLimit(provider, model) ?? 128000;
  const systemPromptTokens = estimateSystemPromptTokens(provider, model, mode, messages);

  // Reserve space for system prompt, user input, and AI response
  const reservedForConversation = 8000; // ~4k for user input, ~4k for AI response

  const effectiveLimit = contextLimit - systemPromptTokens - reservedForConversation;

  // Ensure we don't go below a minimum useful limit
  return Math.max(effectiveLimit, 20000);
}

// Import getContextLimit for use in this file
import { getContextLimit } from './contextLimits.js';
