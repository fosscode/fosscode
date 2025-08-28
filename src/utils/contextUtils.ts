import { ProviderResponse, ProviderType } from '../types/index.js';
import { getContextLimit, calculateContextPercentage } from './contextLimits.js';

/**
 * Context information for a provider response
 */
export interface ContextInfo {
  usedTokens: number;
  limit?: number | undefined;
  percentage?: number | undefined;
  provider: ProviderType;
  model: string;
}

/**
 * Enhanced provider response with context information
 */
export interface EnhancedProviderResponse extends Omit<ProviderResponse, 'context'> {
  context?: ContextInfo | undefined;
}

/**
 * Enhance a provider response with context information
 * @param response Original provider response
 * @param provider The provider that generated the response
 * @param model The model that generated the response
 * @returns Enhanced response with context information
 */
export function enhanceWithContext(
  response: ProviderResponse,
  provider: ProviderType,
  model: string
): EnhancedProviderResponse {
  if (response.usage?.totalTokens) {
    const contextLimit = getContextLimit(provider, model);
    const percentage = calculateContextPercentage(response.usage.totalTokens, contextLimit);

    const context: ContextInfo = {
      usedTokens: response.usage.totalTokens,
      limit: contextLimit,
      percentage: percentage,
      provider,
      model,
    };

    return {
      ...response,
      context,
    };
  }

  return {
    ...response,
    context: undefined,
  };
}

/**
 * Format context information for display
 * @param context Context information from enhanced response
 * @param format Display format
 * @returns Formatted context string
 */
export function formatContextDisplay(
  context?: EnhancedProviderResponse['context'],
  format: 'percentage' | 'tokens' | 'both' = 'percentage'
): string | undefined {
  if (!context) {
    return undefined;
  }

  const { usedTokens, limit, percentage } = context;

  if (!percentage && !limit) {
    return `${usedTokens.toLocaleString()} tokens`;
  }

  if (!percentage) {
    return `${usedTokens.toLocaleString()}/${limit!.toLocaleString()} tokens`;
  }

  switch (format) {
    case 'percentage':
      return `${percentage.toFixed(1)}%`;

    case 'tokens':
      return `${usedTokens.toLocaleString()}/${limit!.toLocaleString()} tokens`;

    case 'both':
    default:
      return `${percentage.toFixed(1)}% (${usedTokens.toLocaleString()}/${limit!.toLocaleString()} tokens)`;
  }
}

/**
 * Get context warning level based on usage percentage
 * @param percentage Context usage percentage (0-100)
 * @returns Warning level: 'low', 'medium', 'high', 'critical'
 */
export function getContextWarningLevel(
  percentage?: number
): 'low' | 'medium' | 'high' | 'critical' | 'none' {
  if (!percentage) {
    return 'none';
  }

  if (percentage >= 95) {
    return 'critical';
  } else if (percentage >= 85) {
    return 'high';
  } else if (percentage >= 75) {
    return 'medium';
  } else if (percentage >= 50) {
    return 'low';
  }

  return 'none';
}

/**
 * Get warning message for context usage
 * @param context Context information
 * @returns Warning message or undefined if no warning needed
 */
export function getContextWarningMessage(
  context?: EnhancedProviderResponse['context']
): string | undefined {
  if (!context?.percentage) {
    return undefined;
  }

  const level = getContextWarningLevel(context.percentage);

  switch (level) {
    case 'critical':
      return `🚨 Context nearly full (${context.percentage.toFixed(1)}%). Next response may be truncated.`;
    case 'high':
      return `⚠️ Context usage high (${context.percentage.toFixed(1)}%). Consider summarizing or starting fresh.`;
    case 'medium':
      return `ℹ️ Context usage moderate (${context.percentage.toFixed(1)}%).`;
    case 'low':
      return `ℹ️ Context usage: ${context.percentage.toFixed(1)}%.`;
    default:
      return undefined;
  }
}
