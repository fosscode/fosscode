import { encode } from 'gpt-tokenizer';
import { Message } from '../types/index.js';

export function countTokens(text: string): number {
  return encode(text).length;
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
  const contextLimit = getContextLimit(provider, model) || 128000;
  const systemPromptTokens = estimateSystemPromptTokens(provider, model, mode, messages);

  // Reserve space for system prompt, user input, and AI response
  const reservedForConversation = 8000; // ~4k for user input, ~4k for AI response

  const effectiveLimit = contextLimit - systemPromptTokens - reservedForConversation;

  // Ensure we don't go below a minimum useful limit
  return Math.max(effectiveLimit, 20000);
}

// Import getContextLimit for use in this file
import { getContextLimit } from './contextLimits.js';
