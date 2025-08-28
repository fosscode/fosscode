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

  async listenForMessages(
    callback: (message: MessagingPlatformMessage) => Promise<void>
  ): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot is not initialized');
    }

    if (this.isListening) {
      throw new Error('Already listening for messages');
    }

    // Set up message handler
    this.bot.on('message:text', async ctx => {
      const msg = ctx.message;
      if (!msg.text) {
        return; // Ignore non-text messages
      }

      const messagingMessage: MessagingPlatformMessage = {
        id: msg.message_id.toString(),
        content: msg.text,
        userId: msg.from.id.toString(),
        userName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
        chatId: msg.chat.id.toString(),
        timestamp: new Date(msg.date * 1000),
        platform: 'telegram',
      };

      try {
        await callback(messagingMessage);
      } catch (error) {
        console.error('Error processing Telegram message:', error);
      }
    });

    // Start the bot
    this.bot.start();
    this.isListening = true;
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
