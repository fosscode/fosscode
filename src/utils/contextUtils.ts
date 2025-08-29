import { ProviderResponse, ProviderType, Message } from '../types/index.js';
import {
  getContextLimit,
  calculateContextPercentage,
  formatContextUsage,
} from './contextLimits.js';
import { encode } from 'gpt-tokenizer';
import type { ProviderManager } from '../providers/ProviderManager.js';

export interface ContextInfo {
  usedTokens: number;
  limit?: number | undefined;
  percentage?: number | undefined;
  provider: ProviderType;
  model: string;
}

export interface EnhancedProviderResponse extends ProviderResponse {
  context?: ContextInfo;
}

export function countTokens(text: string): number {
  return encode(text).length;
}

export async function summarize(
  messages: Message[],
  provider: ProviderType,
  model: string,
  sendMessage: ProviderManager['sendMessage']
): Promise<Message> {
  const summarizationPrompt = `Please provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.`;

  const messagesToSummarize = messages.filter(m => m.role !== 'summary');

  const response = await sendMessage(
    provider,
    [
      ...messagesToSummarize,
      {
        role: 'user',
        content: summarizationPrompt,
        timestamp: new Date(),
      },
    ],
    model,
    false, // isVerbose
    'thinking' // mode
  );

  return {
    role: 'summary',
    content: response.content,
    timestamp: new Date(),
    ...(response.usage && { usage: response.usage }),
  };
}

export function enhanceWithContext(
  response: ProviderResponse,
  provider: ProviderType,
  model: string
): EnhancedProviderResponse {
  if (!response.usage) {
    return response;
  }

  const limit = getContextLimit(provider, model);
  const percentage = calculateContextPercentage(response.usage.totalTokens, limit);

  const context: ContextInfo = {
    usedTokens: response.usage.totalTokens,
    limit,
    percentage,
    provider,
    model,
  };

  return {
    ...response,
    context,
  };
}

export type ContextDisplayFormat = 'percentage' | 'tokens' | 'both';

export function formatContextDisplay(
  context?: ContextInfo,
  format: ContextDisplayFormat = 'both'
): string | undefined {
  if (!context) {
    return undefined;
  }

  return formatContextUsage(context.usedTokens, context.limit, format);
}

export type ContextWarningLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export function getContextWarningLevel(percentage?: number): ContextWarningLevel {
  if (!percentage) {
    return 'none';
  }

  if (percentage >= 95) {
    return 'critical';
  } else if (percentage >= 85) {
    return 'high';
  } else if (percentage >= 75) {
    return 'medium';
  } else if (percentage >= 60) {
    return 'low';
  }

  return 'none';
}

export function getContextWarningMessage(context?: ContextInfo): string | undefined {
  if (!context?.percentage) {
    return undefined;
  }

  const level = getContextWarningLevel(context.percentage);

  if (level === 'none') {
    return undefined;
  }

  const percentage = context.percentage.toFixed(1);
  const levelText = {
    low: 'approaching',
    medium: 'moderate',
    high: 'high',
    critical: 'critical',
  }[level];

  return `Context usage is ${levelText} (${percentage}%). Consider shortening your prompt or switching to a model with higher context limits.`;
}