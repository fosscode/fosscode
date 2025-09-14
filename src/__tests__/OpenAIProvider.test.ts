// import 'openai/shims/node'; // Commented out for OpenAI v5 compatibility
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { LLMConfig } from '../types';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
  });

  describe('validateConfig', () => {
    it('should return false when apiKey is not provided', async () => {
      const config: LLMConfig = {};

      const result = await provider.validateConfig(config);

      expect(result).toBe(false);
    });

    it('should return false when apiKey does not start with sk-', async () => {
      const config: LLMConfig = { apiKey: 'invalid-key' };

      const result = await provider.validateConfig(config);

      expect(result).toBe(false);
    });

    it('should return false when apiKey is too short', async () => {
      const config: LLMConfig = { apiKey: 'sk-short' };

      const result = await provider.validateConfig(config);

      expect(result).toBe(false);
    });

    it('should return true for valid apiKey', async () => {
      const config: LLMConfig = { apiKey: 'sk-valid-key-with-sufficient-length' };

      const result = await provider.validateConfig(config);

      expect(result).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should throw error when apiKey is not configured', async () => {
      const config: LLMConfig = {};
      const messages: any[] = [{ role: 'user', content: 'Hello', timestamp: new Date() }];

      await expect(provider.sendMessage(messages, config)).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });
  });

  describe('listModels', () => {
    it('should throw error when apiKey is not configured', async () => {
      const config: LLMConfig = {};

      await expect(provider.listModels(config)).rejects.toThrow('OpenAI API key not configured');
    });
  });
});
