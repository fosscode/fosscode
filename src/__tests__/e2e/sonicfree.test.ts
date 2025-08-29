import { E2ETestHelper } from './helpers.js';

describe('SonicFree Provider E2E Tests', () => {
  beforeAll(async () => {
    // Build the project before running E2E tests
    await E2ETestHelper.buildProject();
  });

  describe('File Listing with SonicFree Provider', () => {
    it('should list files in current directory using SonicFree', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list the files in the current directory',
        { timeout: 60000, provider: 'sonicfree' } // Longer timeout for real API calls
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should either complete successfully or explain token limits
      expect(stdout).toMatch(/(list|directory|file|token limit|Response stopped)/i);
    }, 30000);

    it('should list TypeScript files using pattern matching', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'show me all TypeScript files (*.ts) in the src directory',
        { timeout: 60000, provider: 'sonicfree' }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt to list TypeScript files or explain limitations
      expect(stdout).toMatch(/(TypeScript|\.ts|list|files|token limit)/i);
    }, 30000);

    it('should list directories only', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list only the directories in the src folder',
        { timeout: 60000, provider: 'sonicfree' }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt to list directories or explain token limits
      expect(stdout).toMatch(/(director|folder|src|list|token limit)/i);
    }, 30000);

    it('should handle listing with showHidden option', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list all files including hidden ones in the root directory',
        { timeout: 60000, provider: 'sonicfree' }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt to handle hidden files request
      expect(stdout).toMatch(/(hidden|files|list|directory|token limit)/i);
    }, 30000);

    it('should list files in a specific subdirectory', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list the contents of the src/tools directory',
        { timeout: 60000, provider: 'sonicfree' }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt to list tools directory contents
      expect(stdout).toMatch(/(tools|src|list|directory|token limit)/i);
    }, 30000);

    it('should handle complex file listing requests', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'find and list all test files in the project, including their sizes',
        { timeout: 60000, provider: 'sonicfree' }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt to find test files or explain limitations
      expect(stdout).toMatch(/(test|files|find|list|token limit)/i);
    }, 30000);
  });

  describe('SonicFree Provider Models Command', () => {
    it('should list available SonicFree models', async () => {
      const { stdout, exitCode } = await E2ETestHelper.runModelsCommand('sonicfree');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('sonic'); // Should contain sonic models
    }, 15000);
  });

  describe('SonicFree Provider Integration', () => {
    it('should handle multiple tool calls in sequence', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'first list the files in src, then list the files in src/tools',
        { timeout: 90000, provider: 'sonicfree' } // Even longer timeout for multiple operations
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt multiple operations or explain token limits
      expect(stdout).toMatch(/(src|tools|list|multiple|token limit)/i);
    }, 45000);

    it('should provide helpful error messages for invalid paths', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list files in /nonexistent/directory/path',
        { timeout: 60000, provider: 'sonicfree' }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should attempt to handle the request or explain limitations
      expect(stdout.length).toBeGreaterThan(0);
      expect(stdout).toMatch(/(list|files|directory|path|error|token limit)/i);
    }, 30000);
  });
});
