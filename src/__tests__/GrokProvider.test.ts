import { GrokProvider } from '../providers/GrokProvider';
import { Message, LLMConfig } from '../types';

// Access the globally mocked fetch
const mockFetch = global.fetch as jest.Mock;

// Mock SystemPrompt
jest.mock('../prompts/SystemPrompt', () => ({
  generate: jest.fn(),
}));

describe('GrokProvider', () => {
  let provider: GrokProvider;
  let mockGenerate: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset fetch mock to prevent real API calls
    mockFetch.mockReset();

    // Get the mocked function
    const systemPromptModule = require('../prompts/SystemPrompt');
    mockGenerate = systemPromptModule.generate;

    provider = new GrokProvider();
  });

  describe('validateConfig', () => {
    it('should return false when apiKey is not provided', async () => {
      const config: LLMConfig = {};

      const result = await provider.validateConfig(config);

      expect(result).toBe(false);
    });

    it('should return false when apiKey does not start with xai-', async () => {
      const config: LLMConfig = { apiKey: 'invalid-key' };

      const result = await provider.validateConfig(config);

      expect(result).toBe(false);
    });

    it('should return false when apiKey is too short', async () => {
      const config: LLMConfig = { apiKey: 'xai-short' };

      const result = await provider.validateConfig(config);

      expect(result).toBe(false);
    });

    it('should return true for valid apiKey', async () => {
      const config: LLMConfig = { apiKey: 'xai-valid-key-with-sufficient-length' };

      const result = await provider.validateConfig(config);

      expect(result).toBe(true);
    });
  });

  describe('sendMessage', () => {
    const validConfig: LLMConfig = { apiKey: 'xai-valid-key-with-sufficient-length' };
    const messages: Message[] = [{ role: 'user', content: 'Hello', timestamp: new Date() }];

    beforeEach(() => {
      mockGenerate.mockResolvedValue('You are a helpful AI assistant');
    });

    it('should throw error when apiKey is not configured', async () => {
      const config: LLMConfig = {};

      await expect(provider.sendMessage(messages, config)).rejects.toThrow(
        'Grok API key not configured'
      );
    });

    it('should send message successfully with first model', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Hello from Grok' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.sendMessage(messages, validConfig);

      expect(result).toEqual({
        content: 'Hello from Grok',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer xai-valid-key-with-sufficient-length',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-4-0709',
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant' },
            { role: 'user', content: 'Hello' },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
        }),
        signal: expect.any(AbortSignal),
      });
    });

    it('should use custom model when provided', async () => {
      const configWithModel: LLMConfig = { ...validConfig, model: 'custom-grok-model' };
      const mockResponse = {
        choices: [
          {
            message: { content: 'Hello from custom model' },
            finish_reason: 'stop',
          },
        ],
        usage: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.sendMessage(messages, configWithModel);

      expect(result.content).toBe('Hello from custom model');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"custom-grok-model"'),
        })
      );
    });

    it('should fallback to next model on 404 error', async () => {
      // First model fails with 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Second model succeeds
      const mockResponse = {
        choices: [
          {
            message: { content: 'Hello from fallback model' },
            finish_reason: 'stop',
          },
        ],
        usage: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.sendMessage(messages, validConfig);

      expect(result.content).toBe('Hello from fallback model');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when no response choices', async () => {
      const mockResponse = {
        choices: [],
        usage: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      await expect(provider.sendMessage(messages, validConfig)).rejects.toThrow(
        'No response from xAI API'
      );
    });

    it('should throw error on non-404 API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({ error: { message: 'Invalid API key' } }),
      });

      await expect(provider.sendMessage(messages, validConfig)).rejects.toThrow(
        'xAI API error: 401 Unauthorized - Invalid API key'
      );
    });
  });

  describe('listModels', () => {
    const validConfig: LLMConfig = { apiKey: 'xai-valid-key-with-sufficient-length' };

    it('should throw error when apiKey is not configured', async () => {
      const config: LLMConfig = {};

      await expect(provider.listModels(config)).rejects.toThrow('Grok API key not configured');
    });

    it('should fetch and filter models from xAI API successfully', async () => {
      const mockApiResponse = {
        data: [
          { id: 'grok-4-0709' },
          { id: 'sonic-fast-1' },
          { id: 'grok-3-fast' },
          { id: 'other-model' }, // Should be filtered out
          { id: 'text-model' }, // Should be filtered out
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      });

      const result = await provider.listModels(validConfig);

      expect(result).toEqual(['grok-3-fast', 'grok-4-0709', 'sonic-fast-1']);

      expect(mockFetch).toHaveBeenCalledWith('https://api.x.ai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer xai-valid-key-with-sufficient-length',
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should include configured model even if not in API response', async () => {
      const configWithModel: LLMConfig = { ...validConfig, model: 'custom-grok-model' };
      const mockApiResponse = {
        data: [{ id: 'grok-4-0709' }, { id: 'sonic-fast-1' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      });

      const result = await provider.listModels(configWithModel);

      expect(result).toEqual(['custom-grok-model', 'grok-4-0709', 'sonic-fast-1']);
    });
  });
});
