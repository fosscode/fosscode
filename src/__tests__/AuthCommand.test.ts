// Mock dependencies before importing
// @ts-nocheck - Jest mock typing issues in test file
jest.mock('../config/ConfigManager');
jest.mock('../auth/LoginHandler');

import { AuthCommand } from '../commands/AuthCommand';
import { ConfigManager } from '../config/ConfigManager';
import { LoginHandler } from '../auth/LoginHandler';

const mockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;
const mockLoginHandler = LoginHandler as jest.MockedClass<typeof LoginHandler>;

// Create mock instances
const mockConfigManagerInstance = {
  getConfig: jest.fn(),
  setConfig: jest.fn(),
  saveConfig: jest.fn(),
};
const mockLoginHandlerInstance = {
  login: jest.fn(),
};

describe('AuthCommand', () => {
  let authCommand: AuthCommand;
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks
    mockConfigManager.mockClear();
    mockLoginHandler.mockClear();

    // Set up mock implementations
    mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);
    mockLoginHandler.mockImplementation(() => mockLoginHandlerInstance as any);

    authCommand = new AuthCommand(false);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('login', () => {
    it('should login successfully with valid provider', async () => {
      const provider = 'openai';
      mockLoginHandlerInstance.login.mockResolvedValue(true);

      await authCommand.login(provider);

      expect(mockLoginHandler).toHaveBeenCalledWith(mockConfigManagerInstance);
      expect(mockLoginHandlerInstance.login).toHaveBeenCalledWith(provider);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`🔐 Logging in to ${provider}...`)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`✅ Successfully logged in to ${provider}!`)
      );
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle login failure', async () => {
      const provider = 'openai';
      mockLoginHandlerInstance.login.mockResolvedValue(false);

      await authCommand.login(provider);

      expect(mockLoginHandlerInstance.login).toHaveBeenCalledWith(provider);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`❌ Failed to login to ${provider}`)
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should reject unknown provider', async () => {
      const provider = 'unknown';

      // Mock process.exit to prevent test from actually exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit called');
      });

      try {
        await authCommand.login(provider);
        fail('Expected login to throw due to process.exit');
      } catch (error) {
        expect(error.message).toBe('Process exit called');
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider: unknown')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Available providers: openai, grok, lmstudio, openrouter, sonicfree'
        )
      );
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockLoginHandler).not.toHaveBeenCalled();

      mockExit.mockRestore();
    });

    it('should handle login error', async () => {
      const provider = 'openai';
      const errorMessage = 'Network error';
      mockLoginHandlerInstance.login.mockRejectedValue(new Error(errorMessage));

      await authCommand.login(provider);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Login error:'),
        errorMessage
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error login error', async () => {
      const provider = 'openai';
      mockLoginHandlerInstance.login.mockRejectedValue('String error');

      await authCommand.login(provider);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Login error:'),
        'Unknown error'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it.each(['openai', 'grok', 'lmstudio', 'openrouter', 'sonicfree'])(
      'should accept valid provider: %s',
      async provider => {
        mockLoginHandlerInstance.login.mockResolvedValue(true);

        await authCommand.login(provider);

        expect(mockLoginHandlerInstance.login).toHaveBeenCalledWith(provider);
      }
    );
  });
});
