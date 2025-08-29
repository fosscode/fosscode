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
    mode?: 'code' | 'thinking',
    chatLogger?: any
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
      let finalIteration = 0;

      // Agent loop for tool calling with convergence detection
      let previousContent = '';
      let noProgressCount = 0;
      const maxNoProgress = 3; // Stop if no progress for 3 iterations

      for (let iteration = 0; iteration < 15; iteration++) {
        finalIteration = iteration;
        // Max 15 iterations with early stopping for convergence
        const response = await this.client.chat.completions.create({
          model: config.model ?? 'sonic',
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 4096, // Optimal limit: generates ~3760 completion tokens (93% efficiency)
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

        // Check for convergence (no significant progress)
        if (iteration > 0 && content && previousContent) {
          const similarity =
            content.length > 0 ? content.split(' ').length / previousContent.split(' ').length : 0;
          if (similarity > 0.8 && similarity < 1.2) {
            // Content is very similar
            noProgressCount++;
            if (noProgressCount >= maxNoProgress) {
              console.log(`🔄 Stopping early at iteration ${iteration + 1} due to convergence`);
              break;
            }
          } else {
            noProgressCount = 0; // Reset counter on progress
          }
        }
        previousContent = content || '';

        // Show LLM thinking/response for this iteration
        if (content.trim()) {
          intermediateContent += `🤔 **Iteration ${iteration + 1} - LLM Response:**\n${content}\n\n`;
        }

        // Handle tool calls if present
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          if (!content.trim()) {
            content = 'Executing tools to help with your request...\n\n';
          }

          // Show tool calls being made
          intermediateContent += `🔧 **Iteration ${iteration + 1} - Tool Calls:**\n`;
          for (const toolCall of assistantMessage.tool_calls) {
            intermediateContent += `   • ${toolCall.function?.name || 'unknown'}`;
            if (toolCall.function?.arguments) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                const argSummary = Object.keys(args)
                  .slice(0, 3)
                  .map(
                    key =>
                      `${key}: ${String(args[key]).length > 20 ? String(args[key]).substring(0, 20) + '...' : args[key]}`
                  )
                  .join(', ');
                if (argSummary) {
                  intermediateContent += ` (${argSummary})`;
                }
              } catch (_e) {
                // Ignore JSON parse errors for display
              }
            }
            intermediateContent += '\n';
          }
          intermediateContent += '\n';

          // Log tool execution start
          console.log(
            `🔧 Starting tool execution: ${assistantMessage.tool_calls.length} tools in ${mode} mode`
          );

          const toolStartTime = Date.now();
          let toolResult;
          try {
            toolResult = await executeToolCalls(
              assistantMessage.tool_calls,
              mode,
              chatLogger || this.chatLogger
            );
          } catch (toolError) {
            // Log tool execution error
            await this.chatLogger.logError(
              toolError instanceof Error ? toolError : new Error('Tool execution failed')
            );
            // Continue with error message in content
            toolResult = {
              content: `❌ Error executing tools: ${toolError instanceof Error ? toolError.message : 'Unknown error'}\n\n`,
              hasToolCalls: false,
            };
          }
          const toolDuration = Date.now() - toolStartTime;

          // Log individual tool executions
          console.log(`📊 Tool execution completed in ${toolDuration}ms`);

          // Tool execution completed
          console.log(
            `✅ Tool execution completed with ${toolResult.hasToolCalls ? 'results' : 'no results'}`
          );

          // Include tool execution results in the response content
          intermediateContent += `📊 **Iteration ${iteration + 1} - Tool Results:**\n${toolResult.content}\n`;

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
          // Accumulate final response
          if (content.trim()) {
            intermediateContent += `✅ **Final Response:**\n${content}\n\n`;
          } else {
            // Log when we get an empty response for debugging
            console.warn(
              `⚠️ SonicFree returned empty content for iteration ${iteration + 1}. Finish reason: ${choice.finish_reason}`
            );
            intermediateContent += `⚠️ **Response Issue:** The AI returned an empty response. This might indicate content filtering or a service limitation.\n\n`;
          }
          finalContent = intermediateContent;
          finishReason = choice.finish_reason as 'stop' | 'length' | 'error';
          break;
        }
      }

      // Final response details
      console.log(
        `📋 Response finalized: ${finalContent.length} chars, ${finalIteration + 1} iterations, ${totalUsage.total_tokens} tokens`
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
