import chalk from 'chalk';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ChatLogger } from '../../config/ChatLogger.js';
import { Message, ProviderType } from '../../types/index.js';
import {
  enhanceWithContext,
  formatContextDisplay,
  getContextWarningMessage,
} from '../../utils/contextUtils.js';
import { ConfigManager } from '../../config/ConfigManager.js';

export class SingleMessageHandler {
  private providerManager: ProviderManager;
  private chatLogger: ChatLogger;
  private configManager: ConfigManager;

  constructor(providerManager: ProviderManager, chatLogger: ChatLogger) {
    this.providerManager = providerManager;
    this.chatLogger = chatLogger;
    this.configManager = new ConfigManager();
  }

  async sendSingleMessage(
    message: string,
    options: {
      provider: string;
      model: string;
      verbose?: boolean;
      showContext?: boolean;
      contextFormat?: string;
      contextThreshold?: number;
    }
  ): Promise<void> {
    // Initialize logger and start session
    await this.chatLogger.initialize();
    await this.chatLogger.startSession(options.provider as ProviderType, options.model);

    console.log(chalk.blue(`🤖 fosscode - ${options.provider} (${options.model})`));
    console.log(chalk.cyan(`👤 ${message}`));

    if (options.verbose) {
      const streamingProviders = ['openai', 'anthropic'];
      if (streamingProviders.includes(options.provider)) {
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
        options.model,
        options.verbose ?? false
      );

      const responseTime = Date.now() - startTime;

      // Log the response received
      await this.chatLogger.logMessageReceived(response, responseTime);

      // Enhance response with context information
      const enhancedResponse = enhanceWithContext(
        response,
        options.provider as ProviderType,
        options.model
      );

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

      // Display context information if enabled
      const config = this.configManager.getConfig();
      const showContext = options.showContext ?? config.contextDisplay?.enabled ?? true;
      const contextFormat =
        (options.contextFormat as 'percentage' | 'tokens' | 'both') ??
        config.contextDisplay?.format ??
        'both';

      if (showContext && enhancedResponse.context) {
        const contextDisplay = formatContextDisplay(enhancedResponse.context, contextFormat);

        if (contextDisplay) {
          console.log(chalk.cyan(`\n💭 Context: ${contextDisplay}`));
        }

        // Show context warning if enabled and threshold exceeded
        const showWarnings = config.contextDisplay?.showWarnings ?? true;
        if (showWarnings) {
          const warningMessage = getContextWarningMessage(enhancedResponse.context);
          if (warningMessage) {
            console.log(chalk.yellow(`\n⚠️  ${warningMessage}`));
          }
        }
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
}
