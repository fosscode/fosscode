import { E2ETestHelper } from './helpers.js';

describe('CLI Tools E2E Tests', () => {
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

  describe('Chat with Tool Usage', () => {
    it('should handle tool-using responses', async () => {
      // Mock a response that includes tool usage instructions
      const toolResponse = `I'll list the files in the current directory using the list tool.

<function_calls>
<invoke name="list">
<parameter name="path">.</parameter>
</invoke>
</function_calls>`;

      E2ETestHelper.setupMockResponse(/list.*files/i, toolResponse);

      const { stdout, exitCode } = await E2ETestHelper.runChatCommand(
        'list files in current directory'
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list tool');
    });

    it('should handle simple questions', async () => {
      E2ETestHelper.setupMockResponse(
        /what.*time/i,
        'I cannot access the current time, but you can check it on your system clock.'
      );

      const { stdout, exitCode } = await E2ETestHelper.runChatCommand('what time is it?');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('system clock');
    });
  });
});
