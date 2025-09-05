import { handleCommand } from '../ui/utils/commandHandler.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { AppConfig } from '../types/index.js';

// Mock the ConfigManager
jest.mock('../config/ConfigManager.js');
const MockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;

describe('Command Approval Mode', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let config: AppConfig;
  let currentState: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    config = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      maxConversations: 100,
      theme: 'dark',
      providers: {} as any,
      cachedModels: {} as any,
      approvalMode: {
        enabled: false,
        godMode: false,
        allowlist: ['rm', 'sudo', 'chmod'],
      },
    };

    // Setup current state
    currentState = {
      isVerbose: false,
      theme: 'dark',
      currentMode: 'code',
      messages: [],
      provider: 'openai',
      model: 'gpt-4',
      providerManager: {} as any,
    };

    // Setup mock ConfigManager
    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue(config),
      setConfig: jest.fn(),
    } as any;

    MockConfigManager.mockImplementation(() => mockConfigManager);
  });

  describe('/approval command', () => {
    it('should enable approval mode when currently disabled', async () => {
      config.approvalMode!.enabled = false;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/approval', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.enabled', true);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('Approval mode enabled');
    });

    it('should disable approval mode when currently enabled', async () => {
      config.approvalMode!.enabled = true;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/approval', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.enabled', false);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('Approval mode disabled');
    });

    it('should handle undefined approvalMode config', async () => {
      delete config.approvalMode;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/approval', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.enabled', true);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('Approval mode enabled');
    });
  });

  describe('/god command', () => {
    it('should enable GOD mode when currently disabled', async () => {
      config.approvalMode!.godMode = false;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/god', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', true);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('GOD mode enabled');
      expect(result.message!.content).toContain(
        'All commands and edits will be allowed without approval'
      );
    });

    it('should disable GOD mode when currently enabled', async () => {
      config.approvalMode!.godMode = true;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/god', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', false);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('GOD mode disabled');
      expect(result.message!.content).toContain('Approval mode is now active');
    });

    it('should handle undefined approvalMode config for GOD mode', async () => {
      delete config.approvalMode;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/god', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', true);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('GOD mode enabled');
    });

    it('should handle /approval with different cases', async () => {
      config.approvalMode!.enabled = false;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/APPROVAL', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.enabled', true);
      expect(result.type).toBe('message');
    });

    it('should handle /god with different cases', async () => {
      config.approvalMode!.godMode = false;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/GOD', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', true);
      expect(result.type).toBe('message');
    });

    it('should return none for unknown commands', async () => {
      const result = await handleCommand('/unknown', currentState);

      expect(result.type).toBe('none');
    });

    it('should show help with approval commands', async () => {
      const result = await handleCommand('/help', currentState);

      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('/god');
      expect(result.message!.content).toContain('/approval');
    });

    it('should show help with different cases', async () => {
      const result = await handleCommand('/HELP', currentState);

      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('/god');
      expect(result.message!.content).toContain('/approval');
    });

    it('should disable GOD mode when currently enabled', async () => {
      config.approvalMode!.godMode = true;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/god', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', false);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('GOD mode disabled');
      expect(result.message!.content).toContain('Approval mode is now active');
    });

    it('should handle undefined approvalMode config for GOD mode', async () => {
      delete config.approvalMode;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/god', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', true);
      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('GOD mode enabled');
    });
  });

  describe('Command variations', () => {
    it('should handle /approval with different cases', async () => {
      config.approvalMode!.enabled = false;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/APPROVAL', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.enabled', true);
      expect(result.type).toBe('message');
    });

    it('should handle /god with different cases', async () => {
      config.approvalMode!.godMode = false;
      mockConfigManager.getConfig.mockReturnValue(config);

      const result = await handleCommand('/GOD', currentState);

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith('approvalMode.godMode', true);
      expect(result.type).toBe('message');
    });
  });

  describe('Unknown commands', () => {
    it('should return none for unknown commands', async () => {
      const result = await handleCommand('/unknown', currentState);

      expect(result.type).toBe('none');
    });
  });

  describe('Help command', () => {
    it('should show help with approval commands', async () => {
      const result = await handleCommand('/help', currentState);

      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('/god');
      expect(result.message!.content).toContain('/approval');
    });

    it('should show help with different cases', async () => {
      const result = await handleCommand('/HELP', currentState);

      expect(result.type).toBe('message');
      expect(result.message!.content).toContain('/god');
      expect(result.message!.content).toContain('/approval');
    });
  });
});
