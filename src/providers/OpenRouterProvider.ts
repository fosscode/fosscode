/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="node" />
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';

interface ModelInfo {
  id: string;
  [key: string]: unknown;
}

export class OpenRouterProvider implements LLMProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateConfig(_config: LLMConfig): Promise<boolean> {
    // TODO: Implement OpenRouter validation
    return !!_config.apiKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMessage(
    _messages: Message[],
    _config: LLMConfig,
    _mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // TODO: Implement OpenRouter API integration
    throw new Error('OpenRouter provider not yet implemented');
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    // Try to fetch models from OpenRouter API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((model: ModelInfo) => model.id).sort();
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Failed to fetch models from OpenRouter API: Request timeout');
      } else {
        console.warn(
          `Failed to fetch models from OpenRouter API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Fallback to placeholder if API call fails
    return ['openrouter-model'];
  }
}
