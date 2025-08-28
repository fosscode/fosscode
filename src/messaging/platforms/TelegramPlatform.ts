import {
  MessagingPlatform,
  MessagingPlatformType,
  MessagingPlatformConfig,
  MessagingPlatformMessage,
  MessagingPlatformResponse,
} from '../../types/index.js';

export class TelegramPlatform implements MessagingPlatform {
  private bot: any = null;
  private isListening = false;

  getPlatformType(): MessagingPlatformType {
    return 'telegram';
  }

  async initialize(config: MessagingPlatformConfig): Promise<void> {
    if (!config.botToken) {
      throw new Error('Telegram bot token is required');
    }

    try {
      // Dynamic import to avoid requiring the dependency if not used
      const TelegramBot = (await import('node-telegram-bot-api')).default;

      this.bot = new TelegramBot(config.botToken, {
        polling: false, // We'll handle polling manually
        webHook: false, // We'll use polling for simplicity
      });

      // Test the connection
      await this.bot.getMe();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Cannot find module 'node-telegram-bot-api'")
      ) {
        throw new Error(
          'Telegram platform requires node-telegram-bot-api dependency. Install it with: npm install node-telegram-bot-api'
        );
      }
      throw new Error(
        `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async sendMessage(chatId: string, message: string): Promise<MessagingPlatformResponse> {
    if (!this.bot) {
      throw new Error('Telegram bot is not initialized');
    }

    try {
      // Telegram messages have a 4096 character limit
      const chunks = this.splitMessage(message, 4000);

      for (const chunk of chunks) {
        await this.bot.sendMessage(chatId, chunk, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
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

    this.bot.on('message', async (msg: any) => {
      if (!msg.text || msg.text.startsWith('/')) {
        return; // Ignore non-text messages and commands
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

    // Start polling
    await this.bot.startPolling();
    this.isListening = true;
  }

  async stopListening(): Promise<void> {
    if (this.bot && this.isListening) {
      await this.bot.stopPolling();
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
      await this.initialize(config);
      await this.stopListening(); // Clean up
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
