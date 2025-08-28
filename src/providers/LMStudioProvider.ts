import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import {
  executeToolCalls,
  getOpenAIToolsFormat,
  hasAvailableTools,
} from '../utils/toolExecutor.js';
import { cancellationManager } from '../utils/CancellationManager.js';
import { connectionPool } from '../utils/ConnectionPool.js';

interface ModelInfo {
  id?: string;
  object?: string;
  [key: string]: unknown;
}

export class LMStudioProvider implements LLMProvider {
  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.baseURL) {
      return false;
    }

    // Basic URL format validation
    try {
      new URL(config.baseURL);
    } catch {
      return false;
    }

    // For development/testing, skip API call validation
    // In production, you might want to uncomment the API call test below
    return true;

    /*
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
      return response.ok;
    } catch {
      return false;
    }
    */
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
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
        mode
      );

      // Prepare messages in OpenAI format
      const lmstudioMessages: any[] = [
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

        let response: any;

        if (config.verbose) {
          // Use streaming for verbose mode to show real-time output
          response = await this.sendStreamingRequest(config, lmstudioMessages, openaiTools);
        } else {
          // Check for cancellation before non-streaming request
          if (cancellationManager.shouldCancel()) {
            throw new Error('Request cancelled by user');
          }

          response = await this.sendNonStreamingRequest(config, lmstudioMessages, openaiTools);
        }

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from LMStudio');
        }

        // Accumulate usage
        if (response.usage) {
          totalUsage.prompt_tokens += response.usage.prompt_tokens;
          totalUsage.completion_tokens += response.usage.completion_tokens;
          totalUsage.total_tokens += response.usage.total_tokens;
        }

        const assistantMessage = choice.message;

        // Add the assistant message to history
        if (assistantMessage.tool_calls) {
          lmstudioMessages.push({
            role: 'assistant',
            content: assistantMessage.content ?? '',
            tool_calls: assistantMessage.tool_calls,
          });
        } else {
          lmstudioMessages.push({
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
          const toolResult = await executeToolCalls(assistantMessage.tool_calls, mode);

          // Include tool execution results in the response content
          content += toolResult.content;

          // Add tool results as tool messages
          for (const toolCall of assistantMessage.tool_calls) {
            lmstudioMessages.push({
              role: 'tool',
              content: toolResult.content,
              tool_call_id: toolCall.id,
            });
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

  private async sendStreamingRequest(
    config: LLMConfig,
    messages: any[],
    tools?: any
  ): Promise<any> {
    const requestBody = {
      model: config.model ?? 'local-model',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
      ...(tools && { tools }),
    };

    let response: Response;
    try {
      response = await connectionPool.executeWithRetry(() =>
        fetch(`${config.baseURL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Request to LMStudio server timed out. Make sure the server is running and accessible.'
        );
      }
      throw new Error(
        `Failed to connect to LMStudio server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (!response.ok) {
      let errorMessage = `LMStudio API error: ${response.status} ${response.statusText}`;

      // Add specific error messages for common issues
      if (response.status === 404) {
        errorMessage += '\n\nMake sure LMStudio is running and accessible at the configured URL.';
      } else if (response.status === 500) {
        errorMessage += '\n\nLMStudio server error. Check the LMStudio logs for more details.';
      } else if (response.status === 400) {
        errorMessage += '\n\nInvalid request. Check your model configuration.';
      }

      throw new Error(errorMessage);
    }

    let currentContent = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error(
        'No response body from LMStudio server. The connection may have been closed.'
      );
    }

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;
              if (delta?.content) {
                currentContent += delta.content;
              }
            } catch (parseError) {
              // Log parse errors in verbose mode but don't fail the request
              if (config.verbose && parseError instanceof Error) {
                console.warn(`Warning: Failed to parse streaming chunk: ${parseError.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Streaming response error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      reader.releaseLock();
    }

    // Create a mock response object for compatibility
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: currentContent,
            tool_calls: undefined,
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  private async sendNonStreamingRequest(
    config: LLMConfig,
    messages: any[],
    tools?: any
  ): Promise<any> {
    const requestBody = {
      model: config.model ?? 'local-model',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false,
      ...(tools && { tools }),
    };

    let response: Response;
    try {
      response = await connectionPool.executeWithRetry(() =>
        fetch(`${config.baseURL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          'Request to LMStudio server timed out. Make sure the server is running and accessible.'
        );
      }
      throw new Error(
        `Failed to connect to LMStudio server: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (!response.ok) {
      let errorMessage = `LMStudio API error: ${response.status} ${response.statusText}`;

      // Add specific error messages for common issues
      if (response.status === 404) {
        errorMessage += '\n\nMake sure LMStudio is running and accessible at the configured URL.';
      } else if (response.status === 500) {
        errorMessage += '\n\nLMStudio server error. Check the LMStudio logs for more details.';
      } else if (response.status === 400) {
        errorMessage += '\n\nInvalid request. Check your model configuration.';
      }

      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(
        'Failed to parse response from LMStudio server. The response may not be valid JSON.'
      );
    }
  }
}
