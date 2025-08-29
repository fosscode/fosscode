import { LoginHandler } from '../auth/LoginHandler';
import { ConfigManager } from '../config/ConfigManager';

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn(),
    close: jest.fn(),
  }),
}));

// Mock chalk
jest.mock('chalk', () => ({
  cyan: jest.fn((text: string) => text),
  red: jest.fn((text: string) => text),
}));

// Mock ConfigManager
jest.mock('../config/ConfigManager');

describe('LoginHandler', () => {
  let loginHandler: LoginHandler;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    const MockConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;
    mockConfigManager = new MockConfigManager() as jest.Mocked<ConfigManager>;
    mockConfigManager.setProviderConfig.mockResolvedValue();

    loginHandler = new LoginHandler(mockConfigManager);
  });

  describe('constructor', () => {
    it('should create a LoginHandler instance', () => {
      expect(loginHandler).toBeInstanceOf(LoginHandler);
    });
  });
});
