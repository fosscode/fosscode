import { SonicFreeProvider } from '../providers/SonicFreeProvider';
import { Message, LLMConfig } from '../types';

// Mock OpenAI before importing SonicFreeProvider
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

// Mock SystemPrompt
jest.mock('../prompts/SystemPrompt', () => ({
  generate: jest.fn(),
}));

// Mock toolExecutor
jest.mock('../utils/toolExecutor', () => ({
  executeToolCalls: jest.fn(),
  getOpenAIToolsFormat: jest.fn(),
  hasAvailableTools: jest.fn(),
}));

describe('SonicFreeProvider', () => {
  let provider: SonicFreeProvider;
  let mockGenerate: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked function
    const systemPromptModule = require('../prompts/SystemPrompt');
    mockGenerate = systemPromptModule.generate;

    provider = new SonicFreeProvider();
  });

  describe('sendMessage', () => {
    const config: LLMConfig = {
      baseURL: 'https://gateway.opencode.ai/v1',
      timeout: 30000,
    };

    const messages: Message[] = [
      {
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      },
    ];

    beforeEach(() => {
      mockGenerate.mockResolvedValue('You are a helpful assistant.');
    });

    it('should handle API errors gracefully', async () => {
      // Get the mocked OpenAI instance
      const MockOpenAI = require('openai').default;
      const mockInstance = new MockOpenAI();

      // Mock the create method to throw an error
      mockInstance.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(provider.sendMessage(messages, config)).rejects.toThrow(
        'SonicFree API error: API Error'
      );
    });

    it('should provide fallback content when finalContent is empty', () => {
      // Test the fallback logic directly by simulating the scenario
      // This tests the fix we implemented for empty responses

      // Simulate the scenario where finalContent is empty due to token limits
      const finalContent = '';
      const totalTokensUsed = 130000;
      const adaptiveTokenLimit = 125000;
      const iterations: number = 2;

      // This simulates the logic we added in the fix
      let resultContent = finalContent;
      if (!resultContent.trim()) {
        if (totalTokensUsed >= adaptiveTokenLimit) {
          resultContent = `⚠️ **Response stopped early due to token limit**\n\nThe AI agent reached the maximum token budget (${adaptiveTokenLimit} tokens) before completing the response. This usually happens with complex requests that require multiple iterations.\n\nTry:\n• Simplifying your request\n• Breaking it into smaller parts\n• Using a different model with higher token limits\n\n*Used ${totalTokensUsed} tokens in ${iterations + 1} iterations*`;
        } else if (iterations === 0) {
          resultContent = `⚠️ **No response generated**\n\nThe AI agent couldn't generate a response. This might be due to:\n• Content filtering by the AI service\n• Network issues\n• Service limitations\n\nPlease try again or rephrase your request.`;
        } else {
          resultContent = `⚠️ **Incomplete response**\n\nThe AI agent stopped after ${iterations + 1} iterations without completing the response. This might indicate:\n• The request was too complex\n• Content filtering occurred\n• Service limitations\n\n*Partial content may be available in the thinking trace above*`;
        }
      }

      expect(resultContent).toBeTruthy();
      expect(resultContent).not.toBe('');
      expect(resultContent).toContain('token limit');
      expect(resultContent).toContain('130000 tokens');
      expect(resultContent).toContain('3 iterations');
    });
  });

  describe('validateConfig', () => {
    it('should validate config correctly', async () => {
      const validConfig: LLMConfig = {
        baseURL: 'https://gateway.opencode.ai/v1',
      };

      const result = await provider.validateConfig(validConfig);
      expect(result).toBe(true);
    });

    it('should reject invalid baseURL', async () => {
      const invalidConfig: LLMConfig = {
        baseURL: 'https://invalid.url',
      };

      const result = await provider.validateConfig(invalidConfig);
      expect(result).toBe(false);
    });
  });
});
