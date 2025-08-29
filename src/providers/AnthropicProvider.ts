import Anthropic from '@anthropic-ai/sdk';
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';

import { PermissionManager } from '../utils/PermissionManager.js';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic | null = null;

  /**
   * Parse thinking blocks from Anthropic response
   * Thinking blocks are wrapped in <thinking>...</thinking> tags
   */
  private parseThinkingBlocks(content: string): { content: string; thinkingBlocks: string[] } {
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/g;
    const thinkingBlocks: string[] = [];
    let match;

    // Extract thinking blocks
    while ((match = thinkingRegex.exec(content)) !== null) {
      thinkingBlocks.push(match[1].trim());
    }

    // Remove thinking blocks from content
    const cleanContent = content.replace(thinkingRegex, '').trim();

    return { content: cleanContent, thinkingBlocks };
  }

  async validateConfig(config: LLMConfig): Promise<boolean> {
    if (!config.apiKey) {
      return false;
    }

    // Basic format validation for Anthropic API keys
    if (!config.apiKey.startsWith('sk-ant-')) {
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
      throw new Error('Anthropic API key not configured');
    }

    if (!this.client) {
      this.client = new Anthropic({
        apiKey: config.apiKey,
        timeout: config.timeout ?? 30000,
      });
    }

    try {
      // Generate system prompt
      const systemPrompt = await generateSystemPrompt(
        'anthropic',
        config.model ?? 'claude-3-sonnet-20240229',
        mode,
        messages
      );

      // Convert messages to Anthropic format
      const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

      // Add system message as the first user message if needed
      if (systemPrompt) {
        anthropicMessages.push({ role: 'user', content: systemPrompt });
        anthropicMessages.push({ role: 'assistant', content: 'I understand the system prompt.' });
      }

      // Add the conversation messages
      messages.forEach(msg => {
        anthropicMessages.push({
          role: msg.role === 'system' ? 'user' : (msg.role as 'user' | 'assistant'),
          content: msg.content,
        });
      });

      // Use streaming for verbose mode to show real-time output
      if (config.verbose) {
        const stream = await this.client.messages.create({
          model: config.model ?? 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: anthropicMessages,
          temperature: 0.7,
          stream: true,
        });

        let currentContent = '';

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            const text = chunk.delta.text;
            if (text) {
              currentContent += text;
              // Removed stdout.write() calls as they interfere with Ink rendering
              // Content is still accumulated and will be displayed by the UI
            }
          }
        }

        return {
          content: currentContent,
          usage: undefined, // Streaming doesn't provide usage info
          finishReason: 'stop',
        };
      } else {
        const response = await this.client.messages.create({
          model: config.model ?? 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: anthropicMessages,
          temperature: 0.7,
          stream: false,
        });

        const rawContent = response.content[0]?.type === 'text' ? response.content[0].text : '';
        const { content, thinkingBlocks } = this.parseThinkingBlocks(rawContent);

        const result: any = {
          content,
          usage: response.usage
            ? {
                promptTokens: response.usage.input_tokens,
                completionTokens: response.usage.output_tokens,
                totalTokens: response.usage.input_tokens + response.usage.output_tokens,
              }
            : undefined,
          finishReason: response.stop_reason as 'stop' | 'length' | 'error',
        };

        if (thinkingBlocks.length > 0) {
          result.thinkingBlocks = thinkingBlocks;
        }

        return result;
      }
    } catch (error) {
      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Initialize client if not already done
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: config.apiKey,
        timeout: config.timeout ?? 30000,
      });
    }

    try {
      // Anthropic doesn't have a direct list models endpoint like OpenAI
      // We'll return a hardcoded list of known models
      return [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1',
        'claude-2.0',
      ].sort();
    } catch (error) {
      throw new Error(
        `Failed to list Anthropic models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
