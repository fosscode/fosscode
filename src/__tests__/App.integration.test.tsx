/**
 * @jest-environment jsdom
 */
import { render } from 'ink-testing-library';
import { App } from '../ui/App';
import { ProviderManager } from '../providers/ProviderManager';
import { ConfigManager } from '../config/ConfigManager';

// Mock the providers and config
jest.mock('../providers/ProviderManager');
jest.mock('../config/ConfigManager');

const mockProviderManager = {
  sendMessage: jest.fn(),
  getAvailableProviders: jest.fn().mockReturnValue(['openai', 'grok']),
};

const mockConfigManager = {
  getConfig: jest.fn().mockReturnValue({
    theme: 'dark',
    providers: {},
  }),
};

(ProviderManager as jest.MockedClass<typeof ProviderManager>).mockImplementation(
  () => mockProviderManager as any
);
(ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(
  () => mockConfigManager as any
);

describe('App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    test('renders welcome message and input prompt', () => {
      const { lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      expect(lastFrame()).toContain('🚀');
      expect(lastFrame()).toContain('openai');
      expect(lastFrame()).toContain('>'); // Input prompt
    });

    test('shows provider and model information', () => {
      const { lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      expect(lastFrame()).toContain('openai');
      expect(lastFrame()).toContain('gpt-3.5-turbo');
    });
  });

  describe('Command Handling', () => {
    test('handles /clear command', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      // Simulate typing /clear and pressing enter
      stdin.write('/clear');
      stdin.write('\r');

      expect(lastFrame()).toContain('>'); // Input prompt should still be visible
    });

    test('handles /verbose command', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      stdin.write('/verbose');
      stdin.write('\r');

      expect(lastFrame()).toContain('Verbose mode enabled');
    });

    test('handles /themes command', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      stdin.write('/themes');
      stdin.write('\r');

      expect(lastFrame()).toContain('Theme switched');
    });
  });

  describe('Memory Management', () => {
    test.skip('handles /memory command - not implemented', () => {
      // TODO: Implement /memory command in App component
    });

    test.skip('handles /gc command - not implemented', () => {
      // TODO: Implement /gc command in App component
    });
  });

  describe('File Search', () => {
    test('enters file search mode with @ symbol', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      stdin.write('@');

      expect(lastFrame()).toContain('🔍 Search files');
    });

    test('exits file search mode with escape', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      // Enter file search mode
      stdin.write('@');
      // Exit with escape
      stdin.write('\u001b'); // Escape key

      expect(lastFrame()).not.toContain('🔍 Search files');
    });
  });

  describe('Mode Switching', () => {
    test('switches between code and thinking modes with tab', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      // Press tab to switch modes
      stdin.write('\t'); // Tab key

      expect(lastFrame()).toContain('Switched to thinking mode');
    });

    test('handles /mode command', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      stdin.write('/mode');
      stdin.write('\r');

      expect(lastFrame()).toContain('Switched to thinking mode');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid commands gracefully', () => {
      const { stdin, lastFrame } = render(
        <App
          provider="openai"
          model="gpt-3.5-turbo"
          providerManager={mockProviderManager as any}
          verbose={false}
        />
      );

      stdin.write('/invalidcommand');
      stdin.write('\r');

      // Should not crash and should still show prompt
      expect(lastFrame()).toContain('>');
    });
  });
});
