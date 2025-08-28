import { describe, it, expect } from '@jest/globals';
import {
  getContextLimit,
  calculateContextPercentage,
  formatContextUsage,
  CONTEXT_LIMITS,
} from '../utils/contextLimits.js';
import {
  enhanceWithContext,
  formatContextDisplay,
  getContextWarningLevel,
  getContextWarningMessage,
} from '../utils/contextUtils.js';
import { ProviderResponse, ProviderType } from '../types/index.js';

describe('Context Limits', () => {
  describe('getContextLimit', () => {
    it('should return correct limit for known provider and model', () => {
      expect(getContextLimit('openai', 'gpt-4')).toBe(8192);
      expect(getContextLimit('anthropic', 'claude-3-sonnet-20240229')).toBe(200000);
      expect(getContextLimit('grok', 'grok-1')).toBe(128000);
    });

    it('should handle partial model name matches', () => {
      expect(getContextLimit('openai', 'gpt-4-turbo')).toBe(128000);
      expect(getContextLimit('anthropic', 'claude-3')).toBe(200000);
    });

    it('should return undefined for unknown provider', () => {
      expect(getContextLimit('unknown', 'model')).toBeUndefined();
    });

    it('should return undefined for unknown model', () => {
      expect(getContextLimit('openai', 'unknown-model')).toBeUndefined();
    });
  });

  describe('calculateContextPercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculateContextPercentage(1000, 2000)).toBe(50);
      expect(calculateContextPercentage(500, 1000)).toBe(50);
      expect(calculateContextPercentage(0, 1000)).toBe(0);
    });

    it('should cap percentage at 100', () => {
      expect(calculateContextPercentage(1500, 1000)).toBe(100);
    });

    it('should return undefined for invalid context limit', () => {
      expect(calculateContextPercentage(1000, 0)).toBeUndefined();
      expect(calculateContextPercentage(1000, undefined)).toBeUndefined();
    });
  });

  describe('formatContextUsage', () => {
    it('should format percentage correctly', () => {
      expect(formatContextUsage(1000, 2000, 'percentage')).toBe('50.0%');
    });

    it('should format tokens correctly', () => {
      expect(formatContextUsage(1000, 2000, 'tokens')).toBe('1,000/2,000 tokens');
    });

    it('should format both correctly', () => {
      expect(formatContextUsage(1000, 2000, 'both')).toBe('50.0% (1,000/2,000 tokens)');
    });

    it('should handle missing context limit', () => {
      expect(formatContextUsage(1000, undefined, 'both')).toBe('1,000 tokens');
    });
  });
});

describe('Context Utils', () => {
  const mockResponse: ProviderResponse = {
    content: 'Test response',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    finishReason: 'stop',
  };

  describe('enhanceWithContext', () => {
    it('should enhance response with context information', () => {
      const enhanced = enhanceWithContext(mockResponse, 'openai' as ProviderType, 'gpt-4');

      expect(enhanced.context).toBeDefined();
      expect(enhanced.context?.usedTokens).toBe(150);
      expect(enhanced.context?.limit).toBe(8192);
      expect(enhanced.context?.percentage).toBeDefined();
      expect(enhanced.context?.provider).toBe('openai');
      expect(enhanced.context?.model).toBe('gpt-4');
    });

    it('should handle response without usage data', () => {
      const responseWithoutUsage: ProviderResponse = {
        content: 'Test response',
        finishReason: 'stop',
      };

      const enhanced = enhanceWithContext(responseWithoutUsage, 'openai' as ProviderType, 'gpt-4');
      expect(enhanced.context).toBeUndefined();
    });

    it('should handle unknown provider', () => {
      const enhanced = enhanceWithContext(mockResponse, 'unknown' as ProviderType, 'model');

      expect(enhanced.context).toBeDefined();
      expect(enhanced.context?.limit).toBeUndefined();
      expect(enhanced.context?.percentage).toBeUndefined();
    });
  });

  describe('formatContextDisplay', () => {
    it('should format context display correctly', () => {
      const context = {
        usedTokens: 1000,
        limit: 2000,
        percentage: 50,
        provider: 'openai' as ProviderType,
        model: 'gpt-4',
      };

      expect(formatContextDisplay(context, 'percentage')).toBe('50.0%');
      expect(formatContextDisplay(context, 'tokens')).toBe('1,000/2,000 tokens');
      expect(formatContextDisplay(context, 'both')).toBe('50.0% (1,000/2,000 tokens)');
    });

    it('should handle missing context', () => {
      expect(formatContextDisplay(undefined)).toBeUndefined();
    });

    it('should handle context without limit', () => {
      const context = {
        usedTokens: 1000,
        limit: undefined,
        percentage: undefined,
        provider: 'openai' as ProviderType,
        model: 'gpt-4',
      };

      expect(formatContextDisplay(context, 'both')).toBe('1,000 tokens');
    });
  });

  describe('getContextWarningLevel', () => {
    it('should return correct warning levels', () => {
      expect(getContextWarningLevel(60)).toBe('low');
      expect(getContextWarningLevel(75)).toBe('medium');
      expect(getContextWarningLevel(85)).toBe('high');
      expect(getContextWarningLevel(95)).toBe('critical');
      expect(getContextWarningLevel(98)).toBe('critical');
      expect(getContextWarningLevel(30)).toBe('none');
      expect(getContextWarningLevel(undefined)).toBe('none');
    });
  });

  describe('getContextWarningMessage', () => {
    it('should return appropriate warning messages', () => {
      const context = {
        usedTokens: 4000,
        limit: 5000,
        percentage: 80,
        provider: 'openai' as ProviderType,
        model: 'gpt-4',
      };

      const message = getContextWarningMessage(context);
      expect(message).toContain('moderate');
      expect(message).toContain('80.0%');
    });

    it('should return undefined for low usage', () => {
      const context = {
        usedTokens: 1000,
        limit: 5000,
        percentage: 20,
        provider: 'openai' as ProviderType,
        model: 'gpt-4',
      };

      expect(getContextWarningMessage(context)).toBeUndefined();
    });

    it('should return undefined for missing percentage', () => {
      const context = {
        usedTokens: 1000,
        limit: undefined,
        percentage: undefined,
        provider: 'openai' as ProviderType,
        model: 'gpt-4',
      };

      expect(getContextWarningMessage(context)).toBeUndefined();
    });
  });
});
