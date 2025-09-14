import pc from 'picocolors';
import { MessagingPlatformManager } from '../../messaging/MessagingPlatformManager.js';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ConfigManager } from '../../config/ConfigManager.js';
import { Message, MessagingPlatformType, MessagingPlatformMessage } from '../../types/index.js';
import { ThinkingCommand } from '../ThinkingCommand.js';

export class CommandHandler {
  private messagingManager: MessagingPlatformManager;
  private providerManager: ProviderManager;
  private configManager: ConfigManager;
  private conversationHistory: Map<string, Message[]>;
  private thinkingCommand: ThinkingCommand;

  constructor(
    messagingManager: MessagingPlatformManager,
    providerManager: ProviderManager,
    configManager: ConfigManager,
    conversationHistory: Map<string, Message[]>
  ) {
    this.messagingManager = messagingManager;
    this.providerManager = providerManager;
    this.configManager = configManager;
    this.conversationHistory = conversationHistory;
    this.thinkingCommand = new ThinkingCommand(configManager);
  }

  async handleCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    const command = message.content.toLowerCase().trim();

    // Handle thinking command with arguments
    if (command.startsWith('/thinking')) {
      await this.handleThinkingCommand(message, platformType);
      return;
    }

    switch (command) {
      case '/clear':
      case '/new':
      case '/nw':
      case '/cl':
        await this.handleClearCommand(message, platformType);
        break;

      case '/help':
        await this.handleHelpCommand(message, platformType);
        break;

      case '/status':
        await this.handleStatusCommand(message, platformType);
        break;

      case '/timeouts':
        await this.handleTimeoutsCommand(message, platformType);
        break;

      case '/compress':
        await this.handleCompressCommand(message, platformType);
        break;

      case '/quit':
        await this.handleQuitCommand(message, platformType);
        break;

      case '/theme':
        await this.handleThemeCommand(message, platformType);
        break;

      default:
        await this.messagingManager.sendMessage(
          platformType,
          message.chatId,
          `❓ Unknown command: ${command}\n\nType /help to see available commands.`
        );
        break;
    }
  }

  private async handleClearCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    // Clear conversation history for this chat
    this.conversationHistory.delete(message.chatId);
    await this.messagingManager.sendMessage(
      platformType,
      message.chatId,
      '🧹 Conversation history cleared! Starting fresh.'
    );
    console.log(pc.yellow(`🧹 Conversation cleared for chat ${message.chatId}`));
  }

  private async handleHelpCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    const helpMessage =
      `🤖 *Available Commands:*\n\n` +
      `• /clear, /new, /nw, /cl - Clear conversation history\n` +
      `• /compress - Compress conversation history to save space\n` +
      `• /help - Show this help message\n` +
      `• /quit - Exit the bot and terminate all processes\n` +
      `• /status - Check bot health and status\n` +
      `• /theme - Manage themes (dark/light) or list available themes\n` +
      `• /thinking - Control thinking blocks display (on/off/toggle/status)\n` +
      `• /timeouts - Show timeout settings\n\n` +
      `Just type your message normally to chat with me!`;
    await this.messagingManager.sendMessage(platformType, message.chatId, helpMessage);
  }

  private async handleStatusCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    try {
      const healthCheck = await this.messagingManager.getPlatform(platformType)?.healthCheck?.();
      if (healthCheck) {
        const statusMessage = healthCheck.healthy
          ? `✅ *Bot Status: Healthy*\n\n${healthCheck.message}\n\n${healthCheck.details ? JSON.stringify(healthCheck.details, null, 2) : ''}`
          : `❌ *Bot Status: Unhealthy*\n\n${healthCheck.message}`;
        await this.messagingManager.sendMessage(platformType, message.chatId, statusMessage);
      } else {
        await this.messagingManager.sendMessage(
          platformType,
          message.chatId,
          '❓ Health check not available for this platform'
        );
      }
    } catch (error) {
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        `❌ Error checking status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleTimeoutsCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    const timeoutInfo =
      `⏱️ *Timeout Settings:*\n\n` +
      `• Message Processing: 120 seconds\n` +
      `• Test Commands: 60 seconds default\n` +
      `• Other Commands: 10 seconds default\n` +
      `• Max Test Timeout: 120 seconds\n\n` +
      `💡 For long-running operations, the bot will send a "processing" message to keep you updated.`;
    await this.messagingManager.sendMessage(platformType, message.chatId, timeoutInfo);
  }

  private async handleCompressCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    const chatId = message.chatId;
    const history = this.conversationHistory.get(chatId) ?? [];

    if (history.length === 0) {
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        '📝 No conversation history to compress.'
      );
      return;
    }

    try {
      // Send processing message
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        '🗜️ Compressing conversation history... Please wait.'
      );

      // Create a summary prompt
      const conversationText = history
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key points, decisions made, and current context. Keep it brief but comprehensive enough to maintain continuity:

${conversationText}

Summary:`;

      const summaryMessage: Message = {
        role: 'user',
        content: summaryPrompt,
        timestamp: new Date(),
      };

      // Get current provider and model from the session
      const config = this.configManager.getConfig();
      const provider = config.defaultProvider || 'openai';
      const model = config.defaultModel || 'gpt-3.5-turbo';

      const response = await this.providerManager.sendMessage(
        provider as any,
        [summaryMessage],
        model,
        false
      );

      // Replace conversation history with the summary
      const summaryAssistantMessage: Message = {
        role: 'assistant',
        content: `🗜️ Conversation compressed. Previous context summarized:\n\n${response.content}`,
        timestamp: new Date(),
      };

      this.conversationHistory.set(chatId, [summaryAssistantMessage]);

      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        `✅ Conversation compressed successfully! The chat history has been summarized to save space.`
      );

      console.log(pc.yellow(`🗜️ Conversation compressed for chat ${message.chatId}`));
    } catch (error) {
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        `❌ Failed to compress conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      console.log(
        pc.red(
          `❌ Error compressing conversation for chat ${message.chatId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  private async handleThinkingCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    try {
      // Parse command arguments
      const args = message.content.trim().split(/\s+/).slice(1); // Remove '/thinking' and get remaining args
      const response = await this.thinkingCommand.execute(args);

      await this.messagingManager.sendMessage(platformType, message.chatId, response);
    } catch (error) {
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        `❌ Error executing thinking command: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleQuitCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    try {
      // Send farewell message
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        '👋 Goodbye! Shutting down the bot...\n\nThe agent will exit and all processes will be terminated.'
      );

      console.log(
        pc.yellow(`👋 Quit command received from chat ${message.chatId}. Shutting down...`)
      );

      // Stop all messaging platform listeners
      await this.messagingManager.stopAllListeners();

      // Kill any child processes
      process.kill(process.pid, 'SIGTERM');

      // Exit the process after a short delay to allow cleanup
      setTimeout(() => {
        console.log(pc.green('✅ Bot shutdown complete'));
        process.exit(0);
      }, 1000);
    } catch (error) {
      console.error(
        pc.red(
          `❌ Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
      // Force exit if graceful shutdown fails
      process.exit(1);
    }
  }

  private async handleThemeCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    try {
      const args = message.content.trim().split(/\s+/).slice(1); // Get arguments after /theme
      const theme = args[0];

      if (!theme) {
        // List current theme and available themes
        await this.configManager.loadConfig();
        const config = this.configManager.getConfig();
        const currentTheme = config.theme || 'light';

        const themeMessage =
          `🎨 *Available Themes:*\n\n` +
          `• Current theme: **${currentTheme}**\n\n` +
          `Available themes:\n` +
          `• \`light\` - Light theme\n` +
          `• \`dark\` - Dark theme\n\n` +
          `Usage: \`/theme <theme>\` (e.g., \`/theme dark\`)`;

        await this.messagingManager.sendMessage(platformType, message.chatId, themeMessage);
        return;
      }

      // Validate theme
      if (!['dark', 'light'].includes(theme)) {
        await this.messagingManager.sendMessage(
          platformType,
          message.chatId,
          `❌ Unknown theme: ${theme}\n\nAvailable themes: \`dark\`, \`light\``
        );
        return;
      }

      // Load config and set the theme
      await this.configManager.loadConfig();
      await this.configManager.setConfig('theme', theme);

      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        `✅ Theme set to: **${theme}**\n\nThe theme change will take effect on your next interaction.`
      );

      console.log(pc.yellow(`🎨 Theme changed to ${theme} for chat ${message.chatId}`));
    } catch (error) {
      await this.messagingManager.sendMessage(
        platformType,
        message.chatId,
        `❌ Error setting theme: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      console.error(
        pc.red(
          `❌ Error setting theme for chat ${message.chatId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }
}
