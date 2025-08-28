/**
 * Context window limits for different LLM providers and models
 * Based on official documentation as of 2024
 */

export interface ContextLimits {
  [provider: string]: {
    [model: string]: number;
  };
}

/**
 * Default context window limits for each provider and model
 * Values are in tokens
 */
export const CONTEXT_LIMITS: ContextLimits = {
  openai: {
    // GPT-4 models
    'gpt-4': 8192, // Legacy GPT-4
    'gpt-4-32k': 32768, // GPT-4 32k
    'gpt-4-turbo': 128000, // GPT-4 Turbo
    'gpt-4-turbo-preview': 128000,
    'gpt-4-0125-preview': 128000,
    'gpt-4-1106-preview': 128000,
    'gpt-4-vision-preview': 128000,

    // GPT-3.5 models
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385,
    'gpt-3.5-turbo-0125': 16385,
    'gpt-3.5-turbo-1106': 16385,
    'gpt-3.5-turbo-0613': 4096,
    'gpt-3.5-turbo-16k-0613': 16385,
  },

  anthropic: {
    // Claude 3 models
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-3-5-sonnet-20240620': 200000,

    // Claude 2 models
    'claude-2.1': 200000,
    'claude-2.0': 100000,

    // Claude 1 models (legacy)
    'claude-1': 100000,
    'claude-1-100k': 100000,
    'claude-instant-1': 100000,
    'claude-instant-1-100k': 100000,
  },

  grok: {
    // xAI/Grok models
    'grok-4-0709': 128000,
    'grok-3-fast': 128000,
    'grok-2': 128000,
    'grok-beta': 128000,
    'grok-1': 128000,
    grok: 128000,

    // Sonic models
    'sonic-fast-1': 128000,
    'sonic-medium-1': 128000,
    'sonic-slow-1': 128000,
  },

  openrouter: {
    // OpenRouter typically routes to various providers
    // Using conservative defaults based on common models
    auto: 4096, // Fallback for auto-routing
    'anthropic/claude-3-opus': 200000,
    'anthropic/claude-3-sonnet': 200000,
    'openai/gpt-4-turbo': 128000,
    'openai/gpt-4': 8192,
    'openai/gpt-3.5-turbo': 16385,
  },

  lmstudio: {
    // LMStudio can run various models locally
    // Using conservative defaults
    default: 4096,
    'local-model': 4096,
  },

  sonicfree: {
    // SonicFree provider limits (estimated)
    default: 4096,
    'sonic-free': 4096,
  },

  mcp: {
    // MCP (Model Context Protocol) - depends on underlying model
    default: 4096,
  },
};

/**
 * Get context limit for a specific provider and model
 * @param provider The provider name (e.g., 'openai', 'anthropic')
 * @param model The model name (e.g., 'gpt-4', 'claude-3-sonnet-20240229')
 * @returns The context window limit in tokens, or undefined if not found
 */
export function getContextLimit(provider: string, model?: string): number | undefined {
  const providerLimits = CONTEXT_LIMITS[provider.toLowerCase()];
  if (!providerLimits) {
    return undefined;
  }

  // Try exact model match first
  if (model && providerLimits[model]) {
    return providerLimits[model];
  }

  // Try to find a partial match (useful for versioned models)
  if (model) {
    const modelKeys = Object.keys(providerLimits);
    for (const key of modelKeys) {
      if (model.includes(key) || key.includes(model)) {
        return providerLimits[key];
      }
    }
  }

  // Fall back to default for the provider
  return providerLimits.default;
}

/**
 * Calculate context usage percentage
 * @param usedTokens Number of tokens used
 * @param contextLimit Total context window limit
 * @returns Percentage as a number (0-100), or undefined if limit is unknown
 */
export function calculateContextPercentage(
  usedTokens: number,
  contextLimit?: number
): number | undefined {
  if (!contextLimit || contextLimit <= 0) {
    return undefined;
  }

  const percentage = (usedTokens / contextLimit) * 100;
  return Math.min(percentage, 100); // Cap at 100% to avoid overflow
}

/**
 * Format context usage for display
 * @param usedTokens Number of tokens used
 * @param contextLimit Total context window limit
 * @param format Display format ('percentage', 'tokens', 'both')
 * @returns Formatted string for display
 */
export function formatContextUsage(
  usedTokens: number,
  contextLimit?: number,
  format: 'percentage' | 'tokens' | 'both' = 'percentage'
): string {
  const percentage = calculateContextPercentage(usedTokens, contextLimit);

  if (!percentage && !contextLimit) {
    // No context limit available
    return `${usedTokens.toLocaleString()} tokens`;
  }

  if (!percentage) {
    // Have limit but no percentage calculation possible
    return `${usedTokens.toLocaleString()}/${contextLimit!.toLocaleString()} tokens`;
  }

  switch (format) {
    case 'percentage':
      return `${percentage.toFixed(1)}%`;

    case 'tokens':
      return `${usedTokens.toLocaleString()}/${contextLimit!.toLocaleString()} tokens`;

    case 'both':
    default:
      return `${percentage.toFixed(1)}% (${usedTokens.toLocaleString()}/${contextLimit!.toLocaleString()} tokens)`;
  }
}
