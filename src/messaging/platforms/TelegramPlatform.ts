import {
  MessagingPlatform,
  MessagingPlatformType,
  MessagingPlatformConfig,
  MessagingPlatformMessage,
  MessagingPlatformResponse,
} from '../../types/index.js';

// Import Bot from grammy for secure Telegram integration
import { Bot } from 'grammy';

export class TelegramPlatform implements MessagingPlatform {
  private bot: Bot | null = null;
  private isListening = false;
  private startupTime: Date | null = null;

  getPlatformType(): MessagingPlatformType {
    return 'telegram';
  }

  async initialize(config: MessagingPlatformConfig): Promise<void> {
    if (!config.botToken) {
      throw new Error('Telegram bot token is required');
    }

    try {
      this.bot = new Bot(config.botToken);

      // Test the connection
      await this.bot.api.getMe();
    } catch (error) {
      throw new Error(
        `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async sendMessage(chatId: string, message: string): Promise<MessagingPlatformResponse> {
    if (!this.bot) {
      throw new Error('Telegram bot is not initialized');
    }

    // Validate message is not empty
    if (!message || message.trim().length === 0) {
      return {
        content: '',
        success: false,
        error: 'Message text is empty',
      };
    }

    try {
      // Telegram messages have a 4096 character limit
      const chunks = this.splitMessage(message, 4000);

      for (const chunk of chunks) {
        // Try sending with Markdown parsing first
        try {
          await this.bot.api.sendMessage(chatId, chunk, {
            parse_mode: 'Markdown',
          });
        } catch (markdownError) {
          // If Markdown parsing fails, retry without parsing mode
          if (
            markdownError instanceof Error &&
            (markdownError.message.includes('parse entities') ||
              markdownError.message.includes('parse_mode'))
          ) {
            await this.bot.api.sendMessage(chatId, chunk);
          } else {
            // Re-throw if it's a different error
            throw markdownError;
          }
        }
      }

      return {
        content: message,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async startListening(): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot is not initialized');
    }

    if (this.isListening) {
      throw new Error('Already listening for messages');
    }

    // Record startup time to filter out old messages
    this.startupTime = new Date();

    // Start the bot with error handling
    try {
      await this.bot.start();
      this.isListening = true;
      console.log('✅ Telegram bot started successfully');
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  isActive(): boolean {
    return this.isListening;
  }

  async stopListening(): Promise<void> {
    if (this.bot && this.isListening) {
      this.bot.stop();
      this.isListening = false;
    }
  }

  async validateConfig(config: MessagingPlatformConfig): Promise<boolean> {
    if (!config.enabled) {
      return true; // Disabled platform is valid
    }

    if (!config.botToken) {
      throw new Error('Telegram bot token is required when platform is enabled');
    }

    try {
      // Try to initialize with the config to validate it
      const tempBot = new Bot(config.botToken);
      await tempBot.api.getMe();
      tempBot.stop(); // Clean up
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Health check for the bot
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string; details?: any }> {
    if (!this.bot) {
      return { healthy: false, message: 'Bot not initialized' };
    }

    try {
      const botInfo = await this.bot.api.getMe();
      return {
        healthy: true,
        message: 'Bot is healthy',
        details: {
          botName: botInfo.first_name,
          botUsername: botInfo.username,
          isListening: this.isListening,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Bot health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error },
      };
    }
  }

  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message];
    }

    const chunks: string[] = [];
    let remaining = message;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Find the last complete line within the limit
      let splitIndex = remaining.lastIndexOf('\n', maxLength);
      if (splitIndex === -1) {
        // No line break found, split at word boundary
        splitIndex = remaining.lastIndexOf(' ', maxLength);
        if (splitIndex === -1) {
          // No word boundary found, split at character limit
          splitIndex = maxLength;
        }
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }
}
