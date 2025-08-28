// Mock dependencies before importing
// @ts-nocheck - Jest mock typing issues in test file
jest.mock('../config/ConfigManager');
jest.mock('../auth/LoginHandler');

import { AuthCommand } from '../commands/AuthCommand';
import { ConfigManager } from '../config/ConfigManager';
import { LoginHandler } from '../auth/LoginHandler';

const mockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;
const mockLoginHandler = LoginHandler as jest.MockedClass<typeof LoginHandler>;

describe('AuthCommand', () => {
  let authCommand: AuthCommand;
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks
    mockConfigManager.mockClear();
    mockLoginHandler.mockClear();

    authCommand = new AuthCommand();
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
      const mockLoginHandlerInstance = {
        login: jest.fn().mockResolvedValue(true),
      };
      mockLoginHandler.mockImplementation(() => mockLoginHandlerInstance as any);

      // Mock ConfigManager instance
      const mockConfigManagerInstance = {};
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

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
      const mockLoginHandlerInstance = {
        login: jest.fn().mockResolvedValue(false),
      };
      mockLoginHandler.mockImplementation(() => mockLoginHandlerInstance as any);

      await authCommand.login(provider);

      expect(mockLoginHandlerInstance.login).toHaveBeenCalledWith(provider);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`❌ Failed to login to ${provider}`)
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should reject unknown provider', async () => {
      const provider = 'unknown';

      await authCommand.login(provider);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider: unknown')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Available providers: openai, grok, lmstudio, openrouter, sonicfree'
        )
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockLoginHandler).not.toHaveBeenCalled();
    });

    it('should handle login error', async () => {
      const provider = 'openai';
      const errorMessage = 'Network error';
      const mockLoginHandlerInstance = {
        login: jest.fn().mockRejectedValue(new Error(errorMessage)),
      };
      mockLoginHandler.mockImplementation(() => mockLoginHandlerInstance as any);

      await authCommand.login(provider);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Login error:'),
        errorMessage
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error login error', async () => {
      const provider = 'openai';
      const mockLoginHandlerInstance = {
        login: jest.fn().mockRejectedValue('String error'),
      };
      mockLoginHandler.mockImplementation(() => mockLoginHandlerInstance as any);

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
        const mockLoginHandlerInstance = {
          login: jest.fn().mockResolvedValue(true),
        };
        mockLoginHandler.mockImplementation(() => mockLoginHandlerInstance as any);

        await authCommand.login(provider);

        expect(mockLoginHandlerInstance.login).toHaveBeenCalledWith(provider);
      }
    );
  });
});
