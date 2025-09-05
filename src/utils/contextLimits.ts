export interface ContextLimits {
  [provider: string]: {
    [model: string]: number;
  };
}

export const CONTEXT_LIMITS: ContextLimits = {
  openai: {
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-3.5-turbo': 16385,
  },
  anthropic: {
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-3-opus-20240229': 200000,
    'claude-3': 200000,
  },
  grok: {
    'grok-1': 128000,
    'grok-beta': 128000,
  },
  sonicfree: {
    sonic: 256000,
  },
};

export function getContextLimit(provider: string, model: string): number | undefined {
  const providerLimits = CONTEXT_LIMITS[provider];
  if (!providerLimits) {
    return undefined;
  }

  // Exact match first
  if (providerLimits[model]) {
    return providerLimits[model];
  }

  // Partial match for model names
  for (const [modelKey, limit] of Object.entries(providerLimits)) {
    if (model.includes(modelKey) || modelKey.includes(model)) {
      return limit;
    }
  }

  return undefined;
}

export function calculateContextPercentage(
  usedTokens: number,
  contextLimit?: number
): number | undefined {
  if (!contextLimit || contextLimit <= 0) {
    return undefined;
  }

  const percentage = (usedTokens / contextLimit) * 100;
  return Math.min(percentage, 100);
}

export type ContextFormatType = 'percentage' | 'tokens' | 'both';

export function formatContextUsage(
  usedTokens: number,
  contextLimit?: number,
  format: ContextFormatType = 'both'
): string {
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  switch (format) {
    case 'percentage': {
      const percentage = calculateContextPercentage(usedTokens, contextLimit);
      return percentage !== undefined
        ? `${percentage.toFixed(1)}%`
        : `${formatNumber(usedTokens)} tokens`;
    }

    case 'tokens':
      if (contextLimit) {
        return `${formatNumber(usedTokens)}/${formatNumber(contextLimit)} tokens`;
      }
      return `${formatNumber(usedTokens)} tokens`;

    case 'both':
      if (contextLimit) {
        const percentage = calculateContextPercentage(usedTokens, contextLimit);
        if (percentage !== undefined) {
          return `${percentage.toFixed(1)}% (${formatNumber(usedTokens)}/${formatNumber(contextLimit)} tokens)`;
        }
      }
      return `${formatNumber(usedTokens)} tokens`;

    default:
      return `${formatNumber(usedTokens)} tokens`;
  }
}
