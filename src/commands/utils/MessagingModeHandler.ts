import { MessagingPlatformManager } from '../../messaging/MessagingPlatformManager.js';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ConfigManager } from '../../config/ConfigManager.js';
import { ChatLogger } from '../../config/ChatLogger.js';
import { Message, MessagingPlatformType, ProviderType } from '../../types/index.js';
import { CommandHandler } from './CommandHandler.js';

export class MessagingModeHandler {
  private messagingManager: MessagingPlatformManager;
  private providerManager: ProviderManager;
  private configManager: ConfigManager;
  private chatLogger: ChatLogger;
  private commandHandler: CommandHandler;
  private conversationHistory: Map<string, Message[]>;
  private firstMessageSent: Map<string, boolean>;

  constructor(
    messagingManager: MessagingPlatformManager,
    providerManager: ProviderManager,
    configManager: ConfigManager,
    chatLogger: ChatLogger,
    conversationHistory: Map<string, Message[]>,
    firstMessageSent: Map<string, boolean>
  ) {
    this.messagingManager = messagingManager;
    this.providerManager = providerManager;
    this.configManager = configManager;
    this.chatLogger = chatLogger;
    this.conversationHistory = conversationHistory;
    this.firstMessageSent = firstMessageSent;
    this.commandHandler = new CommandHandler(
      messagingManager,
      providerManager,
      configManager,
      conversationHistory
    );
  }

  async handleMessagingMode(options: {
    provider: string;
    model: string;
    messagingPlatform: MessagingPlatformType;
    verbose?: boolean;
  }): Promise<void> {
    await this.configManager.loadConfig();
    const config = this.configManager.getConfig();
    const platformConfig = config.messagingPlatforms?.[options.messagingPlatform];

    if (!platformConfig?.enabled) {
      this.showPlatformConfigurationHelp(options.messagingPlatform);
      process.exit(1);
    }

    // Initialize logger and start session for messaging mode
    await this.chatLogger.initialize();
    await this.chatLogger.startSession(options.provider as ProviderType, options.model);

    await this.chatLogger.logMessagingHeader(
      options.provider,
      options.model,
      options.messagingPlatform
    );
    await this.chatLogger.logListeningStatus(options.messagingPlatform);
    console.log('Press Ctrl+C to stop');

    // Initialize the messaging platform with error handling
    try {
      await this.messagingManager.initializePlatform(options.messagingPlatform, platformConfig);
      await this.chatLogger.logPlatformInit(options.messagingPlatform, true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.chatLogger.logPlatformInit(options.messagingPlatform, false, errorMessage);
      await this.chatLogger.endSession('error');
      process.exit(1);
    }

    // Start listening for messages
    await this.messagingManager.startListening(options.messagingPlatform, async message => {
      await this.handleIncomingMessage(message, options);
    });

    this.setupShutdownHandlers();
  }

  private showPlatformConfigurationHelp(platform: MessagingPlatformType): void {
    console.log(`❌ Messaging platform ${platform} is not enabled`);
    console.log(`\n📝 To enable it, update your config.json:`);
    console.log(`  "messagingPlatforms": {`);
    console.log(`    "${platform}": {`);
    console.log(`      "enabled": true,`);
    console.log(`      "botToken": "your-bot-token"`);
    console.log(`    }`);
    console.log(`  }`);
  }

  private async handleIncomingMessage(
    message: any,
    options: {
      provider: string;
      model: string;
      messagingPlatform: MessagingPlatformType;
      verbose?: boolean;
    }
  ): Promise<void> {
    await this.chatLogger.logIncomingMessage(
      message.userName,
      message.content,
      message.id,
      message.chatId,
      message.platform
    );

    // Handle commands
    if (message.content.startsWith('/')) {
      await this.commandHandler.handleCommand(message, options.messagingPlatform);
      return;
    }

    // Get or initialize conversation history for this chat
    const chatId = message.chatId;
    if (!this.conversationHistory.has(chatId)) {
      this.conversationHistory.set(chatId, []);
    }
    const history = this.conversationHistory.get(chatId)!;

    // Add user message to history
    const chatMessage: Message = {
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
    };
    history.push(chatMessage);

    // Log the incoming message
    await this.chatLogger.logMessageSent(chatMessage);

    try {
      // Send a "processing" message for long operations
      if (
        message.content.toLowerCase().includes('test') ||
        message.content.toLowerCase().includes('jest')
      ) {
        await this.chatLogger.logProcessingMessage(
          'Running tests... This may take a minute or two. Please wait...'
        );
        await this.messagingManager.sendMessage(
          options.messagingPlatform,
          message.chatId,
          '⏳ Running tests... This may take a minute or two. Please wait...'
        );
      }

      const response = await this.providerManager.sendMessage(
        options.provider as ProviderType,
        history,
        options.model,
        options.verbose ?? false,
        undefined, // mode
        this.chatLogger
      );

      // Add assistant response to history
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };
      history.push(assistantMessage);

      // Log the response
      await this.chatLogger.logMessageReceived(response);

      // Check if this is the first message for this chat
      const isFirstMessage = !this.firstMessageSent.get(message.chatId);
      if (isFirstMessage) {
        this.firstMessageSent.set(message.chatId, true);
      }

      // Prepare response message with ready notification for first message
      let responseMessage = response.content;

      // Check if response is empty and provide fallback
      if (!responseMessage || responseMessage.trim().length === 0) {
        console.warn(
          `⚠️ Empty response detected from ${options.provider}. Usage: ${response.usage ? JSON.stringify(response.usage) : 'N/A'}`
        );
        responseMessage = `🤖 I received your request but couldn't generate a proper response. This might be due to:\n\n• The request being too complex or filtered\n• A temporary service issue\n• Network connectivity problems\n\nPlease try rephrasing your question or breaking it into smaller parts.`;
      }

      if (isFirstMessage) {
        responseMessage = `🤖 *Bot is ready and connected!*\n\nI'm now set up and ready to help you. Feel free to ask me anything!\n\n---\n\n${responseMessage}`;
      }

      // Send response back to the messaging platform
      const platformResponse = await this.messagingManager.sendMessage(
        options.messagingPlatform,
        message.chatId,
        responseMessage
      );

      await this.chatLogger.logResponseSent(
        message.userName,
        platformResponse.success,
        platformResponse.error
      );

      if (response.usage) {
        await this.chatLogger.logUsageStats(response.usage);
      }
    } catch (error) {
      await this.handleMessageError(error, message, options);
    }
  }

