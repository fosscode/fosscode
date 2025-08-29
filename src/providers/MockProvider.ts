import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';

interface MockResponse {
  regex: string;
  response: string;
}

export class MockProvider implements LLMProvider {
  private static cannedResponses: MockResponse[] = [];

  constructor() {
    // Load responses from environment variable if available (for E2E tests)
    this.loadResponsesFromEnv();
  }

  async validateConfig(_config: LLMConfig): Promise<boolean> {
    // For a mock provider, config is always valid
    return true;
  }

  async sendMessage(
    messages: Message[],
    _config: LLMConfig,
    _mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // Reload responses from env in case they changed
    this.loadResponsesFromEnv();

    const userMessage = messages.find(msg => msg.role === 'user');
    const prompt = userMessage ? userMessage.content : '';

    for (const mockResponse of MockProvider.cannedResponses) {
      const regex = new RegExp(mockResponse.regex, 'i');
      if (regex.test(prompt)) {
        return {
          content: mockResponse.response,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        };
      }
    }

    // If no canned response matches, return a default response
    return {
      content: `MockProvider: No canned response for prompt: "${prompt}"`,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    };
  }

  async listModels(_config: LLMConfig): Promise<string[]> {
    // Return a list of mock models
    return ['mock-model-1', 'mock-model-2'];
  }

  private loadResponsesFromEnv() {
    if (process.env.MOCK_RESPONSES) {
      try {
        MockProvider.cannedResponses = JSON.parse(process.env.MOCK_RESPONSES);
      } catch (error) {
        // If parsing fails, use empty array
        MockProvider.cannedResponses = [];
      }
    }
  }

  // Helper methods for tests to configure canned responses
  static addResponse(promptRegex: RegExp, response: string) {
    MockProvider.cannedResponses.push({ regex: promptRegex.source, response });
  }

  static clearResponses() {
    MockProvider.cannedResponses = [];
  }
}
