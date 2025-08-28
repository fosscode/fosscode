import OpenAI from 'openai';
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import {
  executeToolCalls,
  getOpenAIToolsFormat,
  hasAvailableTools,
} from '../utils/toolExecutor.js';
import { ChatLogger } from '../config/ChatLogger.js';

export class SonicFreeProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private chatLogger: ChatLogger;

  constructor() {
    this.chatLogger = new ChatLogger();
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    // SonicFree doesn't require an API key, but we can validate the baseURL
    if (config.baseURL && !config.baseURL.includes('gateway.opencode.ai')) {
      return false;
    }

    // For development/testing, skip API call validation
    return true;
  }

  async sendMessage(
    messages: Message[],
    config: LLMConfig,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: 'sonic-free', // Dummy key since it's free
        baseURL: config.baseURL ?? 'https://gateway.opencode.ai/v1',
        timeout: config.timeout ?? 30000,
        maxRetries: config.maxRetries ?? 3,
      });
    }

    try {
      // Generate system prompt
      const systemPrompt = await generateSystemPrompt('sonicfree', config.model ?? 'sonic', mode);

      // eslint-disable-next-line prefer-const
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ];

      // Get available tools and convert to OpenAI format
      const openaiTools = hasAvailableTools() ? getOpenAIToolsFormat(mode) : undefined;

      // eslint-disable-next-line prefer-const
      const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      let finalContent = '';
      let intermediateContent = '';
      let finishReason: 'stop' | 'length' | 'error' = 'stop';

      // Agent loop for tool calling
      for (let iteration = 0; iteration < 15; iteration++) {
        // Max 15 iterations to allow more attempts at solving problems
        const response = await this.client.chat.completions.create({
          model: config.model ?? 'sonic',
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
          ...(openaiTools && { tools: openaiTools }),
        });

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from SonicFree');
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

          // Log tool execution start
          await this.chatLogger.logBackendOperation(
            'tool_calls_started',
            { toolCalls: assistantMessage.tool_calls.length, mode },
            undefined,
            true
          );

          const toolStartTime = Date.now();
          let toolResult;
          try {
            toolResult = await executeToolCalls(assistantMessage.tool_calls, mode);
          } catch (toolError) {
            // Log tool execution error
            await this.chatLogger.logError(
              toolError instanceof Error ? toolError : new Error('Tool execution failed'),
              `Tool calls: ${assistantMessage.tool_calls.length}`
            );
            // Continue with error message in content
            toolResult = {
              content: `❌ Error executing tools: ${toolError instanceof Error ? toolError.message : 'Unknown error'}\n\n`,
              hasToolCalls: false,
            };
          }
          const toolDuration = Date.now() - toolStartTime;

          // Log individual tool executions
          for (const toolCall of assistantMessage.tool_calls) {
            await this.chatLogger.logToolExecution(
              toolCall.function?.name || 'unknown',
              toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {},
              toolResult.hasToolCalls ? 'executed' : 'failed',
              toolDuration,
              toolResult.hasToolCalls
            );
          }

          // Log tool execution completion
          await this.chatLogger.logBackendOperation(
            'tool_calls_completed',
            {
              toolCalls: assistantMessage.tool_calls.length,
              hasResults: toolResult.hasToolCalls,
              resultLength: toolResult.content.length,
            },
            toolDuration,
            toolResult.hasToolCalls
          );

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

      // Log final response details for debugging
      await this.chatLogger.logBackendOperation(
        'response_finalized',
        {
          contentLength: finalContent.length,
          hasContent: finalContent.trim().length > 0,
          iterations: iteration + 1,
          finishReason,
          totalTokens: totalUsage.total_tokens,
        },
        undefined,
        finalContent.trim().length > 0
      );

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
        `SonicFree API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: 'sonic-free',
        baseURL: config.baseURL ?? 'https://gateway.opencode.ai/v1',
        timeout: config.timeout ?? 30000,
        maxRetries: config.maxRetries ?? 3,
      });
    }

    try {
      const models = await this.client.models.list();
      return models.data
        .filter(model => model.id.includes('sonic') ?? model.id.includes('grok'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      throw new Error(
        `Failed to list SonicFree models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
