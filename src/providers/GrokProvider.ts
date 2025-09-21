import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
/// <reference types="node" />
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import {
  executeToolCalls,
  getOpenAIToolsFormat,
  hasAvailableTools,
} from '../utils/toolExecutor.js';

interface ModelInfo {
  id: string;
  [key: string]: unknown;
}

import { PermissionManager } from '../utils/PermissionManager.js';

export class GrokProvider implements LLMProvider {
  private readonly baseURL = 'https://api.x.ai/v1';

  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) {
      return false;
    }

    // Basic format validation for xAI API keys
    if (!config.apiKey.startsWith('xai-')) {
      return false;
    }

    if (config.apiKey.length < 20) {
      return false;
    }

    // For development/testing, skip API call validation
    return true;
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking',
    chatLogger?: any,
    permissionManager?: PermissionManager
  ): Promise<ProviderResponse> {
    if (!config.apiKey) {
      throw new Error('Grok API key not configured');
    }

    // Generate system prompt
    const systemPrompt = await generateSystemPrompt(
      'grok',
      config.model ?? 'grok-4-0709',
      mode,
      messages
    );

    // xAI API uses a different format - send all messages but xAI might handle conversation differently
    const grokMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // If a specific model is provided, use it first
    let modelsToTry: string[];
    if (config.model) {
      modelsToTry = [config.model];
    } else {
      // Fallback to trying different model names that xAI might use
      // Prioritize newer/working models first
      modelsToTry = [
        'grok-4-0709',
        'sonic-fast-1',
        'grok-3-fast',
        'grok-2',
        'grok-beta',
        'grok-1',
        'grok',
      ];
    }

    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        // Get available tools and convert to OpenAI format (xAI API may support this)
        const openaiTools = hasAvailableTools() ? getOpenAIToolsFormat(mode) : undefined;

        const requestBody = {
          model: modelName,
          messages: grokMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
          ...(openaiTools && { tools: openaiTools }),
        };

        console.log(`🔍 Debug - Trying xAI model: ${modelName}`);

        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (response.ok) {
          // Model worked, parse response
          const data = await response.json();

          const choice = data.choices?.[0];
          if (!choice) {
            throw new Error('No response from xAI API');
          }

          let content = choice.message?.content ?? '';

          // Handle tool calls if present (xAI may support this)
          if (choice.message?.tool_calls) {
            if (!content.trim()) {
              content = 'Executing tools to help with your request...\n\n';
            }
            try {
              const toolResult = await executeToolCalls(
                choice.message.tool_calls,
                mode,
                chatLogger,
                permissionManager
              );
              content += toolResult.content;
            } catch (error) {
              // If tool execution fails, continue with the original response
              console.warn('Tool execution failed for Grok/xAI:', error);
            }
          }

          return {
            content,
            usage: data.usage
              ? {
                  promptTokens: data.usage.prompt_tokens ?? 0,
                  completionTokens: data.usage.completion_tokens ?? 0,
                  totalTokens: data.usage.total_tokens ?? 0,
                }
              : undefined,
            finishReason: choice.finish_reason ?? 'stop',
          };
        } else if (response.status === 404) {
          // Model not found, try next one
          console.log(`🔍 Debug - Model ${modelName} not found, trying next...`);
          continue;
        } else {
          // Other error, return immediately
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `xAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message ?? 'Unknown error'}`
          );
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (
          error instanceof Error &&
          (error.message.includes('HTTP 404') || error.name === 'AbortError')
        ) {
          continue; // Try next model on 404 or timeout
        }
        throw error; // Re-throw non-404/timeout errors
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // If we get here, none of the models worked
    throw (
      lastError ??
      new Error('All Grok models failed. Please check your API key and xAI service status.')
    );
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!config.apiKey) {
      throw new Error('Grok API key not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for model listing

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          const models = data.data
            .filter(
              (model: ModelInfo) =>
                model.id &&
                (model.id.includes('grok') ||
                  model.id.includes('sonic') ||
                  model.id.includes('xai'))
            )
            .map((model: ModelInfo) => model.id)
            .sort();

          // If a specific model is configured, ensure it's included
          if (config.model && !models.includes(config.model)) {
            models.push(config.model);
            models.sort();
          }

          return models;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Failed to fetch models from xAI API: Request timeout');
      } else {
        console.warn(
          `Failed to fetch models from xAI API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Fallback to known models if API call fails
    const fallbackModels = [
      'grok-4-0709',
      'sonic-fast-1',
      'grok-3-fast',
      'grok-2',
      'grok-beta',
      'grok-1',
      'grok',
    ];

    // If a specific model is configured, include it in the fallback
    if (config.model && !fallbackModels.includes(config.model)) {
      fallbackModels.push(config.model);
      fallbackModels.sort();
    }

    return fallbackModels;
  }
}
