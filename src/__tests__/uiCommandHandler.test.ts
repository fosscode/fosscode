import { handleCommand, CommandResult } from '../ui/utils/commandHandler';
import { Message, ProviderResponse } from '../types';
import { ProviderManager } from '../providers/ProviderManager';
import { ProviderType } from '../types';

// Mock the dependencies
jest.mock('../providers/ProviderManager');
jest.mock('../config/ConfigManager');

describe('UI Command Handler', () => {
  let mockProviderManager: jest.Mocked<ProviderManager>;
  let mockConfigManager: any;

  const mockCurrentState = {
    isVerbose: false,
    theme: 'dark' as const,
    currentMode: 'code' as const,
    messages: [] as Message[],
    provider: 'openai' as ProviderType,
    model: 'gpt-3.5-turbo',
    providerManager: {} as ProviderManager,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock provider manager
    mockProviderManager = {
      sendMessage: jest.fn(),
      initializeProvider: jest.fn(),
      listModels: jest.fn(),
      getAvailableProviders: jest.fn(),
      testConnection: jest.fn(),
    } as unknown as jest.Mocked<ProviderManager>;
    mockCurrentState.providerManager = mockProviderManager;

    // Setup mock config manager
    mockConfigManager = {
      setConfig: jest.fn(),
    };

    // Mock the ConfigManager constructor
    const ConfigManagerMock = jest.fn().mockImplementation(() => mockConfigManager);
    jest.doMock('../config/ConfigManager', () => ({
      ConfigManager: ConfigManagerMock,
    }));
  });

  describe('/clear, /new, /nw, /cl commands', () => {
    const clearCommands = ['/clear', '/new', '/nw', '/cl'];

    clearCommands.forEach(command => {
      it(`should handle ${command} command correctly`, async () => {
        const result: CommandResult = await handleCommand(command, mockCurrentState);

        expect(result.type).toBe('clear');
        expect(result.shouldClearMessages).toBe(true);
        expect(result.message).toBeUndefined();
      });
    });
  });

  describe('/verbose command', () => {
    it('should toggle verbose mode from false to true', async () => {
      const stateWithVerboseFalse = { ...mockCurrentState, isVerbose: false };
      const result: CommandResult = await handleCommand('/verbose', stateWithVerboseFalse);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Verbose mode enabled');
      expect(result.shouldClearMessages).toBeUndefined();
    });

    it('should toggle verbose mode from true to false', async () => {
      const stateWithVerboseTrue = { ...mockCurrentState, isVerbose: true };
      const result: CommandResult = await handleCommand('/verbose', stateWithVerboseTrue);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Verbose mode disabled');
      expect(result.shouldClearMessages).toBeUndefined();
    });
  });

  describe('/themes command', () => {
    it('should switch from dark to light theme', async () => {
      const stateWithDarkTheme = { ...mockCurrentState, theme: 'dark' as const };

      // Mock the ConfigManager constructor to return our mock
      jest
        .spyOn(require('../config/ConfigManager'), 'ConfigManager')
        .mockImplementation(() => mockConfigManager);

      const result: CommandResult = await handleCommand('/themes', stateWithDarkTheme);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Theme switched to: light');
      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('theme', 'light');
    });

    it('should switch from light to dark theme', async () => {
      const stateWithLightTheme = { ...mockCurrentState, theme: 'light' as const };

      // Mock the ConfigManager constructor to return our mock
      jest
        .spyOn(require('../config/ConfigManager'), 'ConfigManager')
        .mockImplementation(() => mockConfigManager);

      const result: CommandResult = await handleCommand('/themes', stateWithLightTheme);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Theme switched to: dark');
      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should switch from light to dark theme', async () => {
      const stateWithLightTheme = { ...mockCurrentState, theme: 'light' as const };

      // Mock the ConfigManager constructor to return our mock
      jest
        .spyOn(require('../config/ConfigManager'), 'ConfigManager')
        .mockImplementation(() => mockConfigManager);

      const result: CommandResult = await handleCommand('/themes', stateWithLightTheme);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Theme switched to: dark');
      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('/mode and /thinking commands', () => {
    it('should switch from code to thinking mode', async () => {
      const stateWithCodeMode = { ...mockCurrentState, currentMode: 'code' as const };
      const result: CommandResult = await handleCommand('/mode', stateWithCodeMode);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Switched to thinking mode');
    });

    it('should switch from thinking to code mode', async () => {
      const stateWithThinkingMode = { ...mockCurrentState, currentMode: 'thinking' as const };
      const result: CommandResult = await handleCommand('/thinking', stateWithThinkingMode);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('Switched to code mode');
    });
  });

  describe('/help and /commands commands', () => {
    it('should return help message for /help command', async () => {
      const result: CommandResult = await handleCommand('/help', mockCurrentState);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toContain('🤖 *Available Commands:*');
      expect(result.message?.content).toContain('/verbose - Toggle verbose output mode');
      expect(result.message?.content).toContain('/themes - Switch between dark/light theme');
      expect(result.message?.content).toContain(
        '/clear, /new, /nw, /cl - Clear conversation history'
      );
      expect(result.message?.content).toContain(
        '/mode, /thinking - Toggle between code and thinking mode'
      );
      expect(result.message?.content).toContain(
        '/compress - Compress conversation history to save space'
      );
      expect(result.message?.content).toContain('/mcp - MCP server management');
      expect(result.message?.content).toContain('/help, /commands - Show this help message');
      expect(result.message?.content).toContain('Type @ followed by a filename to attach files');
      expect(result.message?.content).toContain(
        'Press Tab to toggle between code and thinking mode'
      );
    });

    it('should return help message for /commands command', async () => {
      const result: CommandResult = await handleCommand('/commands', mockCurrentState);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toContain('🤖 *Available Commands:*');
      expect(result.message?.content).toContain('/help, /commands - Show this help message');
    });
  });

  describe('/compress command', () => {
    it('should return message when no conversation history exists', async () => {
      const stateWithEmptyMessages = { ...mockCurrentState, messages: [] };
      const result: CommandResult = await handleCommand('/compress', stateWithEmptyMessages);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toBe('No conversation history to compress.');
      expect(result.shouldClearMessages).toBeUndefined();
    });

    it('should compress conversation history successfully', async () => {
      const mockResponse: ProviderResponse = {
        content: 'This is a summary of the conversation.',
        finishReason: 'stop',
      };
      mockProviderManager.sendMessage.mockResolvedValue(mockResponse);

      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date() },
      ];
      const stateWithMessages = { ...mockCurrentState, messages };

      const result: CommandResult = await handleCommand('/compress', stateWithMessages);

      expect(result.type).toBe('clear');
      expect(result.shouldClearMessages).toBe(true);
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toContain('🗜️ Conversation compressed');
      expect(result.message?.content).toContain(mockResponse.content);
      expect(mockProviderManager.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle compression errors gracefully', async () => {
      const errorMessage = 'API Error';
      mockProviderManager.sendMessage.mockRejectedValue(new Error(errorMessage));

      const messages: Message[] = [{ role: 'user', content: 'Hello', timestamp: new Date() }];
      const stateWithMessages = { ...mockCurrentState, messages };

      const result: CommandResult = await handleCommand('/compress', stateWithMessages);

      expect(result.type).toBe('message');
      expect(result.message?.role).toBe('assistant');
      expect(result.message?.content).toContain(`Failed to compress conversation: ${errorMessage}`);
      expect(result.shouldClearMessages).toBeUndefined();
    });
  });

  describe('MCP commands', () => {
    beforeEach(() => {
      // Mock MCPManager
      const mockMCPManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getAvailableServers: jest.fn(),
        isServerEnabled: jest.fn(),
        enableServers: jest.fn(),
        disableServer: jest.fn(),
      };

      jest.doMock('../mcp/index', () => ({
        MCPManager: jest.fn().mockImplementation(() => mockMCPManager),
      }));
    });

    it('should handle /mcp list command with no servers', async () => {
      const mockMCPManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getAvailableServers: jest.fn().mockReturnValue([]),
      };

      jest.doMock('../mcp/index', () => ({
        MCPManager: jest.fn().mockImplementation(() => mockMCPManager),
      }));

      const result: CommandResult = await handleCommand('/mcp list', mockCurrentState);

      expect(result.type).toBe('message');
      expect(result.message?.content).toContain('No MCP server configurations found');
    });

    it('should handle /mcp command with basic functionality', async () => {
      // Test that MCP commands are handled without throwing errors
      const result: CommandResult = await handleCommand('/mcp', mockCurrentState);

      expect(result.type).toBe('message');
      expect(result.message?.content).toContain('MCP Server Management');
    });

    it('should handle /mcp list command', async () => {
      const result: CommandResult = await handleCommand('/mcp list', mockCurrentState);

      expect(result.type).toBe('message');
      // The exact content depends on MCP manager mock, but it should return a message
      expect(result.message?.role).toBe('assistant');
    });

    it('should handle /mcp enable command', async () => {
      const result: CommandResult = await handleCommand(
        '/mcp enable test-server',
        mockCurrentState
      );

      expect(result.type).toBe('message');
      // The exact response depends on MCP configuration, but it should return a message
      expect(result.message?.role).toBe('assistant');
    });

    it('should handle /mcp disable command', async () => {
      const result: CommandResult = await handleCommand(
        '/mcp disable test-server',
        mockCurrentState
      );

      expect(result.type).toBe('message');
      // The exact response depends on MCP configuration, but it should return a message
      expect(result.message?.role).toBe('assistant');
    });

    it('should handle /mcp disable command', async () => {
      const mockMCPManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        disableServer: jest.fn().mockResolvedValue(undefined),
      };

      jest.doMock('../mcp/index', () => ({
        MCPManager: jest.fn().mockImplementation(() => mockMCPManager),
      }));

      const result: CommandResult = await handleCommand(
        '/mcp disable test-server',
        mockCurrentState
      );

      expect(result.type).toBe('message');
      expect(result.message?.content).toContain('✅ Disabled MCP servers: test-server');
    });
  });

  describe('unknown commands', () => {
    it('should return none type for unknown commands', async () => {
      const result: CommandResult = await handleCommand('/unknown', mockCurrentState);

      expect(result.type).toBe('none');
      expect(result.message).toBeUndefined();
      expect(result.shouldClearMessages).toBeUndefined();
    });

    it('should handle empty command', async () => {
      const result: CommandResult = await handleCommand('', mockCurrentState);

      expect(result.type).toBe('none');
    });

    it('should handle command with only slash', async () => {
      const result: CommandResult = await handleCommand('/', mockCurrentState);

      expect(result.type).toBe('none');
    });

    it('should handle command with extra whitespace as unknown', async () => {
      const result: CommandResult = await handleCommand('  /clear  ', mockCurrentState);

      expect(result.type).toBe('none');
    });

    it('should handle case variations as unknown commands', async () => {
      const result: CommandResult = await handleCommand('/CLEAR', mockCurrentState);

      expect(result.type).toBe('none');
    });
  });

  describe('edge cases', () => {
    it('should handle null or undefined current state gracefully', async () => {
      // This would normally cause an error, but let's test the robustness
      const result: CommandResult = await handleCommand('/clear', null as any);

      // The function should handle this gracefully or throw a meaningful error
      expect(result).toBeDefined();
    });

    it('should handle MCP commands with malformed arguments', async () => {
      const result: CommandResult = await handleCommand('/mcp', mockCurrentState);

      expect(result.type).toBe('message');
      expect(result.message?.content).toContain('MCP Server Management');
    });

    it('should handle MCP commands with invalid subcommands', async () => {
      const result: CommandResult = await handleCommand('/mcp invalid', mockCurrentState);

      expect(result.type).toBe('message');
      expect(result.message?.content).toContain('MCP Server Management');
    });
  });
});
