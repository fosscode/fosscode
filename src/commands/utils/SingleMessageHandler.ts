import { ProviderManager } from '../../providers/ProviderManager.js';
import { ChatLogger } from '../../config/ChatLogger.js';
import { Message, ProviderType } from '../../types/index.js';
import {
  enhanceWithContext,
  formatContextDisplay,
  getContextWarningMessage,
} from '../../utils/contextUtils.js';
import { ConfigManager } from '../../config/ConfigManager.js';
import { ProcessedImage } from '../../utils/ImageHandler.js';

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
      images?: ProcessedImage[];
    }
  ): Promise<void> {
    // Initialize logger and start session
    await this.chatLogger.initialize();
    await this.chatLogger.startSession(options.provider as ProviderType, options.model);

    await this.chatLogger.logSessionHeader(options.provider, options.model);
    await this.chatLogger.logUserMessageDisplay(message);

    if (options.verbose) {
      const streamingProviders = ['openai', 'anthropic'];
      if (streamingProviders.includes(options.provider)) {
        await this.chatLogger.logThinkingStatus('Model is thinking...', true);
      } else {
        await this.chatLogger.logThinkingStatus(
          'Model is thinking... (verbose mode - no streaming for this provider)',
          false
        );
      }
    } else {
      await this.chatLogger.logThinkingStatus('Thinking...', false);
    }

    // Build message content - include image info if present
    let messageContent = message;
    if (options.images && options.images.length > 0) {
      const imageInfo = options.images
        .map(img => `[Image: ${img.fileName} (${(img.sizeBytes / 1024).toFixed(1)}KB)]`)
        .join('\n');
      messageContent = `${imageInfo}\n\n${message}`;
    }

    const chatMessage: Message = {
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      ...(options.images && options.images.length > 0 && { images: options.images }),
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
        const hasToolExecution = response.content.includes('Executing tools');
        await this.chatLogger.logResponseDisplay(response.content, hasToolExecution);
      }

      if (response.usage) {
        await this.chatLogger.logUsageStats(response.usage);
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
          await this.chatLogger.logContextInfo(contextDisplay);
        }

        // Show context warning if enabled and threshold exceeded
        const showWarnings = config.contextDisplay?.showWarnings ?? true;
        if (showWarnings) {
          const warningMessage = getContextWarningMessage(enhancedResponse.context);
          if (warningMessage) {
            await this.chatLogger.logContextWarning(warningMessage);
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