  private async handleMessageError(
    error: any,
    message: any,
    options: { messagingPlatform: MessagingPlatformType }
  ): Promise<void> {
    let errorMessage = `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;

    // Provide more helpful error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = `⏰ The operation timed out. This usually happens with long-running tasks like test execution.\n\n💡 Try:\n• Breaking your request into smaller parts\n• Running tests with specific patterns (e.g., "run tests for User component")\n• Using shorter test commands`;
      } else if (error.message.includes('jest') || error.message.includes('test')) {
        errorMessage = `🧪 Test execution failed. This might be due to:\n• Tests taking too long to run\n• Test configuration issues\n• Missing dependencies\n\nTry running a specific test file or checking the test setup.`;
      }
    }

    await this.messagingManager.sendMessage(
      options.messagingPlatform,
      message.chatId,
      errorMessage
    );
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`❌ Error processing message: ${errorMsg}`);
    await this.chatLogger.logBackendMessage('ERROR', `Error processing message: ${errorMsg}`);
  }

  private setupShutdownHandlers(): void {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await this.chatLogger.logShutdown('Shutting down...');
      try {
        await this.chatLogger.endSession('completed');
        await this.messagingManager.stopAllListeners();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.chatLogger.logShutdown('Shutting down...');
      try {
        await this.chatLogger.endSession('completed');
        await this.messagingManager.stopAllListeners();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
      process.exit(0);
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', error => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }
}
