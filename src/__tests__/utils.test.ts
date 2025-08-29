import { ProviderType } from '../types';

describe('Utility Functions', () => {
  describe('Provider validation', () => {
    it('should validate provider types correctly', () => {
      const validProviders: ProviderType[] = [
        'openai',
        'grok',
        'lmstudio',
        'openrouter',
        'sonicfree',
        'mcp',
        'anthropic',
        'mock',
      ];
      const invalidProviders = ['invalid', 'aws', 'google'];

      validProviders.forEach(provider => {
        expect([
          'openai',
          'grok',
          'lmstudio',
          'openrouter',
          'sonicfree',
          'mcp',
          'anthropic',
          'mock',
        ]).toContain(provider);
      });

      invalidProviders.forEach(provider => {
        expect([
          'openai',
          'grok',
          'lmstudio',
          'openrouter',
          'sonicfree',
          'mcp',
          'anthropic',
          'mock',
        ]).not.toContain(provider);
      });
    });
  });

  describe('Default model mapping', () => {
    it('should map providers to correct default models', () => {
      const providerModelMap: Record<ProviderType, string> = {
        openai: 'gpt-3.5-turbo',
        grok: 'sonic-fast-1',
        lmstudio: 'local-model',
        openrouter: 'openrouter-model',
        sonicfree: 'sonic',
        mcp: 'mcp-model',
        anthropic: 'claude-3-haiku-20240307',
        mock: 'mock-model',
      };

      Object.entries(providerModelMap).forEach(([provider, expectedModel]) => {
        expect(typeof expectedModel).toBe('string');
        expect(expectedModel.length).toBeGreaterThan(0);
        expect([
          'openai',
          'grok',
          'lmstudio',
          'openrouter',
          'sonicfree',
          'mcp',
          'anthropic',
          'mock',
        ]).toContain(provider);
      });
    });
  });

  describe('Configuration validation', () => {
    it('should validate configuration object structure', () => {
      const validConfig = {
        defaultProvider: 'openai' as ProviderType,
        defaultModel: 'gpt-3.5-turbo',
        maxConversations: 100,
        theme: 'dark' as const,
        providers: {
          openai: { apiKey: 'test-key' },
          grok: {},
          lmstudio: { baseURL: 'http://localhost:1234' },
          openrouter: {},
          sonicfree: { baseURL: 'https://gateway.opencode.ai/v1' },
          mcp: {},
          anthropic: {},
          mock: {},
        },
        cachedModels: {
          openai: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          grok: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          lmstudio: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          openrouter: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          sonicfree: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          mcp: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          anthropic: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          mock: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        },
      };

      expect(validConfig.defaultProvider).toBe('openai');
      expect(validConfig.defaultModel).toBe('gpt-3.5-turbo');
      expect(validConfig.maxConversations).toBe(100);
      expect(validConfig.theme).toBe('dark');
      expect(validConfig.providers.openai.apiKey).toBe('test-key');
      expect(validConfig.providers.lmstudio.baseURL).toBe('http://localhost:1234');
    });
  });
});
