import { ProviderResponse, ProviderType } from '../types/index.js';
import {
  getContextLimit,
  calculateContextPercentage,
  formatContextUsage,
} from './contextLimits.js';

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
