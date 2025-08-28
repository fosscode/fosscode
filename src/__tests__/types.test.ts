import {
  ProviderType,
  LLMConfig,
  Message,
  ProviderResponse,
  CachedModels,
  AppConfig,
  PerformanceMetrics,
} from '../types';

describe('Type Definitions', () => {
  describe('ProviderType', () => {
    it('should accept all valid provider types', () => {
      const providers: ProviderType[] = [
        'openai',
        'grok',
        'lmstudio',
        'openrouter',
        'sonicfree',
        'mcp',
        'anthropic',
      ];

      providers.forEach(provider => {
        expect([
          'openai',
          'grok',
          'lmstudio',
          'openrouter',
          'sonicfree',
          'mcp',
          'anthropic',
        ]).toContain(provider);
      });
    });
  });

  describe('LLMConfig', () => {
    it('should create valid LLMConfig objects', () => {
      const config: LLMConfig = {
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
        organization: 'test-org',
        timeout: 30000,
        maxRetries: 3,
        model: 'test-model',
      };

      expect(config.apiKey).toBe('test-key');
      expect(config.baseURL).toBe('https://api.example.com');
      expect(config.organization).toBe('test-org');
      expect(config.timeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
      expect(config.model).toBe('test-model');
    });

    it('should allow partial LLMConfig objects', () => {
      const partialConfig: Partial<LLMConfig> = {
        apiKey: 'test-key',
      };

      expect(partialConfig.apiKey).toBe('test-key');
      expect(partialConfig.baseURL).toBeUndefined();
    });
  });

  describe('Message', () => {
    it('should create valid Message objects', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello, world!',
        timestamp: new Date('2023-01-01T00:00:00Z'),
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should accept all valid message roles', () => {
      const roles: Message['role'][] = ['user', 'assistant', 'system'];

      roles.forEach(role => {
        const message: Message = {
          role,
          content: 'test',
          timestamp: new Date(),
        };
        expect(['user', 'assistant', 'system']).toContain(message.role);
      });
    });
  });

  describe('ProviderResponse', () => {
    it('should create valid ProviderResponse objects', () => {
      const response: ProviderResponse = {
        content: 'Hello from AI!',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
      };

      expect(response.content).toBe('Hello from AI!');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
      expect(response.finishReason).toBe('stop');
    });

    it('should allow ProviderResponse without usage', () => {
      const response: ProviderResponse = {
        content: 'Hello from AI!',
        finishReason: 'stop',
      };

      expect(response.content).toBe('Hello from AI!');
      expect(response.usage).toBeUndefined();
      expect(response.finishReason).toBe('stop');
    });

    it('should accept all valid finish reasons', () => {
      const finishReasons: ProviderResponse['finishReason'][] = ['stop', 'length', 'error'];

      finishReasons.forEach(reason => {
        const response: ProviderResponse = {
          content: 'test',
          finishReason: reason,
        };
        expect(['stop', 'length', 'error']).toContain(response.finishReason);
      });
    });
  });

  describe('CachedModels', () => {
    it('should create valid CachedModels objects', () => {
      const cachedModels: CachedModels = {
        models: ['gpt-3.5-turbo', 'gpt-4'],
        lastUpdated: new Date('2023-01-01T00:00:00Z'),
        expiresAt: new Date('2023-01-02T00:00:00Z'),
      };

      expect(cachedModels.models).toEqual(['gpt-3.5-turbo', 'gpt-4']);
      expect(cachedModels.lastUpdated).toBeInstanceOf(Date);
      expect(cachedModels.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('AppConfig', () => {
    it('should create valid AppConfig objects', () => {
      const appConfig: AppConfig = {
        defaultProvider: 'openai',
        defaultModel: 'gpt-3.5-turbo',
        maxConversations: 100,
        theme: 'dark',
        providers: {
          openai: { apiKey: 'test-key' },
          grok: {},
          lmstudio: { baseURL: 'http://localhost:1234' },
          openrouter: {},
          sonicfree: { baseURL: 'https://gateway.opencode.ai/v1' },
          mcp: {},
          anthropic: {},
        },
        cachedModels: {
          openai: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          grok: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          lmstudio: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          openrouter: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          sonicfree: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          mcp: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          anthropic: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        },
        messagingPlatforms: {
          telegram: { enabled: false },
          discord: { enabled: false },
          slack: { enabled: false },
          terminal: { enabled: true },
        },
      };

      expect(appConfig.defaultProvider).toBe('openai');
      expect(appConfig.defaultModel).toBe('gpt-3.5-turbo');
      expect(appConfig.maxConversations).toBe(100);
      expect(appConfig.theme).toBe('dark');
      expect(appConfig.providers).toHaveProperty('openai');
      expect(appConfig.cachedModels).toHaveProperty('openai');
    });

    it('should accept all valid theme values', () => {
      const themes: AppConfig['theme'][] = ['dark', 'light'];

      themes.forEach(theme => {
        const config: AppConfig = {
          defaultProvider: 'openai',
          defaultModel: 'gpt-3.5-turbo',
          maxConversations: 100,
          theme,
          providers: {
            openai: {},
            grok: {},
            lmstudio: {},
            openrouter: {},
            sonicfree: {},
            mcp: {},
            anthropic: {},
          },
          cachedModels: {
            openai: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
            grok: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
            lmstudio: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
            openrouter: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
            sonicfree: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
            mcp: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
            anthropic: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
          },
          messagingPlatforms: {
            telegram: { enabled: false },
            discord: { enabled: false },
            slack: { enabled: false },
            terminal: { enabled: true },
          },
        };
        expect(['dark', 'light']).toContain(config.theme);
      });
    });
  });

  describe('PerformanceMetrics', () => {
    it('should create valid PerformanceMetrics objects', () => {
      const metrics: PerformanceMetrics = {
        memoryUsage: 1024,
        startupTime: 500,
        responseTime: 200,
        bundleSize: 2048,
      };

      expect(metrics.memoryUsage).toBe(1024);
      expect(metrics.startupTime).toBe(500);
      expect(metrics.responseTime).toBe(200);
      expect(metrics.bundleSize).toBe(2048);
    });
  });
});
