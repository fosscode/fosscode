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
      const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      let finalContent = '';
      let intermediateContent = '';
      let finishReason: 'stop' | 'length' | 'error' = 'stop';
      let finalIteration = 0;

      // Agent loop with adaptive token limits and convergence detection
      let previousContent = '';
      let noProgressCount = 0;
      const maxNoProgress = 3; // Stop if no progress for 3 iterations

      // Adaptive token limits based on task complexity
      const adaptiveTokenLimit = this.calculateAdaptiveTokenLimit(messages, mode);
      let totalTokensUsed = 0;

      console.log(`🎯 Starting agent loop with ${adaptiveTokenLimit} token budget`);

      // Performance tracking
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const startTime = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let toolCallsMade = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let iterationsWithProgress = 0;

      for (let iteration = 0; iteration < 15; iteration++) {
        // Check token budget before making API call
        if (totalTokensUsed >= adaptiveTokenLimit) {
          console.log(
            `🛑 Stopping at iteration ${iteration + 1} due to token limit (${totalTokensUsed}/${adaptiveTokenLimit})`
          );
          break;
        }

        // Advanced context compression with semantic analysis
        if (iteration > 2 && openaiMessages.length > 10) {
          const compressedMessages = await this.smartContextCompression(openaiMessages, iteration);
          openaiMessages = compressedMessages;
          console.log(`🧠 Smart compressed context to ${openaiMessages.length} messages`);
        }
        finalIteration = iteration;
        // Max 15 iterations with early stopping for convergence
        const response = await this.client.chat.completions.create({
          model: config.model ?? 'sonic',
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 16000, // Increased to use more of the 128K context window efficiently
          stream: false,
          ...(openaiTools && { tools: openaiTools }),
        });

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from SonicFree');
        }

        // Accumulate usage and track token budget
        if (response.usage) {
          totalUsage.prompt_tokens += response.usage.prompt_tokens;
          totalUsage.completion_tokens += response.usage.completion_tokens;
          totalUsage.total_tokens += response.usage.total_tokens;
          totalTokensUsed += response.usage.total_tokens;
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

        // Advanced convergence detection with quality assessment
        if (iteration > 0 && content && previousContent) {
          const similarity =
            content.length > 0 ? content.split(' ').length / previousContent.split(' ').length : 0;

          // Check for high-quality completion indicators
          const hasCompletedTask = this.detectTaskCompletion(content);
          if (hasCompletedTask) {
            console.log(`✅ Stopping early at iteration ${iteration + 1} - task appears complete`);
            break;
          }

          // Traditional convergence detection
          if (similarity > 0.8 && similarity < 1.2) {
            noProgressCount++;
            if (noProgressCount >= maxNoProgress) {
              console.log(`🔄 Stopping early at iteration ${iteration + 1} due to convergence`);
              break;
            }
          } else {
            noProgressCount = 0; // Reset counter on progress
            iterationsWithProgress++;
          }
        }
        previousContent = content || '';

        // Show LLM thinking/response for this iteration
        if (content.trim()) {
          intermediateContent += `🤔 **Iteration ${iteration + 1} - LLM Response:**\n${content}\n\n`;
        }

        // Track tool usage for performance monitoring
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          toolCallsMade += assistantMessage.tool_calls.length;
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
      // Performance summary
      const duration = Date.now() - startTime;
      const efficiency =
        iterationsWithProgress > 0 ? (iterationsWithProgress / (finalIteration + 1)) * 100 : 0;

      console.log(
        `📊 Performance: ${duration}ms, ${finalIteration + 1} iterations, ` +
          `${efficiency.toFixed(1)}% efficiency, ${toolCallsMade} tools used, ` +
          `${totalUsage.total_tokens}/${adaptiveTokenLimit} tokens`
      );

      // Provide fallback content if the agent loop stopped early
      if (!finalContent.trim()) {
        if (totalTokensUsed >= adaptiveTokenLimit) {
          finalContent = `⚠️ **Response stopped early due to token limit**\n\nThe AI agent reached the maximum token budget (${adaptiveTokenLimit} tokens) before completing the response. This usually happens with complex requests that require multiple iterations.\n\nTry:\n• Simplifying your request\n• Breaking it into smaller parts\n• Using a different model with higher token limits\n\n*Used ${totalTokensUsed} tokens in ${finalIteration + 1} iterations*`;
        } else if (finalIteration === 0) {
          finalContent = `⚠️ **No response generated**\n\nThe AI agent couldn't generate a response. This might be due to:\n• Content filtering by the AI service\n• Network issues\n• Service limitations\n\nPlease try again or rephrase your request.`;
        } else {
          finalContent = `⚠️ **Incomplete response**\n\nThe AI agent stopped after ${finalIteration + 1} iterations without completing the response. This might indicate:\n• The request was too complex\n• Content filtering occurred\n• Service limitations\n\n*Partial content may be available in the thinking trace above*`;
        }
      }

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

  /**
   * Calculate adaptive token limits based on task complexity
   */
  private calculateAdaptiveTokenLimit(messages: Message[], mode?: 'code' | 'thinking'): number {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';

    // Use full context window for Sonic model (128,000 tokens)
    let baseLimit = 120000; // Leave some buffer for system messages and overhead

    // Increase for complex tasks
    if (content.includes('refactor') || content.includes('architecture')) {
      baseLimit += 5000; // Complex architectural work
    }

    if (content.includes('debug') || content.includes('fix') || content.includes('error')) {
      baseLimit += 3000; // Debugging often requires more context
    }

    if (content.includes('test') || content.includes('testing')) {
      baseLimit += 2000; // Testing requires understanding the full system
    }

    if (mode === 'code') {
      baseLimit += 2000; // Code mode often needs more tokens
    }

    // Increase for multi-step tasks
    if (content.includes('step') || content.includes('multiple') || content.includes('several')) {
      baseLimit += 3000;
    }

    // Cap at the model's maximum context window
    return Math.min(baseLimit, 125000); // Sonic model limit is 128,000
  }

  /**
   * Advanced context compression with semantic analysis
   * Preserves important messages while compressing less critical ones
   */
  private async smartContextCompression(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    currentIteration: number
  ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const compressed: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Always keep the system message
    const systemMessage = messages.find(msg => msg.role === 'system');
    if (systemMessage) {
      compressed.push(systemMessage);
    }

    // Analyze remaining messages for importance
    const userAssistantMessages = messages.filter(msg => msg.role !== 'system');

    // Scoring system for message importance
    const scoredMessages = userAssistantMessages.map((msg, index) => {
      let score = 0;
      const content = typeof msg.content === 'string' ? msg.content : '';

      // Recent messages get higher scores
      score += (index / userAssistantMessages.length) * 30;

      // Tool calls are very important
      if ('tool_calls' in msg && msg.tool_calls) {
        score += 50;
      }

      // Tool responses are important
      if ('tool_call_id' in msg) {
        score += 40;
      }

      // Messages with code get higher scores
      if (content.includes('```') || content.includes('function') || content.includes('class')) {
        score += 25;
      }

      // Error messages are important
      if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed')) {
        score += 20;
      }

      // Questions are important for context
      if (content.includes('?')) {
        score += 15;
      }

      // Long, detailed responses are valuable
      if (content.length > 200) {
        score += 10;
      }

      return { message: msg, score, index };
    });

    // Sort by score (highest first) and take top messages
    const topMessages = scoredMessages
      .sort((a, b) => b.score - a.score)
      .slice(0, 8) // Keep top 8 most important messages
      .sort((a, b) => a.index - b.index); // Restore chronological order

    // Add top messages to compressed context
    compressed.push(...topMessages.map(item => item.message));

    // Add a summary of what was compressed
    const compressedCount = messages.length - compressed.length;
    if (compressedCount > 0) {
      const summaryMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
        role: 'system',
        content:
          `Context compressed: ${compressedCount} less important messages summarized. ` +
          `Iteration ${currentIteration + 1}, focusing on tool calls, code, and recent interactions.`,
      };
      compressed.splice(1, 0, summaryMessage); // Insert after system message
    }

    return compressed;
  }

  /**
   * Detect if the AI has completed the task based on response quality indicators
   */
  private detectTaskCompletion(content: string): boolean {
    const completionIndicators = [
      // Direct completion statements
      'task completed',
      'task is complete',
      'finished',
      'done',
      'completed successfully',
      'implementation complete',

      // Code completion indicators
      'here is the',
      "here's the",
      "i've created",
      "i've implemented",
      'the solution is',

      // Summary indicators
      'summary',
      'to summarize',
      'in conclusion',

      // Action completion
      'changes applied',
      'files updated',
      'modifications complete',
      'refactoring complete',

      // Quality indicators
      'the code is now',
      'this should',
      'you can now',
      'ready to use',
    ];

    const lowerContent = content.toLowerCase();

    // Check for multiple completion indicators
    const matches = completionIndicators.filter(indicator => lowerContent.includes(indicator));

    // Require at least 2 completion indicators for confidence
    return matches.length >= 2;
  }
}
