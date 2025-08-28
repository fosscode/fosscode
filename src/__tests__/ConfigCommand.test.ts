// Mock dependencies before importing
jest.mock('../config/ConfigManager');

import { ConfigCommand } from '../commands/ConfigCommand';
import { ConfigManager } from '../config/ConfigManager';

const mockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;

describe('ConfigCommand', () => {
  let consoleSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks
    mockConfigManager.mockClear();

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('set', () => {
    it('should set config value successfully', async () => {
      const key = 'defaultProvider';
      const value = 'openai';

      const mockConfigManagerInstance = {
        setConfig: jest.fn().mockResolvedValue(undefined),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      // Create a new instance after mocking
      const configCommand = new ConfigCommand();

      await configCommand.set(key, value);

      expect(mockConfigManagerInstance.setConfig).toHaveBeenCalledWith(key, value);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`✓ Set ${key} = ${value}`));
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should handle config set error', async () => {
      const key = 'invalidKey';
      const value = 'invalidValue';
      const errorMessage = 'Invalid configuration key';

      const mockConfigManagerInstance = {
        setConfig: jest.fn().mockRejectedValue(new Error(errorMessage)),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      // Create a new instance after mocking
      const configCommand = new ConfigCommand();

      await configCommand.set(key, value);

      expect(mockConfigManagerInstance.setConfig).toHaveBeenCalledWith(key, value);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'), errorMessage);
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error config set error', async () => {
      const key = 'invalidKey';
      const value = 'invalidValue';

      const mockConfigManagerInstance = {
        setConfig: jest.fn().mockRejectedValue('String error'),
      };
      mockConfigManager.mockImplementation(() => mockConfigManagerInstance as any);

      // Create a new instance after mocking
      const configCommand = new ConfigCommand();

      await configCommand.set(key, value);

      expect(mockConfigManagerInstance.setConfig).toHaveBeenCalledWith(key, value);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'Unknown error'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
