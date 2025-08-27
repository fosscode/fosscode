import { ConfigManager } from '../config/ConfigManager';
import { ProviderType } from '../types';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Create a fresh instance for each test
    configManager = new ConfigManager();
  });

  describe('constructor', () => {
    it('should create a ConfigManager instance', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration with expected structure', () => {
      const config = configManager.getConfig();

      expect(config).toHaveProperty('defaultProvider');
      expect(config).toHaveProperty('defaultModel');
      expect(config).toHaveProperty('maxConversations');
      expect(config).toHaveProperty('theme');
      expect(config).toHaveProperty('providers');
      expect(config).toHaveProperty('cachedModels');

      expect(typeof config.defaultProvider).toBe('string');
      expect(typeof config.defaultModel).toBe('string');
      expect(typeof config.maxConversations).toBe('number');
      expect(['dark', 'light']).toContain(config.theme);
    });

    it('should have all required providers configured', () => {
      const config = configManager.getConfig();
      const expectedProviders: ProviderType[] = [
        'openai',
        'grok',
        'lmstudio',
        'openrouter',
        'sonicfree',
      ];

      expectedProviders.forEach(provider => {
        expect(config.providers).toHaveProperty(provider);
        expect(config.cachedModels).toHaveProperty(provider);
      });
    });
  });

  describe('getDefaultModelForProvider', () => {
    it('should return correct default models for each provider', () => {
      expect(configManager.getDefaultModelForProvider('openai')).toBe('gpt-3.5-turbo');
      expect(configManager.getDefaultModelForProvider('grok')).toBe('sonic-fast-1');
      expect(configManager.getDefaultModelForProvider('lmstudio')).toBe('local-model');
      expect(configManager.getDefaultModelForProvider('openrouter')).toBe('openrouter-model');
      expect(configManager.getDefaultModelForProvider('sonicfree')).toBe('sonic');
    });

    it('should return openai default for unknown provider', () => {
      expect(configManager.getDefaultModelForProvider('unknown' as ProviderType)).toBe(
        'gpt-3.5-turbo'
      );
    });
  });

  describe('getDefaultModelForCurrentProvider', () => {
    it('should return default model for current provider', () => {
      const model = configManager.getDefaultModelForCurrentProvider();
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(0);
    });
  });

  describe('isModelCacheExpired', () => {
    it('should return true for providers without cached models', () => {
      expect(configManager.isModelCacheExpired('openai')).toBe(true);
      expect(configManager.isModelCacheExpired('grok')).toBe(true);
    });
  });

  describe('setConfig', () => {
    it('should set nested config values', async () => {
      await configManager.setConfig('providers.openai.apiKey', 'test-key');
      const config = configManager.getConfig();
      expect(config.providers.openai.apiKey).toBe('test-key');
    });

    it('should create nested objects if they do not exist', async () => {
      await configManager.setConfig('newSection.newKey', 'value');
      const config = configManager.getConfig();
      expect(config).toHaveProperty('newSection');
      expect((config as any).newSection.newKey).toBe('value');
    });

    it('should throw error for prototype polluting keys', async () => {
      await expect(configManager.setConfig('__proto__.polluted', 'value')).rejects.toThrow(
        'Invalid config key: __proto__'
      );
      await expect(configManager.setConfig('constructor.malicious', 'value')).rejects.toThrow(
        'Invalid config key: constructor'
      );
      await expect(configManager.setConfig('prototype.dangerous', 'value')).rejects.toThrow(
        'Invalid config key: prototype'
      );
    });
  });
});
