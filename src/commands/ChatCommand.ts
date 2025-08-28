import { render } from 'ink';
import React from 'react';
import chalk from 'chalk';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import {
  ProviderType,
  Message,
  MessagingPlatformType,
  MessagingPlatformMessage,
} from '../types/index.js';
import { App } from '../ui/App.js';
import { ConfigDefaults } from '../config/ConfigDefaults.js';
import { ChatLogger } from '../config/ChatLogger.js';
import { MessagingPlatformManager } from '../messaging/MessagingPlatformManager.js';
import { TelegramPlatform } from '../messaging/platforms/TelegramPlatform.js';
export class ChatCommand {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;
  private chatLogger: ChatLogger;
  private messagingManager: MessagingPlatformManager;
  private conversationHistory: Map<string, Message[]> = new Map();
  private firstMessageSent: Map<string, boolean> = new Map();

  constructor(verbose: boolean = false) {
    this.configManager = new ConfigManager(verbose);
    this.providerManager = new ProviderManager(this.configManager);
    this.chatLogger = new ChatLogger();
    this.messagingManager = new MessagingPlatformManager();

    // Register available messaging platforms
    this.messagingManager.registerPlatform(new TelegramPlatform());
  }

  async execute(
    message: string | undefined,
    options: {
      provider?: string;
      model?: string;
      nonInteractive?: boolean;
      verbose?: boolean;
      messagingPlatform?: MessagingPlatformType;
      mcp?: string;
      showContext?: boolean;
      contextFormat?: string;
      contextThreshold?: number;
    }
  ): Promise<void> {
    // Handle provider selection if not specified
    if (!options.provider) {
      options.provider = await this.selectProvider(options.nonInteractive ?? !!message);
    }

    // Set provider-specific default model if not specified
    if (!options.model) {
      options.model = ConfigDefaults.getDefaultModelForProvider(options.provider);
    }

    // Set MCP servers filter if provided
    if (options.mcp) {
      this.providerManager.setMCPServersFilter(options.mcp.split(',').map(s => s.trim()));
    }

    // Validate specific provider configuration
    await this.configManager.validateProvider(options.provider as ProviderType);
    await this.providerManager.initializeProvider(options.provider as ProviderType);

    // Handle messaging platform mode
    if (options.messagingPlatform) {
      await this.handleMessagingMode({
        provider: options.provider!,
        model: options.model!,
        messagingPlatform: options.messagingPlatform,
        verbose: options.verbose ?? false,
      });
      return;
    }

    // Non-interactive mode: send single message and exit
    if (options.nonInteractive ?? !!message) {
      if (!message) {
        console.error(chalk.red('Error: Message is required in non-interactive mode'));
        console.log(chalk.yellow('Usage: fosscode chat "your message" --non-interactive'));
        process.exit(1);
      }

      await this.sendSingleMessage(message, {
        provider: options.provider!,
        model: options.model!,
        verbose: options.verbose ?? false,
        showContext: options.showContext ?? undefined,
        contextFormat: options.contextFormat ?? undefined,
        contextThreshold: options.contextThreshold ?? undefined,
      });
      return;
    }

    // Interactive mode: start TUI
    try {
      render(
        React.createElement(App, {
          provider: options.provider as ProviderType,
          model: options.model,
          providerManager: this.providerManager,
          verbose: options.verbose ?? false,
          onModelChange: (newModel: string) => {
            console.log(chalk.yellow(`\n🔄 Model selected: ${newModel}`));
            console.log(
              chalk.gray(`💡 To use this model, restart with: fosscode chat --model ${newModel}\n`)
            );
          },
        })
      );
    } catch (error) {
      // Fallback for environments where Ink/raw mode is not supported (e.g., tests, CI)
      if (error instanceof Error && error.message.includes('Raw mode is not supported')) {
        console.log(chalk.cyan(`🤖 fosscode - ${options.provider} (${options.model})`));
        console.log(
          chalk.yellow(
            '> Type your message... (Interactive mode not available in this environment)'
          )
        );
        console.log(
          chalk.gray(
            'Commands: /verbose (toggle), /clear (clear), /compress (summarize), /themes (switch)'
          )
        );
        console.log(
          chalk.gray(
            'Raw mode is not supported on the current process.stdin, which Ink uses as input stream by default.'
          )
        );
        console.log(
          chalk.gray(
            'Read about how to prevent this error on https://github.com/vadimdemedes/ink/#israwmodesupported'
          )
        );
        process.exit(0);
      } else {
        throw error;
      }
    }
  }

