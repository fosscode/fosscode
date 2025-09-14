import { render } from 'ink';
import React from 'react';
import pc from 'picocolors';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ProviderType, Message, MessagingPlatformType } from '../types/index.js';
import { App } from '../ui/App.js';
import { ConfigDefaults } from '../config/ConfigDefaults.js';
import { ChatLogger } from '../config/ChatLogger.js';
import { MessagingPlatformManager } from '../messaging/MessagingPlatformManager.js';
import { TelegramPlatform } from '../messaging/platforms/TelegramPlatform.js';
import { ProviderSelector } from './utils/ProviderSelector.js';
import { SingleMessageHandler } from './utils/SingleMessageHandler.js';
import { MessagingModeHandler } from './utils/MessagingModeHandler.js';
import { MCPManager } from '../mcp/index.js';

import { PermissionManager } from '../utils/PermissionManager.js';
import { fileTrackerManager } from '../utils/FileTrackerManager.js';

export class ChatCommand {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;
  private chatLogger: ChatLogger;
  private messagingManager: MessagingPlatformManager;
  private mcpManager: MCPManager;
  private conversationHistory: Map<string, Message[]> = new Map();
  private firstMessageSent: Map<string, boolean> = new Map();

  // Utility handlers
  private providerSelector: ProviderSelector;
  private singleMessageHandler: SingleMessageHandler;
  private messagingModeHandler: MessagingModeHandler;

  constructor(verbose: boolean = false) {
    if (verbose) {
      console.log('Initializing ChatCommand...');
    }
    this.configManager = new ConfigManager();
    this.providerManager = new ProviderManager(this.configManager);
    this.chatLogger = new ChatLogger();
    this.messagingManager = new MessagingPlatformManager();
    this.mcpManager = new MCPManager();

    // Register available messaging platforms
    this.messagingManager.registerPlatform(new TelegramPlatform());

    // Initialize utility handlers
    this.providerSelector = new ProviderSelector(this.configManager, this.providerManager);
    this.singleMessageHandler = new SingleMessageHandler(this.providerManager, this.chatLogger);
    this.messagingModeHandler = new MessagingModeHandler(
      this.messagingManager,
      this.providerManager,
      this.configManager,
      this.chatLogger,
      this.conversationHistory,
      this.firstMessageSent
    );
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
      plan?: boolean;
    },
    permissionManager: PermissionManager
  ): Promise<void> {
    // Handle provider selection if not specified
    if (!options.provider) {
      const config = this.configManager.getConfig();
      if (config.lastSelectedProvider) {
        options.provider = config.lastSelectedProvider;
      } else {
        // Default to sonicfree for first-time users, but check if configured
        try {
          await this.configManager.validateProvider('sonicfree');
          await this.providerManager.initializeProvider('sonicfree');
          options.provider = 'sonicfree';
        } catch {
          // If sonicfree not configured, fall back to provider selection
          options.provider = await this.providerSelector.selectProvider(
            options.nonInteractive ?? !!message
          );
        }
      }
    }

    // Set model if not specified
    if (!options.model) {
      const config = this.configManager.getConfig();
      if (config.lastSelectedModel && options.provider === config.lastSelectedProvider) {
        options.model = config.lastSelectedModel;
      } else {
        options.model = ConfigDefaults.getDefaultModelForProvider(options.provider!);
      }
    }

    // Save the selected provider and model
    this.configManager.setConfig('lastSelectedProvider', options.provider as ProviderType);
    this.configManager.setConfig('lastSelectedModel', options.model);

    // Initialize MCP manager and enable specified servers
    if (options.mcp) {
      await this.mcpManager.initialize();
      const serverNames = options.mcp.split(',').map(s => s.trim());
      await this.mcpManager.enableServers(serverNames);
      if (options.verbose) {
        console.log(`Enabled MCP servers: ${serverNames.join(', ')}`);
      }
    }

    // Validate specific provider configuration
    await this.configManager.validateProvider(options.provider as ProviderType);
    await this.providerManager.initializeProvider(options.provider as ProviderType);

    // Handle messaging platform mode
    if (options.messagingPlatform) {
      await this.messagingModeHandler.handleMessagingMode({
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
        console.error(pc.red('Error: Message is required in non-interactive mode'));
        console.log(pc.yellow('Usage: fosscode chat "your message" --non-interactive'));
        process.exit(1);
      }

      // Initialize file tracker for the new session
      fileTrackerManager.startNewSession();

      await this.singleMessageHandler.sendSingleMessage(message, {
        provider: options.provider!,
        model: options.model!,
        verbose: options.verbose ?? false,
        ...(options.showContext !== undefined && { showContext: options.showContext }),
        ...(options.contextFormat !== undefined && { contextFormat: options.contextFormat }),
        ...(options.contextThreshold !== undefined && {
          contextThreshold: options.contextThreshold,
        }),
      });
      return;
    }

    // Interactive mode: start TUI
    try {
      // Check if raw mode is supported before attempting to render
      const isRawModeSupported =
        process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
      if (!isRawModeSupported) {
        throw new Error(
          'Raw mode is not supported on the current process.stdin, which Ink uses as input stream by default.'
        );
      }

      // Initialize chat logger and start session for interactive mode
      await this.chatLogger.initialize();
      await this.chatLogger.startSession(options.provider as ProviderType, options.model!);

      // Initialize file tracker for the new session
      fileTrackerManager.startNewSession();

      // Get thinking display configuration
      const config = this.configManager.getConfig();
      const showThinkingBlocks = config.thinkingDisplay?.showThinkingBlocks ?? true;

      render(
        React.createElement(App, {
          provider: options.provider as ProviderType,
          model: options.model,
          providerManager: this.providerManager,
          chatLogger: this.chatLogger,
          verbose: options.verbose ?? false,
          showThinkingBlocks,
          permissionManager: permissionManager,
          onModelChange: (_newModel: string) => {
            // Model change callback - could be used for future features
          },
        })
      );
    } catch (error) {
      // Fallback for environments where Ink/raw mode is not supported (e.g., tests, CI)
      if (
        error instanceof Error &&
        (error.message.includes('Raw mode is not supported') || error.message.includes('raw mode'))
      ) {
        console.log(pc.cyan(`🤖 fosscode - ${options.provider} (${options.model})`));
        console.log(
          pc.yellow('> Type your message... (Interactive mode not available in this environment)')
        );
        console.log(
          pc.gray(
            'Commands: /verbose (toggle), /clear|/new|/nw|/cl (clear), /compress (summarize), /themes (switch)'
          )
        );
        console.log(
          pc.gray(
            'Raw mode is not supported on the current process.stdin, which Ink uses as input stream by default.'
          )
        );
        console.log(
          pc.gray(
            'Read about how to prevent this error on https://github.com/vadimdemedes/ink/#israwmodesupported'
          )
        );
        console.log(pc.cyan('\n💡 Try using non-interactive mode instead:'));
        console.log(
          pc.white(
            `   fosscode chat "your message" --provider ${options.provider} --non-interactive`
          )
        );
        process.exit(0);
      } else {
        throw error;
      }
    }
  }
}
