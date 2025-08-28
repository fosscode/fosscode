import { Message } from '../types/index.js';
import { ContextInfo } from './contextUtils.js';

export interface CompressionConfig {
  enableAutoCompression: boolean;
  compressionThreshold: number; // percentage
  maxCompressionRounds: number;
  compressionStrategy: 'summarize' | 'selective' | 'hybrid';
  preserveRecentMessages: number; // number of recent messages to keep uncompressed
}

export interface CompressionResult {
  compressedMessages: Message[];
  compressionRatio: number;
  originalTokenCount: number;
  compressedTokenCount: number;
  strategy: string;
}

export class ContextCompressionManager {
  private static instance: ContextCompressionManager;
  private config: CompressionConfig;

  private constructor(
    config: CompressionConfig = {
      enableAutoCompression: true,
      compressionThreshold: 80,
      maxCompressionRounds: 3,
      compressionStrategy: 'hybrid',
      preserveRecentMessages: 3,
    }
  ) {
    this.config = config;
  }

  static getInstance(config?: CompressionConfig): ContextCompressionManager {
    if (!ContextCompressionManager.instance) {
      ContextCompressionManager.instance = new ContextCompressionManager(config);
    }
    return ContextCompressionManager.instance;
  }

  /**
   * Check if compression is needed based on context usage
   */
  shouldCompress(context: ContextInfo): boolean {
    if (!this.config.enableAutoCompression || !context.percentage) {
      return false;
    }
    return context.percentage >= this.config.compressionThreshold;
  }

  /**
   * Compress conversation messages based on the configured strategy
   */
  async compressMessages(
    messages: Message[],
    context: ContextInfo,
    compressionPromptFn: (messages: Message[]) => Promise<string>
  ): Promise<CompressionResult> {
    if (!this.shouldCompress(context)) {
      return {
        compressedMessages: messages,
        compressionRatio: 1.0,
        originalTokenCount: context.usedTokens,
        compressedTokenCount: context.usedTokens,
        strategy: 'none',
      };
    }

    // const originalTokenCount = context.usedTokens; // Not needed for this strategy

    switch (this.config.compressionStrategy) {
      case 'summarize':
        return await this.compressBySummarization(messages, context, compressionPromptFn);

      case 'selective':
        return await this.compressBySelection(messages, context, compressionPromptFn);

      case 'hybrid':
      default:
        return await this.compressByHybrid(messages, context, compressionPromptFn);
    }
  }

  /**
   * Compress by creating a summary of the entire conversation
   */
  private async compressBySummarization(
    messages: Message[],
    context: ContextInfo,
    compressionPromptFn: (messages: Message[]) => Promise<string>
  ): Promise<CompressionResult> {
    try {
      const summary = await compressionPromptFn(messages);

      const compressedMessage: Message = {
        role: 'assistant',
        content: `🗜️ Context compressed. Previous conversation summary:\n\n${summary}`,
        timestamp: new Date(),
      };

      return {
        compressedMessages: [compressedMessage],
        compressionRatio: 0.1, // Assume 10% of original size
        originalTokenCount: context.usedTokens,
        compressedTokenCount: Math.floor(context.usedTokens * 0.1),
        strategy: 'summarization',
      };
    } catch (error) {
      console.warn('Summarization compression failed:', error);
      return this.fallbackCompression(messages, context);
    }
  }

  /**
   * Compress by selectively removing less important messages
   */
  private async compressBySelection(
    messages: Message[],
    context: ContextInfo,
    compressionPromptFn: (messages: Message[]) => Promise<string>
  ): Promise<CompressionResult> {
    if (messages.length <= this.config.preserveRecentMessages + 1) {
      return this.fallbackCompression(messages, context);
    }

    // Keep the most recent messages
    const recentMessages = messages.slice(-this.config.preserveRecentMessages);

    // For older messages, group them and summarize in batches
    const olderMessages = messages.slice(0, -this.config.preserveRecentMessages);
    const batchSize = Math.max(5, Math.floor(olderMessages.length / 3));

    const compressedOlderMessages: Message[] = [];

    for (let i = 0; i < olderMessages.length; i += batchSize) {
      const batch = olderMessages.slice(i, i + batchSize);
      try {
        const batchSummary = await compressionPromptFn(batch);
        compressedOlderMessages.push({
          role: 'assistant',
          content: `📝 Batch summary (${i + 1}-${Math.min(i + batchSize, olderMessages.length)}):\n${batchSummary}`,
          timestamp: new Date(),
        });
      } catch (error) {
        // If summarization fails, keep original messages
        compressedOlderMessages.push(...batch);
      }
    }

    const compressedMessages = [...compressedOlderMessages, ...recentMessages];
    const estimatedCompressionRatio = compressedMessages.length / messages.length;

    return {
      compressedMessages,
      compressionRatio: estimatedCompressionRatio,
      originalTokenCount: context.usedTokens,
      compressedTokenCount: Math.floor(context.usedTokens * estimatedCompressionRatio),
      strategy: 'selective',
    };
  }

  /**
   * Hybrid approach: summarize older messages, keep recent ones detailed
   */
  private async compressByHybrid(
    messages: Message[],
    context: ContextInfo,
    compressionPromptFn: (messages: Message[]) => Promise<string>
  ): Promise<CompressionResult> {
    if (messages.length <= this.config.preserveRecentMessages + 2) {
      return await this.compressBySummarization(messages, context, compressionPromptFn);
    }

    // Split messages: summarize older half, keep recent messages as-is
    const splitPoint = Math.floor(messages.length / 2);
    const olderMessages = messages.slice(0, splitPoint);
    const recentMessages = messages.slice(splitPoint);

    try {
      const olderSummary = await compressionPromptFn(olderMessages);

      const summaryMessage: Message = {
        role: 'assistant',
        content: `🗜️ Earlier conversation compressed:\n\n${olderSummary}`,
        timestamp: new Date(),
      };

      const compressedMessages = [summaryMessage, ...recentMessages];
      const estimatedCompressionRatio = compressedMessages.length / messages.length;

      return {
        compressedMessages,
        compressionRatio: estimatedCompressionRatio,
        originalTokenCount: context.usedTokens,
        compressedTokenCount: Math.floor(context.usedTokens * estimatedCompressionRatio),
        strategy: 'hybrid',
      };
    } catch (error) {
      console.warn('Hybrid compression failed:', error);
      return await this.compressBySelection(messages, context, compressionPromptFn);
    }
  }

  /**
   * Fallback compression when other methods fail
   */
  private fallbackCompression(messages: Message[], context: ContextInfo): CompressionResult {
    // Simple fallback: remove every other message starting from the oldest
    const compressedMessages = messages.filter(
      (_, index) => index % 2 === 0 || index >= messages.length - this.config.preserveRecentMessages
    );
    const compressionRatio = compressedMessages.length / messages.length;

    return {
      compressedMessages,
      compressionRatio,
      originalTokenCount: context.usedTokens,
      compressedTokenCount: Math.floor(context.usedTokens * compressionRatio),
      strategy: 'fallback',
    };
  }

  /**
   * Update compression configuration
   */
  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }
}
