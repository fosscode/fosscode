import { BinaryChatCommand } from '../binary-chat.js';
import { PromptHistoryManager } from '../utils/PromptHistoryManager.js';

// Mock dependencies
jest.mock('../config/ConfigManager.js');
jest.mock('../providers/ProviderManager.js');
jest.mock('../utils/MessageQueue.js');
jest.mock('../utils/CancellationManager.js');
jest.mock('../utils/PromptHistoryManager.js');
jest.mock('../utils/contextUtils.js');

describe.skip('BinaryChatCommand', () => {
  let binaryChatCommand: BinaryChatCommand;
  let mockPromptHistoryManager: jest.Mocked<PromptHistoryManager>;
  let mockConfigManager: any;
  let mockProviderManager: any;
  let mockMessageQueue: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mocks
    mockPromptHistoryManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      addPrompt: jest.fn().mockResolvedValue(undefined),
      clearHistory: jest.fn().mockResolvedValue(undefined),
      getHistory: jest.fn().mockReturnValue([]),
    } as any;

    (PromptHistoryManager as jest.MockedClass<typeof PromptHistoryManager>).mockImplementation(
      () => mockPromptHistoryManager
    );

    mockConfigManager = {
      loadConfig: jest.fn().mockResolvedValue(undefined),
      getConfig: jest.fn().mockReturnValue({
        defaultProvider: 'openai',
        contextDisplay: { enabled: true, format: 'both', showWarnings: true },
      }),
      validateProvider: jest.fn().mockResolvedValue(true),
    };

    mockProviderManager = {
      initializeProvider: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Mock response',
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
      }),
    };

    mockMessageQueue = {
      addMessage: jest.fn().mockReturnValue('message-id'),
      getStats: jest.fn().mockReturnValue({ totalQueued: 0, isProcessing: false }),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    // Mock the ConfigManager constructor
    const ConfigManagerMock = jest.fn().mockImplementation(() => mockConfigManager);
    const ProviderManagerMock = jest.fn().mockImplementation(() => mockProviderManager);
    const MessageQueueMock = jest.fn().mockImplementation(() => mockMessageQueue);

    // Apply mocks
    require('../config/ConfigManager.js').ConfigManager = ConfigManagerMock;
    require('../providers/ProviderManager.js').ProviderManager = ProviderManagerMock;
    require('../utils/MessageQueue.js').MessageQueue = MessageQueueMock;

    // Create instance
    binaryChatCommand = new BinaryChatCommand();
  });

  describe('initialization', () => {
    it('should initialize PromptHistoryManager on construction', () => {
      expect(mockPromptHistoryManager.initialize).toHaveBeenCalled();
    });

    it('should handle PromptHistoryManager initialization errors gracefully', async () => {
      mockPromptHistoryManager.initialize.mockRejectedValue(new Error('Init failed'));

      // Create new instance to test error handling
      const newCommand = new BinaryChatCommand();

      // Should not throw, should handle error internally
      expect(newCommand).toBeDefined();
    });
  });

  describe('sendSingleMessage', () => {
    const defaultOptions = {
      provider: 'openai',
      model: 'gpt-4',
      verbose: false,
      showContext: true,
      contextFormat: 'both' as const,
    };

    beforeEach(() => {
      // Mock console methods to avoid output during tests
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should track prompts in history before sending', async () => {
      const testMessage = 'Test message';

      await binaryChatCommand['sendSingleMessage'](testMessage, defaultOptions);

      expect(mockPromptHistoryManager.addPrompt).toHaveBeenCalledWith(testMessage);
      expect(mockProviderManager.sendMessage).toHaveBeenCalled();
    });

    it('should handle prompt history tracking errors gracefully', async () => {
      mockPromptHistoryManager.addPrompt.mockRejectedValue(new Error('Tracking failed'));

      const testMessage = 'Test message';

      // Should not throw, should continue with message sending
      await expect(
        binaryChatCommand['sendSingleMessage'](testMessage, defaultOptions)
      ).resolves.toBeDefined();

      expect(mockProviderManager.sendMessage).toHaveBeenCalled();
    });

    it('should include context display in response when enabled', async () => {
      mockProviderManager.sendMessage.mockResolvedValue({
        content: 'Test response',
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
        context: {
          totalTokens: 100,
          remainingTokens: 400,
          percentage: 20,
        },
      });

      const result = await binaryChatCommand['sendSingleMessage']('Test', {
        ...defaultOptions,
        showContext: true,
        contextFormat: 'both',
      });

      expect(result).toContain('Test response');
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });

    it('should handle provider errors gracefully', async () => {
      mockProviderManager.sendMessage.mockRejectedValue(new Error('Provider error'));

      await expect(binaryChatCommand['sendSingleMessage']('Test', defaultOptions)).rejects.toThrow(
        'Provider error'
      );
    });
  });

  describe('execute', () => {
    const defaultExecuteOptions = {
      provider: 'openai',
      model: 'gpt-4',
      verbose: false,
      queue: false,
      showContext: true,
      contextFormat: 'both' as const,
    };

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should track prompts during execution', async () => {
      const testMessage = 'Execute test message';

      await binaryChatCommand.execute(testMessage, defaultExecuteOptions);

      expect(mockPromptHistoryManager.addPrompt).toHaveBeenCalledWith(testMessage);
    });

    it('should handle queued messages correctly', async () => {
      const testMessage = 'Queued test message';

      await binaryChatCommand.execute(testMessage, {
        ...defaultExecuteOptions,
        queue: true,
      });

      expect(mockMessageQueue.addMessage).toHaveBeenCalledWith(
        testMessage,
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4',
          verbose: false,
        })
      );
    });

    it('should validate provider configuration', async () => {
      const testMessage = 'Validation test';

      await binaryChatCommand.execute(testMessage, defaultExecuteOptions);

      expect(mockConfigManager.validateProvider).toHaveBeenCalledWith('openai');
      expect(mockProviderManager.initializeProvider).toHaveBeenCalledWith('openai');
    });
  });

  describe('integration with system prompt', () => {
    it('should work with system prompt generation that includes prompt history', async () => {
      // Mock the system prompt generation to include prompt history
      mockPromptHistoryManager.getHistory.mockReturnValue([
        'Previous prompt 1',
        'Previous prompt 2',
      ]);

      const testMessage = 'Integration test';

      await binaryChatCommand['sendSingleMessage'](testMessage, {
        provider: 'openai',
        model: 'gpt-4',
        verbose: false,
      });

      expect(mockPromptHistoryManager.addPrompt).toHaveBeenCalledWith(testMessage);
    });
  });
});
