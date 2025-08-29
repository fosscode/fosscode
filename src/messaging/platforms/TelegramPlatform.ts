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

  async listenForMessages(
    callback: (message: MessagingPlatformMessage) => Promise<void>
  ): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot is not initialized');
    }

    if (this.isListening) {
      throw new Error('Already listening for messages');
    }

    // Set up message handler with improved error handling
    this.bot.on('message:text', async ctx => {
      const msg = ctx.message;
      if (!msg.text) {
        return; // Ignore non-text messages
      }

      // Skip old messages that were sent before the bot started listening
      // Add a 5-second buffer to account for timing differences
      if (this.startupTime) {
        const messageTime = new Date(msg.date * 1000);
        const bufferTime = new Date(this.startupTime.getTime() - 5000); // 5 seconds before startup
        if (messageTime < bufferTime) {
          console.log(
            `⏭️ Skipping old message from ${messageTime.toISOString()} (bot started at ${this.startupTime.toISOString()})`
          );
          return;
        }
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
        // Add timeout to prevent hanging (increased for complex operations like test running)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(
                  'Message processing timeout - the operation is taking too long. Try breaking down your request into smaller parts.'
                )
              ),
            600000
          ); // 10 minute timeout
        });

        // Send periodic status updates for long operations
        let statusUpdateInterval: NodeJS.Timeout | null = null;
        const startStatusUpdates = () => {
          let updateCount = 0;
          statusUpdateInterval = setInterval(async () => {
            updateCount++;
            try {
              const statusMessage = `⏳ Still working on your request... (${updateCount * 30}s elapsed)`;
              await ctx.reply(statusMessage);
            } catch (statusError) {
              console.error('Failed to send status update:', statusError);
            }
          }, 30000); // Update every 30 seconds
        };

        // Start status updates after 30 seconds
        const statusDelay = setTimeout(startStatusUpdates, 30000);

        try {
          await Promise.race([callback(messagingMessage), timeoutPromise]);
        } finally {
          // Clean up status updates
          if (statusUpdateInterval) {
            clearInterval(statusUpdateInterval);
          }
          clearTimeout(statusDelay);
        }
      } catch (error) {
        console.error('Error processing Telegram message:', error);

        // Send error message back to user
        try {
          const errorMessage = `❌ Sorry, I encountered an error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}`;
          await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
        } catch (replyError) {
          console.error('Failed to send error message:', replyError);
        }
      }
    });

    // Add error handler for bot-level errors
    this.bot.catch(err => {
      console.error('Telegram bot error:', err);
    });

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