  private async sendSingleMessage(
    message: string,
    options: {
      provider: string;
      model: string;
      verbose?: boolean | undefined;
      showContext?: boolean | undefined;
      contextFormat?: string | undefined;
      contextThreshold?: number | undefined;
    }
  ): Promise<void> {
    // Initialize logger and start session
    await this.chatLogger.initialize();
    await this.chatLogger.startSession(options.provider as ProviderType, options.model);

    console.log(chalk.blue(`🤖 fosscode - ${options.provider} (${options.model})`));
    console.log(chalk.cyan(`👤 ${message}`));

    if (options.verbose) {
      const streamingProviders = ['openai', 'anthropic'];
      if (streamingProviders.includes(options.provider!)) {
        console.log(chalk.gray('🤔 Model is thinking... (streaming enabled)'));
      } else {
        console.log(
          chalk.gray('🤔 Model is thinking... (verbose mode - no streaming for this provider)')
        );
      }
    } else {
      console.log(chalk.gray('Thinking...'));
    }

    const chatMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    // Log the message being sent
    await this.chatLogger.logMessageSent(chatMessage);

    const startTime = Date.now();

    try {
      const response = await this.providerManager.sendMessage(
        options.provider as ProviderType,
        [chatMessage],
        options.model!,
        options.verbose ?? false
      );

      const responseTime = Date.now() - startTime;

      // Log the response received
      await this.chatLogger.logMessageReceived(response, responseTime);

      // For verbose mode, the response is already streamed to stdout
      // For non-verbose mode, show the response
      if (!options.verbose) {
        if (response.content.includes('Executing tools')) {
          // Show tool execution details
          console.log(chalk.green('🤖'), response.content);
        } else {
          console.log(chalk.green('🤖'), response.content);
        }
      }

      if (response.usage) {
        console.log(
          chalk.gray(
            `\n📊 Usage: ${response.usage.totalTokens} tokens (${response.usage.promptTokens} prompt, ${response.usage.completionTokens} completion)`
          )
        );
      }

      // End session successfully
      await this.chatLogger.endSession('completed');
    } catch (error) {
      // Log the error and end session with error status
      await this.chatLogger.logError(error instanceof Error ? error : new Error('Unknown error'));
      await this.chatLogger.endSession('error');
      throw error;
    }

    process.exit(0);
  }

