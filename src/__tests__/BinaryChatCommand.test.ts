// Mock dependencies before imports
jest.mock('../config/ConfigManager.js');
jest.mock('../providers/ProviderManager.js');
jest.mock('../utils/MessageQueue.js');
jest.mock('../config/ConfigDefaults.js', () => ({
  ConfigDefaults: {
    getDefaultModelForProvider: jest.fn().mockReturnValue('gpt-3.5-turbo'),
  },
}));

import { BinaryChatCommand } from '../binary-chat.js';
import { MessageQueue } from '../utils/MessageQueue.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';

describe('BinaryChatCommand', () => {
  let binaryChatCommand: BinaryChatCommand;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockProviderManager: jest.Mocked<ProviderManager>;
  let mockMessageQueue: jest.Mocked<MessageQueue>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockProviderManager = new ProviderManager(mockConfigManager) as jest.Mocked<ProviderManager>;
    mockMessageQueue = new MessageQueue() as jest.Mocked<MessageQueue>;

    // Mock the constructors
    (ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(
      () => mockConfigManager
    );
    (ProviderManager as jest.MockedClass<typeof ProviderManager>).mockImplementation(
      () => mockProviderManager
    );
    (MessageQueue as jest.MockedClass<typeof MessageQueue>).mockImplementation(
      () => mockMessageQueue
    );

    binaryChatCommand = new BinaryChatCommand();
  });

  describe('execute', () => {
    beforeEach(() => {
      // Setup common mocks
      mockConfigManager.validateProvider.mockResolvedValue();
      mockProviderManager.initializeProvider.mockResolvedValue();
      mockConfigManager.loadConfig.mockResolvedValue();
      mockConfigManager.getConfig.mockReturnValue({
        defaultProvider: 'openai',
        defaultModel: 'gpt-3.5-turbo',
        maxConversations: 100,
        theme: 'dark' as const,
        providers: {
          openai: { apiKey: 'test-key' },
          grok: { apiKey: 'test-key' },
          lmstudio: { apiKey: 'test-key' },
          openrouter: { apiKey: 'test-key' },
          sonicfree: { apiKey: 'test-key' },
          mcp: { apiKey: 'test-key' },
          anthropic: { apiKey: 'test-key' },
        } as any,
        cachedModels: {
          openai: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
          grok: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
          lmstudio: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
          openrouter: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
          sonicfree: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
          mcp: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
          anthropic: { models: [], lastUpdated: new Date(), expiresAt: new Date() },
        } as any,
      });
    });

    it('should send message immediately when queue option is not set', async () => {
      const mockResponse = {
        content: 'Test response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop' as const,
      };

      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await binaryChatCommand.execute('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(mockProviderManager.sendMessage).toHaveBeenCalledWith(
        'openai',
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Test message',
          }),
        ]),
        'gpt-3.5-turbo',
        false
      );

      expect(consoleSpy).toHaveBeenCalledWith('Test response');

      consoleSpy.mockRestore();
    });

    it('should queue message when queue option is set', async () => {
      mockMessageQueue.addMessage.mockReturnValue('msg_123');
      mockMessageQueue.getStats.mockReturnValue({
        totalQueued: 1,
        isProcessing: false,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await binaryChatCommand.execute('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
        queue: true,
      });

      expect(mockMessageQueue.addMessage).toHaveBeenCalledWith('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(mockProviderManager.sendMessage).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should select default provider when none specified', async () => {
      const mockResponse = {
        content: 'Test response',
        usage: undefined,
        finishReason: 'stop' as const,
      };

      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await binaryChatCommand.execute('Test message', {
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(mockProviderManager.sendMessage).toHaveBeenCalledWith(
        'openai',
        expect.any(Array),
        'gpt-3.5-turbo',
        false
      );

      consoleSpy.mockRestore();
    });

    it('should use default model when none specified', async () => {
      const mockResponse = {
        content: 'Test response',
        usage: undefined,
        finishReason: 'stop' as const,
      };

      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await binaryChatCommand.execute('Test message', {
        provider: 'openai',
        verbose: false,
      });

      expect(mockProviderManager.sendMessage).toHaveBeenCalledWith(
        'openai',
        expect.any(Array),
        'gpt-3.5-turbo',
        false
      );

      consoleSpy.mockRestore();
    });

    it('should handle verbose output correctly', async () => {
      const mockResponse = {
        content: 'Test response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop' as const,
      };

      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await binaryChatCommand.execute('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 fosscode - openai (gpt-3.5-turbo)')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('👤'), 'Test message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🤖'), 'Test response');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Tokens: 30'));

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

      mockProviderManager.sendMessage.mockRejectedValue(new Error('API Error'));

      // The execute method calls process.exit(1) on error, so we expect it to be called
      // rather than the promise rejecting
      await binaryChatCommand.execute('Test message', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        verbose: false,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), 'API Error');
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('Queue event handling', () => {
    it('should setup queue listeners on construction', () => {
      expect(mockMessageQueue.on).toHaveBeenCalledWith('messageProcessing', expect.any(Function));
      expect(mockMessageQueue.on).toHaveBeenCalledWith('messageCompleted', expect.any(Function));
      expect(mockMessageQueue.on).toHaveBeenCalledWith('messageFailed', expect.any(Function));
      expect(mockMessageQueue.on).toHaveBeenCalledWith('processMessage', expect.any(Function));
    });

    it('should handle messageProcessing event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Get the event listener that was registered
      const messageProcessingCall = mockMessageQueue.on.mock.calls.find(
        call => call[0] === 'messageProcessing'
      );

      if (messageProcessingCall) {
        const eventListener = messageProcessingCall[1] as (message: any) => void;

        eventListener({
          message: 'Test message',
          options: { verbose: true },
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('🔄 Processing queued message'),
          'Test message'
        );
      }

      consoleSpy.mockRestore();
    });

    it('should handle messageCompleted event', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Get the event listener that was registered
      const messageCompletedCall = mockMessageQueue.on.mock.calls.find(
        call => call[0] === 'messageCompleted'
      );

      if (messageCompletedCall) {
        const eventListener = messageCompletedCall[1] as (message: any) => void;

        eventListener({
          response: 'Test response',
          options: { verbose: true },
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('✅ Queued message completed')
        );
        expect(consoleSpy).toHaveBeenCalledWith('Test response');
      }

      consoleSpy.mockRestore();
    });

    it('should handle messageFailed event', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Get the event listener that was registered
      const messageFailedCall = mockMessageQueue.on.mock.calls.find(
        call => call[0] === 'messageFailed'
      );

      if (messageFailedCall) {
        const eventListener = messageFailedCall[1] as (message: any) => void;

        eventListener({
          error: 'Test error',
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('❌ Queued message failed:'),
          'Test error'
        );
      }

      consoleErrorSpy.mockRestore();
    });

    it('should handle processMessage event', async () => {
      const mockResponse = {
        content: 'Test response',
        usage: undefined,
        finishReason: 'stop' as const,
      };

      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      // Get the event listener that was registered
      const processMessageCall = mockMessageQueue.on.mock.calls.find(
        call => call[0] === 'processMessage'
      );

      if (processMessageCall) {
        const eventListener = processMessageCall[1] as (
          message: any,
          callback: any
        ) => Promise<void>;

        const mockCallback = jest.fn();

        // The event listener is async, so we need to await it
        await eventListener(
          {
            message: 'Test message',
            options: {
              provider: 'openai',
              model: 'gpt-3.5-turbo',
              verbose: false,
            },
          },
          mockCallback
        );

        expect(mockProviderManager.sendMessage).toHaveBeenCalledWith(
          'openai',
          expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Test message',
            }),
          ]),
          'gpt-3.5-turbo',
          false
        );

        expect(mockCallback).toHaveBeenCalledWith(null, 'Test response');
      }
    });
  });
});
