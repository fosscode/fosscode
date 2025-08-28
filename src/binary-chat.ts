import chalk from 'chalk';
import { ConfigManager } from './config/ConfigManager.js';
import { ProviderManager } from './providers/ProviderManager.js';
import { ProviderType, Message, QueuedMessage } from './types/index.js';
import { ConfigDefaults } from './config/ConfigDefaults.js';
import { MessageQueue } from './utils/MessageQueue.js';
import { cancellationManager } from './utils/CancellationManager.js';
import {
  enhanceWithContext,
  formatContextDisplay,
  getContextWarningMessage,
} from './utils/contextUtils.js';

export class BinaryChatCommand {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;
  private messageQueue: MessageQueue;
  private currentProvider?: string;
  private currentModel?: string;

  constructor(verbose: boolean = false) {
    this.configManager = new ConfigManager(verbose);
    this.providerManager = new ProviderManager(this.configManager);
    this.messageQueue = new MessageQueue();
    this.setupQueueListeners();
  }

  /**
   * Setup event listeners for the message queue
   */
  private setupQueueListeners(): void {
    this.messageQueue.on('messageProcessing', (message: QueuedMessage) => {
      if (message.options.verbose) {
        console.log(
          chalk.yellow(
            `\n🔄 Processing queued message (${this.messageQueue.getStats().totalQueued} remaining):`
          ),
          message.message
        );
      }
    });

    this.messageQueue.on('messageCompleted', (message: QueuedMessage) => {
      if (message.options.verbose) {
        console.log(chalk.green('✅ Queued message completed'));
        if (message.response) {
          console.log(message.response);
        }
      } else if (message.response) {
        console.log(message.response);
      }

      if (this.messageQueue.getStats().totalQueued === 0) {
        console.log(chalk.gray('\n📭 All queued messages processed.'));
      }
    });

    this.messageQueue.on('messageFailed', (message: QueuedMessage) => {
      console.error(chalk.red('❌ Queued message failed:'), message.error);
    });

    this.messageQueue.on(
      'processMessage',
      async (
        message: QueuedMessage,
        callback: (error: Error | null, response?: string) => void
      ) => {
        try {
          const response = await this.processQueuedMessage(message);
          callback(null, response);
        } catch (error) {
          callback(error instanceof Error ? error : new Error('Unknown error'));
        }
      }
    );
  }

  /**
   * Process a queued message
   */
  private async processQueuedMessage(message: QueuedMessage): Promise<string> {
    const provider = message.options.provider || this.currentProvider;
    const model = message.options.model || this.currentModel;

    if (!provider || !model) {
      throw new Error('No provider or model specified for queued message');
    }

    return await this.sendSingleMessage(message.message, {
      provider,
      model,
      verbose: Boolean(message.options.verbose),
    });
  }

  async execute(
    message: string,
    options: {
      provider?: string;
      model?: string;
      verbose?: boolean;
      queue?: boolean;
    }
  ): Promise<void> {
    try {
      // Check if cancellation was requested at the start
      if (cancellationManager.shouldCancel()) {
        console.log(chalk.yellow('🛑 Command cancelled by user'));
        return;
      }

      // Handle provider selection if not specified
      if (!options.provider) {
        options.provider = await this.selectProvider();
      }

      // Set provider-specific default model if not specified
      if (!options.model) {
        options.model = ConfigDefaults.getDefaultModelForProvider(options.provider);
      }

      // Store current provider/model for queued messages
      this.currentProvider = options.provider;
      this.currentModel = options.model;

      // Validate specific provider configuration
      await this.configManager.validateProvider(options.provider as ProviderType);
      await this.providerManager.initializeProvider(options.provider as ProviderType);

      if (options.queue) {
        // Add message to queue instead of sending immediately
        const messageId = this.messageQueue.addMessage(message, {
          provider: options.provider,
          model: options.model,
          verbose: Boolean(options.verbose),
        });

        if (options.verbose) {
          console.log(chalk.cyan(`📝 Message queued with ID: ${messageId}`));
        }

        // Don't exit immediately if there are queued messages
        const stats = this.messageQueue.getStats();
        if (stats.totalQueued > 0) {
          if (options.verbose) {
            console.log(
              chalk.gray(
                `⏳ Queue status: ${stats.totalQueued} message(s) queued, processing: ${stats.isProcessing}`
              )
            );
          }
          return;
        }
      } else {
        // Send message immediately
        await this.sendSingleMessage(message, {
          provider: options.provider!,
          model: options.model!,
          verbose: Boolean(options.verbose),
        });
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  private async selectProvider(): Promise<string> {
    await this.configManager.loadConfig();
    const config = this.configManager.getConfig();
    const defaultProvider = config.defaultProvider;

    if (defaultProvider) {
      return defaultProvider;
    }

    // List available providers
    console.log(chalk.yellow('No default provider set. Available providers:'));
    console.log('• openai');
    console.log('• grok');
    console.log('• lmstudio');
    console.log('• openrouter');
    console.log('• sonicfree');
    console.log('• mcp');
    console.log();
    console.log(chalk.red('Please specify a provider with --provider'));
    process.exit(1);
  }

  private async sendSingleMessage(
    message: string,
    options: {
      provider: string;
      model: string;
      verbose: boolean;
    }
  ): Promise<string> {
    // Check if cancellation was requested
    if (cancellationManager.shouldCancel()) {
      throw new Error('Message cancelled by user');
    }

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    if (options.verbose) {
      console.log(chalk.gray(`🤖 fosscode - ${options.provider} (${options.model})`));
      console.log(chalk.blue('👤'), message);
      console.log(chalk.gray('Thinking...'));
    }

    try {
      const response = await this.providerManager.sendMessage(
        options.provider as ProviderType,
        [userMessage],
        options.model,
        options.verbose
      );

      // Enhance response with context information
      const enhancedResponse = enhanceWithContext(
        response,
        options.provider as ProviderType,
        options.model
      );

      let output = '';
      if (options.verbose) {
        console.log(chalk.green('🤖'), enhancedResponse.content);
        output += enhancedResponse.content;
      } else {
        console.log(enhancedResponse.content);
        output += enhancedResponse.content;
      }

      // Display token usage and context information
      if (enhancedResponse.usage) {
        const usageInfo = chalk.gray(
          `\n📊 Tokens: ${enhancedResponse.usage.totalTokens} (${enhancedResponse.usage.promptTokens} prompt, ${enhancedResponse.usage.completionTokens} completion)`
        );
        console.log(usageInfo);
        output += '\n' + usageInfo;

        // Display context percentage if available
        if (enhancedResponse.context) {
          const contextDisplay = formatContextDisplay(enhancedResponse.context, 'both');
          if (contextDisplay) {
            const contextInfo = chalk.gray(`\n🧠 Context: ${contextDisplay}`);
            console.log(contextInfo);
            output += '\n' + contextInfo;

            // Show context warning if needed
            const warningMessage = getContextWarningMessage(enhancedResponse.context);
            if (warningMessage) {
              console.log(chalk.yellow(warningMessage));
              output += '\n' + warningMessage;
            }
          }
        }
      }

      return output;
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