  private async selectProvider(isNonInteractive: boolean): Promise<string> {
    const availableProviders = [
      'openai',
      'grok',
      'lmstudio',
      'openrouter',
      'sonicfree',
      'anthropic',
    ];
    const configuredProviders: string[] = [];

    console.log(chalk.blue('🔍 Checking configured providers...'));

    // Check which providers are properly configured
    for (const provider of availableProviders) {
      try {
        await this.configManager.validateProvider(provider as ProviderType);
        await this.providerManager.initializeProvider(provider as ProviderType);
        configuredProviders.push(provider);
        console.log(chalk.green(`  ✅ ${provider}`));
      } catch (_error) {
        console.log(chalk.gray(`  ❌ ${provider} (not configured)`));
      }
    }

    if (configuredProviders.length === 0) {
      console.log(chalk.red('\n❌ No providers are configured!'));
      console.log(chalk.yellow('\n📝 To get started, configure a provider:'));
      console.log(chalk.cyan('  • SonicFree (free):'), 'bun run start auth login sonicfree');
      console.log(chalk.cyan('  • Grok (free):'), 'bun run start auth login grok');
      console.log(chalk.cyan('  • OpenAI (paid):'), 'bun run start auth login openai');
      console.log(chalk.cyan('  • LMStudio (local):'), 'bun run start auth login lmstudio');
      console.log(chalk.cyan('  • OpenRouter (paid):'), 'bun run start auth login openrouter');
      process.exit(1);
    }

    if (configuredProviders.length === 1) {
      const provider = configuredProviders[0];
      console.log(chalk.green(`\n🎯 Using ${provider} (only configured provider)`));
      return provider;
    }

    // Multiple providers configured - let user choose
    console.log(chalk.blue(`\n📋 Multiple providers configured. Please choose:`));
    configuredProviders.forEach((provider, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${provider}`));
    });

    // For non-interactive mode, use the first configured provider
    if (isNonInteractive) {
      const provider = configuredProviders[0];
      console.log(
        chalk.yellow(`📝 Using ${provider} (first configured provider for non-interactive mode)`)
      );
      return provider;
    }

    // Interactive selection
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(chalk.yellow('\nEnter provider number (or name): '), (answer: string) => {
        rl.close();

        const trimmed = answer.trim();

        // Check if it's a number
        const num = parseInt(trimmed);
        if (!isNaN(num) && num >= 1 && num <= configuredProviders.length) {
          resolve(configuredProviders[num - 1]);
          return;
        }

        // Check if it's a provider name
        if (configuredProviders.includes(trimmed)) {
          resolve(trimmed);
          return;
        }

        // Default to first provider
        console.log(chalk.yellow(`⚠️  Invalid choice, using ${configuredProviders[0]}`));
        resolve(configuredProviders[0]);
      });
    });
  }

  private async handleCommand(
    message: MessagingPlatformMessage,
    platformType: MessagingPlatformType
  ): Promise<void> {
    const command = message.content.toLowerCase().trim();

    switch (command) {
      case '/clear':
        // Clear conversation history for this chat
        this.conversationHistory.delete(message.chatId);
        // Reset first message flag so ready message shows again
        this.firstMessageSent.delete(message.chatId);
        await this.messagingManager.sendMessage(
          platformType,
          message.chatId,
          '🧹 Conversation history cleared! Starting fresh.'
        );
        console.log(chalk.yellow(`🧹 Conversation cleared for chat ${message.chatId}`));
        break;

      case '/help': {
        const helpMessage =
          `🤖 *Available Commands:*\n\n` +
          `• /clear - Clear conversation history\n` +
          `• /help - Show this help message\n\n` +
          `Just type your message normally to chat with me!`;
        await this.messagingManager.sendMessage(platformType, message.chatId, helpMessage);
        break;
      }

      default:
        await this.messagingManager.sendMessage(
          platformType,
          message.chatId,
          `❓ Unknown command: ${command}\n\nType /help to see available commands.`
        );
        break;
    }
  }

  private async handleMessagingMode(options: {
    provider: string;
    model: string;
    messagingPlatform: MessagingPlatformType;
    verbose?: boolean;
  }): Promise<void> {
    await this.configManager.loadConfig();
    const config = this.configManager.getConfig();
    const platformConfig = config.messagingPlatforms[options.messagingPlatform];

    if (!platformConfig?.enabled) {
      console.log(chalk.red(`❌ Messaging platform ${options.messagingPlatform} is not enabled`));
      console.log(chalk.yellow(`\n📝 To enable it, update your config.json:`));
      console.log(chalk.cyan(`  "messagingPlatforms": {`));
      console.log(chalk.cyan(`    "${options.messagingPlatform}": {`));
      console.log(chalk.cyan(`      "enabled": true,`));
      console.log(chalk.cyan(`      "botToken": "your-bot-token"`));
      console.log(chalk.cyan(`    }`));
      console.log(chalk.cyan(`  }`));
      process.exit(1);
    }

    // Initialize logger and start session for messaging mode
    await this.chatLogger.initialize();
    await this.chatLogger.startSession(options.provider as ProviderType, options.model);

    console.log(
      chalk.blue(
        `🤖 fosscode - ${options.provider} (${options.model}) via ${options.messagingPlatform}`
      )
    );
    console.log(chalk.yellow(`📱 Listening for messages on ${options.messagingPlatform}...`));
    console.log(chalk.gray('Press Ctrl+C to stop'));

    // Initialize the messaging platform
    await this.messagingManager.initializePlatform(options.messagingPlatform, platformConfig);

    // Start listening for messages
    await this.messagingManager.startListening(
      options.messagingPlatform,
      platformConfig,
      async message => {
        console.log(chalk.cyan(`👤 ${message.userName}: ${message.content}`));

        // Handle commands
        if (message.content.startsWith('/')) {
          await this.handleCommand(message, options.messagingPlatform);
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
          const response = await this.providerManager.sendMessage(
            options.provider as ProviderType,
            history,
            options.model,
            options.verbose ?? false
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
          if (isFirstMessage) {
            responseMessage = `🤖 *Bot is ready and connected!*\n\nI'm now set up and ready to help you. Feel free to ask me anything!\n\n---\n\n${response.content}`;
          }

          // Send response back to the messaging platform
          const platformResponse = await this.messagingManager.sendMessage(
            options.messagingPlatform,
            message.chatId,
            responseMessage
          );

          if (platformResponse.success) {
            console.log(chalk.green(`🤖 Response sent to ${message.userName}`));
          } else {
            console.log(chalk.red(`❌ Failed to send response: ${platformResponse.error}`));
          }

          if (response.usage) {
            console.log(
              chalk.gray(
                `📊 Usage: ${response.usage.totalTokens} tokens (${response.usage.promptTokens} prompt, ${response.usage.completionTokens} completion)`
              )
            );
          }
        } catch (error) {
          const errorMessage = `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          await this.messagingManager.sendMessage(
            options.messagingPlatform,
            message.chatId,
            errorMessage
          );
          console.log(
            chalk.red(
              `❌ Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          );
        }
      }
    );

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down...'));
      await this.chatLogger.endSession('completed');
      await this.messagingManager.stopAllListeners();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down...'));
      await this.chatLogger.endSession('completed');
      await this.messagingManager.stopAllListeners();
      process.exit(0);
    });
  }
}
