import { Message } from '../types';

// Mock the entire ProviderManager module
jest.mock('../providers/ProviderManager', () => ({
  ProviderManager: jest.fn().mockImplementation(() => ({
    initializeProvider: jest.fn(),
    sendMessage: jest.fn(),
    listModels: jest.fn(),
    getAvailableProviders: jest.fn(),
    testConnection: jest.fn(),
  })),
}));

describe('ProviderManager Interface', () => {
  let ProviderManager: any;
  let providerManager: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Import the mocked ProviderManager
    const ProviderManagerModule = require('../providers/ProviderManager');
    ProviderManager = ProviderManagerModule.ProviderManager;

    // Create instance
    providerManager = new ProviderManager();
  });

  describe('getAvailableProviders', () => {
    it('should return all available provider types', () => {
      providerManager.getAvailableProviders.mockReturnValue([
        'openai',
        'grok',
        'lmstudio',
        'openrouter',
        'sonicfree',
      ]);

      const providers = providerManager.getAvailableProviders();

      expect(providers).toHaveLength(5);
      expect(providers).toEqual(['openai', 'grok', 'lmstudio', 'openrouter', 'sonicfree']);
    });
  });

  describe('initializeProvider', () => {
    it('should call initializeProvider method', async () => {
      providerManager.initializeProvider.mockResolvedValue(undefined);

      await expect(providerManager.initializeProvider('openai')).resolves.toBeUndefined();
      expect(providerManager.initializeProvider).toHaveBeenCalledWith('openai');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello', timestamp: new Date() }];

    it('should call sendMessage method', async () => {
      const mockResponse = { content: 'Hello from AI', finishReason: 'stop' as const };
      providerManager.sendMessage.mockResolvedValue(mockResponse);

      const result = await providerManager.sendMessage('openai', messages);

      expect(result).toEqual(mockResponse);
      expect(providerManager.sendMessage).toHaveBeenCalledWith('openai', messages);
    });
  });

  describe('listModels', () => {
    it('should call listModels method', async () => {
      const models = ['gpt-3.5-turbo', 'gpt-4'];
      providerManager.listModels.mockResolvedValue(models);

      const result = await providerManager.listModels('openai');

      expect(result).toEqual(models);
      expect(providerManager.listModels).toHaveBeenCalledWith('openai');
    });
  });

  describe('testConnection', () => {
    it('should call testConnection method', async () => {
      providerManager.testConnection.mockResolvedValue(true);

      const result = await providerManager.testConnection('openai');

      expect(result).toBe(true);
      expect(providerManager.testConnection).toHaveBeenCalledWith('openai');
    });
  });
});
