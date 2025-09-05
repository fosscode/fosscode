/// <reference types="node" />
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import {
  executeToolCalls,
  getOpenAIToolsFormat,
  hasAvailableTools,
} from '../utils/toolExecutor.js';
import { cancellationManager } from '../utils/CancellationManager.js';

interface ModelInfo {
  id?: string;
  object?: string;
  [key: string]: unknown;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

import { PermissionManager } from '../utils/PermissionManager.js';

export class LMStudioProvider implements LLMProvider {
  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.baseURL) {
      return false;
    }

    // Basic URL validation
    try {
      new URL(config.baseURL);
      return true;
    } catch {
      return false;
    }
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking',
    chatLogger?: any,
    permissionManager?: PermissionManager
  ): Promise<ProviderResponse> {
    if (!config.baseURL) {
      throw new Error('LMStudio baseURL not configured');
    }

    // Check if cancellation was requested
    if (cancellationManager.shouldCancel()) {
      throw new Error('Request cancelled by user');
    }

    try {
      // Generate system prompt
      const systemPrompt = await generateSystemPrompt(
        'lmstudio',
        config.model ?? 'local-model',
        mode,
        messages
      );

      // Convert messages to OpenAI format
      const openaiMessages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ];

      // Get available tools and convert to OpenAI format
      const openaiTools = hasAvailableTools() ? getOpenAIToolsFormat(mode) : undefined;

      // eslint-disable-next-line prefer-const
      let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      let finalContent = '';
      let intermediateContent = '';
      let finishReason: 'stop' | 'length' | 'error' = 'stop';

      // Agent loop for tool calling
      for (let iteration = 0; iteration < 10; iteration++) {
        // Max 10 iterations to prevent infinite loops
        // Check for cancellation between iterations
        if (cancellationManager.shouldCancel()) {
          throw new Error('Request cancelled by user');
        }

        const requestBody = {
          model: config.model ?? 'local-model',
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
          ...(openaiTools && { tools: openaiTools }),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? 30000);

        const response = await fetch(`${config.baseURL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`LMStudio API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        const choice = data.choices?.[0];
        if (!choice) {
          throw new Error('No response from LMStudio');
        }

        // Accumulate usage
        if (data.usage) {
          totalUsage.prompt_tokens += data.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += data.usage.completion_tokens || 0;
          totalUsage.total_tokens += data.usage.total_tokens || 0;
        }

        const assistantMessage = choice.message;

        // Add the assistant message to history
        if (assistantMessage.tool_calls) {
          openaiMessages.push({
            role: 'assistant',
            content: assistantMessage.content ?? '',
            tool_calls: assistantMessage.tool_calls,
          } as OpenAIMessage);
        } else {
          openaiMessages.push({
            role: 'assistant',
            content: assistantMessage.content ?? '',
          });
        }

        let content = assistantMessage.content ?? '';

        // Handle tool calls if present
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          if (!content.trim()) {
            content = 'Executing tools to help with your request...\n\n';
          }
          const toolResult = await executeToolCalls(
            assistantMessage.tool_calls,
            mode,
            chatLogger,
            permissionManager
          );

          // Add tool results as tool messages
          for (const toolCall of assistantMessage.tool_calls) {
            openaiMessages.push({
              role: 'tool',
              content: toolResult.content,
              tool_call_id: toolCall.id,
            } as OpenAIMessage);
          }

          // Continue the loop for another response
          continue;
        } else {
          // No more tool calls, this is the final response
          // Accumulate intermediate content
          if (content.trim()) {
            intermediateContent += content + '\n\n';
          }
          finalContent = intermediateContent;
          finishReason = choice.finish_reason as 'stop' | 'length' | 'error';
          break;
        }
      }

      return {
        content: finalContent,
        usage: {
          promptTokens: totalUsage.prompt_tokens,
          completionTokens: totalUsage.completion_tokens,
          totalTokens: totalUsage.total_tokens,
        },
        finishReason,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request to LMStudio timed out');
      }
      throw new Error(
        `LMStudio API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!config.baseURL) {
      throw new Error('LMStudio baseURL not configured');
    }

    // Try to fetch models from LMStudio local API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for local server

      const response = await fetch(`${config.baseURL}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((model: ModelInfo) => model.id ?? model.object).sort();
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Failed to fetch models from LMStudio API: Request timeout');
      } else {
        console.warn(
          `Failed to fetch models from LMStudio API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Fallback to placeholder if API call fails
    return ['local-model'];
  }
}
