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
});
