import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';

interface MockResponse {
  promptRegex: RegExp;
  response: string;
}

export class MockProvider implements LLMProvider {
  private static cannedResponses: MockResponse[] = [];

  async validateConfig(_config: LLMConfig): Promise<boolean> {
    // For a mock provider, config is always valid
    return true;
  }

  async sendMessage(
    messages: Message[],
    _config: LLMConfig,
    _mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    const userMessage = messages.find(msg => msg.role === 'user');
    const prompt = userMessage ? userMessage.content : '';

    for (const mockResponse of MockProvider.cannedResponses) {
      if (mockResponse.promptRegex.test(prompt)) {
        return {
          content: mockResponse.response,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        };
      }
    }

    // If no canned response matches, return a default or throw an error
    return {
      content: `MockProvider: No canned response for prompt: "${prompt}"`, // Changed to use template literal
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    };
  }

  async listModels(_config: LLMConfig): Promise<string[]> {
    // Return a list of mock models
    return ['mock-model-1', 'mock-model-2'];
  }

  // Helper methods for tests to configure canned responses
  static addResponse(promptRegex: RegExp, response: string) {
    MockProvider.cannedResponses.push({ promptRegex, response });
  }

  static clearResponses() {
    MockProvider.cannedResponses = [];
  }
}
