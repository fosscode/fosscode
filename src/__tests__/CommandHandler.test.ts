import { CommandHandler } from '../commands/utils/CommandHandler';
import { MessagingPlatformManager } from '../messaging/MessagingPlatformManager';
import { ProviderManager } from '../providers/ProviderManager';
import { ConfigManager } from '../config/ConfigManager';
import { Message, MessagingPlatformType, MessagingPlatformMessage } from '../types';

// Mock the dependencies
jest.mock('../messaging/MessagingPlatformManager');
jest.mock('../providers/ProviderManager');
jest.mock('../config/ConfigManager');
jest.mock('../commands/ThinkingCommand');

describe('Messaging Platform Command Handler', () => {
  let commandHandler: CommandHandler;
  let mockMessagingManager: jest.Mocked<MessagingPlatformManager>;
  let mockProviderManager: jest.Mocked<ProviderManager>;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockThinkingCommand: any;
  let conversationHistory: Map<string, Message[]>;

  const mockMessage: MessagingPlatformMessage = {
    id: 'msg-123',
    content: '',
    userName: 'test-user',
    userId: 'user-123',
    chatId: 'test-chat-123',
    timestamp: new Date(),
    platform: 'telegram' as MessagingPlatformType,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup conversation history
    conversationHistory = new Map();

    // Setup mocks
    mockMessagingManager = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      stopAllListeners: jest.fn().mockResolvedValue(undefined),
      getPlatform: jest.fn(),
    } as unknown as jest.Mocked<MessagingPlatformManager>;

    mockProviderManager = {
      sendMessage: jest.fn(),
    } as unknown as jest.Mocked<ProviderManager>;

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        defaultProvider: 'openai',
        defaultModel: 'gpt-3.5-turbo',
      }),
      getProviderConfig: jest.fn(),
    } as unknown as jest.Mocked<ConfigManager>;

    mockThinkingCommand = {
      execute: jest.fn(),
    };

    // Create command handler instance
    commandHandler = new CommandHandler(
      mockMessagingManager,
      mockProviderManager,
      mockConfigManager,
      conversationHistory
    );

    // Replace the thinking command with our mock
    (commandHandler as any).thinkingCommand = mockThinkingCommand;
  });

  describe('/clear, /new, /nw, /cl commands', () => {
    const clearCommands = ['/clear', '/new', '/nw', '/cl'];

    clearCommands.forEach(command => {
      it(`should handle ${command} command correctly`, async () => {
        const messageWithCommand = { ...mockMessage, content: command };

        await commandHandler.handleCommand(messageWithCommand, 'telegram');

        expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
          'telegram',
          'test-chat-123',
          '🧹 Conversation history cleared! Starting fresh.'
        );
        expect(conversationHistory.has('test-chat-123')).toBe(false);
      });
    });
  });

  describe('/help command', () => {
    it('should return help message with all available commands', async () => {
      const messageWithCommand = { ...mockMessage, content: '/help' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('🤖 *Available Commands:*')
      );
      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('/clear, /new, /nw, /cl - Clear conversation history')
      );
      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('/help - Show this help message')
      );
    });
  });

  describe('/status command', () => {
    it('should return healthy status when platform health check passes', async () => {
      const mockHealthCheck = {
        healthy: true,
        message: 'All systems operational',
        details: { uptime: '2h 30m' },
      };

      mockMessagingManager.getPlatform.mockReturnValue({
        healthCheck: jest.fn().mockResolvedValue(mockHealthCheck),
      } as any);

      const messageWithCommand = { ...mockMessage, content: '/status' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('✅ *Bot Status: Healthy*')
      );
    });

    it('should return unhealthy status when platform health check fails', async () => {
      const mockHealthCheck = {
        healthy: false,
        message: 'Connection issues detected',
      };

      mockMessagingManager.getPlatform.mockReturnValue({
        healthCheck: jest.fn().mockResolvedValue(mockHealthCheck),
      } as any);

      const messageWithCommand = { ...mockMessage, content: '/status' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❌ *Bot Status: Unhealthy*')
      );
    });

    it('should handle missing health check gracefully', async () => {
      mockMessagingManager.getPlatform.mockReturnValue({
        healthCheck: undefined,
      } as any);

      const messageWithCommand = { ...mockMessage, content: '/status' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        '❓ Health check not available for this platform'
      );
    });

    it('should handle status command errors gracefully', async () => {
      mockMessagingManager.getPlatform.mockReturnValue({
        healthCheck: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as any);

      const messageWithCommand = { ...mockMessage, content: '/status' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❌ Error checking status: Connection failed')
      );
    });
  });

  describe('/timeouts command', () => {
    it('should return timeout settings information', async () => {
      const messageWithCommand = { ...mockMessage, content: '/timeouts' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('⏱️ *Timeout Settings:*')
      );
      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('• Message Processing: 120 seconds')
      );
    });
  });

  describe('/compress command', () => {
    it('should return message when no conversation history exists', async () => {
      const messageWithCommand = { ...mockMessage, content: '/compress' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        '📝 No conversation history to compress.'
      );
    });

    it('should compress conversation history successfully', async () => {
      // Setup conversation history
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date() },
      ];
      conversationHistory.set('test-chat-123', messages);

      // Mock provider response
      const mockResponse = {
        content: 'This is a summary of the conversation.',
        finishReason: 'stop' as const,
      };
      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const messageWithCommand = { ...mockMessage, content: '/compress' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      // Should send processing message first
      expect(mockMessagingManager.sendMessage).toHaveBeenNthCalledWith(
        1,
        'telegram',
        'test-chat-123',
        '🗜️ Compressing conversation history... Please wait.'
      );

      // Should send success message
      expect(mockMessagingManager.sendMessage).toHaveBeenNthCalledWith(
        2,
        'telegram',
        'test-chat-123',
        '✅ Conversation compressed successfully! The chat history has been summarized to save space.'
      );

      // Should replace conversation history with summary
      expect(conversationHistory.get('test-chat-123')).toHaveLength(1);
      expect(conversationHistory.get('test-chat-123')![0].content).toContain(
        '🗜️ Conversation compressed'
      );
    });

    it('should handle compression errors gracefully', async () => {
      // Setup conversation history
      const messages: Message[] = [{ role: 'user', content: 'Hello', timestamp: new Date() }];
      conversationHistory.set('test-chat-123', messages);

      // Mock provider error
      mockProviderManager.sendMessage.mockRejectedValue(new Error('API Error'));

      const messageWithCommand = { ...mockMessage, content: '/compress' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❌ Failed to compress conversation: API Error')
      );
    });
  });

  describe('/thinking command', () => {
    it('should handle thinking command with arguments', async () => {
      mockThinkingCommand.execute.mockResolvedValue('Thinking mode: enabled');

      const messageWithCommand = { ...mockMessage, content: '/thinking on' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockThinkingCommand.execute).toHaveBeenCalledWith(['on']);
      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        'Thinking mode: enabled'
      );
    });

    it('should handle thinking command errors gracefully', async () => {
      mockThinkingCommand.execute.mockRejectedValue(new Error('Invalid argument'));

      const messageWithCommand = { ...mockMessage, content: '/thinking invalid' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❌ Error executing thinking command: Invalid argument')
      );
    });
  });

  describe('/quit command', () => {
    it('should handle quit command and shutdown gracefully', async () => {
      // Mock process methods
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockKill = jest.spyOn(process, 'kill').mockImplementation(() => true);

      const messageWithCommand = { ...mockMessage, content: '/quit' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('👋 Goodbye! Shutting down the bot...')
      );
      expect(mockMessagingManager.stopAllListeners).toHaveBeenCalled();

      // Cleanup mocks
      mockExit.mockRestore();
      mockKill.mockRestore();
    });

    it('should handle quit command errors gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      mockMessagingManager.stopAllListeners.mockRejectedValue(new Error('Shutdown failed'));

      const messageWithCommand = { ...mockMessage, content: '/quit' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('👋 Goodbye! Shutting down the bot...')
      );

      mockExit.mockRestore();
    });
  });

  describe('unknown commands', () => {
    it('should handle unknown commands gracefully', async () => {
      const messageWithCommand = { ...mockMessage, content: '/unknown' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        `❓ Unknown command: /unknown\n\nType /help to see available commands.`
      );
    });
  });

  describe('case insensitive commands', () => {
    it('should handle commands with different cases', async () => {
      const messageWithCommand = { ...mockMessage, content: '/CLEAR' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        '🧹 Conversation history cleared! Starting fresh.'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty message content', async () => {
      const emptyMessage = { ...mockMessage, content: '' };

      await commandHandler.handleCommand(emptyMessage, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❓ Unknown command:')
      );
    });

    it('should handle message with only whitespace', async () => {
      const whitespaceMessage = { ...mockMessage, content: '   ' };

      await commandHandler.handleCommand(whitespaceMessage, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❓ Unknown command:')
      );
    });

    it('should handle command with extra whitespace and case variations', async () => {
      const messageWithCommand = { ...mockMessage, content: '  /ClEaR  ' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        '🧹 Conversation history cleared! Starting fresh.'
      );
    });

    it('should handle malformed thinking commands', async () => {
      mockThinkingCommand.execute.mockRejectedValue(new Error('Invalid syntax'));

      const messageWithCommand = { ...mockMessage, content: '/thinking' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❌ Error executing thinking command: Invalid syntax')
      );
    });

    it('should handle compress command with very long conversation history', async () => {
      // Create a very long conversation history
      const longMessages: Message[] = [];
      for (let i = 0; i < 100; i++) {
        longMessages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'This is a test message. '.repeat(10)}`,
          timestamp: new Date(),
        });
      }
      conversationHistory.set('test-chat-123', longMessages);

      const mockResponse = {
        content: 'This is a comprehensive summary of the long conversation.',
        finishReason: 'stop' as const,
      };
      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const messageWithCommand = { ...mockMessage, content: '/compress' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockProviderManager.sendMessage).toHaveBeenCalledTimes(1);
      expect(conversationHistory.get('test-chat-123')).toHaveLength(1);
    });

    it('should handle commands with special characters', async () => {
      const messageWithCommand = { ...mockMessage, content: '/help!' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❓ Unknown command: /help!')
      );
    });
  });

  describe('MCP commands', () => {
    // Note: MCP commands are primarily handled by the UI command handler
    // The messaging command handler focuses on platform-specific commands
    it('should handle MCP-like commands as unknown in messaging context', async () => {
      const messageWithCommand = { ...mockMessage, content: '/mcp status' };

      await commandHandler.handleCommand(messageWithCommand, 'telegram');

      expect(mockMessagingManager.sendMessage).toHaveBeenCalledWith(
        'telegram',
        'test-chat-123',
        expect.stringContaining('❓ Unknown command: /mcp status')
      );
    });
  });
});
