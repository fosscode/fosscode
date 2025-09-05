/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="node" />
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';

interface ModelInfo {
  id: string;
  [key: string]: unknown;
}

import { PermissionManager } from '../utils/PermissionManager.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import {
  executeToolCalls,
  getOpenAIToolsFormat,
  hasAvailableTools,
} from '../utils/toolExecutor.js';

export class OpenRouterProvider implements LLMProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateConfig(_config: LLMConfig): Promise<boolean> {
    // TODO: Implement OpenRouter validation
    return !!_config.apiKey;
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking',
    chatLogger?: any,
    permissionManager?: PermissionManager
  ): Promise<ProviderResponse> {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      // Generate system prompt
      const systemPrompt = await generateSystemPrompt(
        'openrouter',
        config.model ?? 'openrouter-model',
        mode,
        messages
      );

      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ];

      // Get available tools and convert to OpenAI format
      const openaiTools = hasAvailableTools() ? getOpenAIToolsFormat(mode) : undefined;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? 30000);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/fosscode/fosscode',
          'X-Title': 'fosscode',
        },
        body: JSON.stringify({
          model: config.model ?? 'openrouter-model',
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: config.maxRetries ? undefined : 4096, // Let OpenRouter handle token limits
          stream: false,
          ...(openaiTools && { tools: openaiTools }),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.choices?.[0]) {
        throw new Error('Invalid response from OpenRouter API');
      }

      const choice = data.choices[0];

      // Handle tool calls if present
      if (choice.message?.tool_calls?.length > 0) {
        if (!permissionManager) {
          throw new Error('Tool calls require permission manager');
        }

        const toolResult = await executeToolCalls(
          choice.message.tool_calls,
          mode,
          chatLogger,
          permissionManager
        );

        return {
          content: toolResult.content,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
          finishReason: choice.finish_reason as 'stop' | 'length' | 'error',
        };
      }

      return {
        content: choice.message.content || '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason: choice.finish_reason as 'stop' | 'length' | 'error',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter API request timeout');
      }
      throw new Error(
        `OpenRouter API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
