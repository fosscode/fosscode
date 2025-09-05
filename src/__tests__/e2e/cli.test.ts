import { E2ETestHelper } from './helpers.js';

describe('CLI E2E Tests', () => {
  beforeAll(async () => {
    // Build the project before running E2E tests
    await E2ETestHelper.buildProject();
  });

  beforeEach(() => {
    // Clear any previous mock responses
    E2ETestHelper.clearMockResponses();
  });

  afterEach(() => {
    // Clean up after each test
    E2ETestHelper.clearMockResponses();
  });

  describe('Chat Command', () => {
    it('should respond with mocked LLM response', async () => {
      // Set up mock response - use exact match to be sure
      E2ETestHelper.setupMockResponse(/^hello$/, 'Hello! This is a mock response from the LLM.');

      // Execute the CLI chat command with mock provider
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand('hello');

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Hello! This is a mock response from the LLM.');
    });

    it('should handle prompts without matching mock responses', async () => {
      // No mock responses configured, should get default unmocked response
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand('unmocked prompt');

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('MockProvider: No canned response for prompt');
    });

    it('should work with complex prompts', async () => {
      E2ETestHelper.setupMockResponse(
        /write.*function.*calculate/i,
        'Here is a function to calculate:\n\n```javascript\nfunction calculate(a, b) {\n  return a + b;\n}\n```'
      );

      const { stdout, exitCode } = await E2ETestHelper.runChatCommand(
        'Write a function to calculate two numbers'
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('function calculate');
      expect(stdout).toContain('return a + b');
    });
  });

  describe('Models Command', () => {
    it('should list mock models', async () => {
      const { stdout, exitCode } = await E2ETestHelper.runModelsCommand('mock');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('mock-model-1');
      expect(stdout).toContain('mock-model-2');
    });
  });

  describe('Providers Command', () => {
    it('should list available providers including mock', async () => {
      const { stdout, exitCode } = await E2ETestHelper.runProvidersCommand();

      expect(exitCode).toBe(0);
      expect(stdout).toContain('mock');
    });
  });

  describe('VSCode Command', () => {
    it('should show help when no action specified', async () => {
      const { stdout, exitCode } = await E2ETestHelper.runCliCommand(['code']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('VSCode fosscode Diff Extension');
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('fosscode code install');
    });

    it('should show status information', async () => {
      const { stdout, exitCode } = await E2ETestHelper.runCliCommand(['code', 'status']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('VSCode Extension Status');
      expect(stdout).toContain('Extension file:');
      expect(stdout).toContain('Extension path:');
    });

    it('should show setup instructions', async () => {
      const { stdout, exitCode } = await E2ETestHelper.runCliCommand(['code', 'setup']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Manual Installation Instructions');
      expect(stdout).toContain('Install VSCode from:');
      expect(stdout).toContain('code --install-extension');
    });
  });
});
