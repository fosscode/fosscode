import { ChatCommand } from '../commands/ChatCommand';
import { ConfigManager } from '../config/ConfigManager';
import { ProviderManager } from '../providers/ProviderManager';
import { ChatLogger } from '../config/ChatLogger';

// Mock dependencies
jest.mock('../config/ConfigManager');
jest.mock('../providers/ProviderManager');
jest.mock('../config/ChatLogger');
jest.mock('../ui/App');
jest.mock('ink', () => ({
  render: jest.fn(),
}));
jest.mock('react', () => ({
  createElement: jest.fn(),
}));
jest.mock('react', () => ({
  createElement: jest.fn(),
}));

const mockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;
const mockProviderManager = ProviderManager as jest.MockedClass<typeof ProviderManager>;
const mockChatLogger = ChatLogger as jest.MockedClass<typeof ChatLogger>;

describe('ChatCommand', () => {
  let chatCommand: ChatCommand;
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    chatCommand = new ChatCommand();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('execute', () => {
    it('should execute in non-interactive mode with message', async () => {
      const message = 'Hello world';
      const options = { nonInteractive: true };

      const mockConfigManagerInstance = {
        validateProvider: jest.fn().mockResolvedValue(undefined),
        getDefaultModelForProvider: jest.fn().mockReturnValue('gpt-3.5-turbo'),
      };
      const mockProviderManagerInstance = {
        initializeProvider: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue({
          content: 'Hello from AI',
          usage: { totalTokens: 10, promptTokens: 5, completionTokens: 5 },
        }),
      };
      const mockChatLoggerInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        startSession: jest.fn().mockResolvedValue(undefined),
        logMessageSent: jest.fn().mockResolvedValue(undefined),
        logMessageReceived: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);
      mockProviderManager.mockImplementation(() => mockProviderManagerInstance as any);
      mockChatLogger.mockImplementation(() => mockChatLoggerInstance as any);

      await chatCommand.execute(message, options);

      expect(mockConfigManagerInstance.validateProvider).toHaveBeenCalled();
      expect(mockProviderManagerInstance.initializeProvider).toHaveBeenCalled();
      expect(mockChatLoggerInstance.initialize).toHaveBeenCalled();
      expect(mockChatLoggerInstance.startSession).toHaveBeenCalled();
      expect(mockProviderManagerInstance.sendMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: message,
          }),
        ]),
        expect.any(String),
        false
      );
      expect(mockChatLoggerInstance.endSession).toHaveBeenCalledWith('completed');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle error in non-interactive mode', async () => {
      const message = 'Hello world';
      const options = { nonInteractive: true };
      const error = new Error('API Error');

      const mockConfigManagerInstance = {
        validateProvider: jest.fn().mockResolvedValue(undefined),
        getDefaultModelForProvider: jest.fn().mockReturnValue('gpt-3.5-turbo'),
      };
      const mockProviderManagerInstance = {
        initializeProvider: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockRejectedValue(error),
      };
      const mockChatLoggerInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        startSession: jest.fn().mockResolvedValue(undefined),
        logMessageSent: jest.fn().mockResolvedValue(undefined),
        logError: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);
      mockProviderManager.mockImplementation(() => mockProviderManagerInstance as any);
      mockChatLogger.mockImplementation(() => mockChatLoggerInstance as any);

      await expect(chatCommand.execute(message, options)).rejects.toThrow(error);

      expect(mockChatLoggerInstance.logError).toHaveBeenCalledWith(error);
      expect(mockChatLoggerInstance.endSession).toHaveBeenCalledWith('error');
    });

    it('should require message in non-interactive mode', async () => {
      const options = { nonInteractive: true };

      await chatCommand.execute(undefined, options);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: Message is required in non-interactive mode')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle provider selection when no provider specified', async () => {
      const message = 'Hello';
      const options = { nonInteractive: true };

      // Mock the selectProvider method
      const selectProviderSpy = jest.spyOn(chatCommand as any, 'selectProvider');
      selectProviderSpy.mockResolvedValue('openai');

      const mockConfigManagerInstance = {
        validateProvider: jest.fn().mockResolvedValue(undefined),
        getDefaultModelForProvider: jest.fn().mockReturnValue('gpt-3.5-turbo'),
      };
      const mockProviderManagerInstance = {
        initializeProvider: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue({
          content: 'Hello from AI',
          usage: null,
        }),
      };
      const mockChatLoggerInstance = {
        initialize: jest.fn().mockResolvedValue(undefined),
        startSession: jest.fn().mockResolvedValue(undefined),
        logMessageSent: jest.fn().mockResolvedValue(undefined),
        logMessageReceived: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);
      mockProviderManager.mockImplementation(() => mockProviderManagerInstance as any);
      mockChatLogger.mockImplementation(() => mockChatLoggerInstance as any);

      await chatCommand.execute(message, options);

      expect(selectProviderSpy).toHaveBeenCalledWith(true);
    });
  });
});
