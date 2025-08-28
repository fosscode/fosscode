import 'openai/shims/node';
import OpenAI from 'openai';
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import {
  executeToolCalls,
  getOpenAIToolsFormat,
  hasAvailableTools,
} from '../utils/toolExecutor.js';
import { cancellationManager } from '../utils/CancellationManager.js';
import { connectionPool } from '../utils/ConnectionPool.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null;

  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) {
      return false;
    }

    // Basic format validation
    if (!config.apiKey.startsWith('sk-')) {
      return false;
    }

    if (config.apiKey.length < 20) {
      return false;
    }

    // For development/testing, skip API call validation
    // In production, you might want to uncomment the API call test below
    return true;

    /*
    try {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        organization: config.organization,
        timeout: config.timeout ?? 5000, // Shorter timeout for validation
        maxRetries: 0 // No retries for validation
      });

      // Test the connection by listing models
      await client.models.list();
      return true;
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
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Check if cancellation was requested
    if (cancellationManager.shouldCancel()) {
      throw new Error('Request cancelled by user');
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        organization: config.organization,
        timeout: config.timeout ?? 30000,
        maxRetries: config.maxRetries ?? 3,
      });
    }

    try {
      // Generate system prompt
      const systemPrompt = await generateSystemPrompt(
        'openai',
        config.model ?? 'gpt-3.5-turbo',
        mode
      );

      // eslint-disable-next-line prefer-const
      let openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
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
          const stream = await connectionPool.executeWithRetry(() =>
            this.client!.chat.completions.create({
              model: config.model ?? 'gpt-3.5-turbo',
              messages: openaiMessages,
              temperature: 0.7,
              max_tokens: 2000,
              stream: true,
              ...(openaiTools && { tools: openaiTools }),
            })
          );

          let currentContent = '';
          let hasStarted = false;

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              currentContent += delta.content;
              if (!hasStarted) {
                process.stdout.write('🤖 ');
                hasStarted = true;
              }
              process.stdout.write(delta.content);
            }
          }

          if (hasStarted) {
            process.stdout.write('\n');
          }

          // Create a mock response object for compatibility with existing code
          response = {
            choices: [
              {
                message: {
                  role: 'assistant' as const,
                  content: currentContent,
                  tool_calls: undefined,
                },
                finish_reason: 'stop' as const,
              },
            ],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          };
        } else {
          // Check for cancellation before non-streaming request
          if (cancellationManager.shouldCancel()) {
            throw new Error('Request cancelled by user');
          }

          response = await connectionPool.executeWithRetry(() =>
            this.client!.chat.completions.create({
              model: config.model ?? 'gpt-3.5-turbo',
              messages: openaiMessages,
              temperature: 0.7,
              max_tokens: 2000,
              stream: false,
              ...(openaiTools && { tools: openaiTools }),
            })
          );
        }

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from OpenAI');
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
          openaiMessages.push({
            role: 'assistant',
            content: assistantMessage.content ?? '',
            tool_calls: assistantMessage.tool_calls,
          });
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
          const toolResult = await executeToolCalls(assistantMessage.tool_calls, mode);

          // Include tool execution results in the response content
          content += toolResult.content;

          // Add tool results as tool messages
          for (const toolCall of assistantMessage.tool_calls) {
            openaiMessages.push({
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
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize client if not already done
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        organization: config.organization,
        timeout: config.timeout ?? 30000,
        maxRetries: config.maxRetries ?? 3,
      });
    }

    try {
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw new Error(
        `Failed to list OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
