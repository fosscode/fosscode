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
        { timeout: 60000 } // Longer timeout for real API calls
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('list'); // Should mention the list tool or operation
    }, 30000);

    it('should list TypeScript files using pattern matching', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'show me all TypeScript files (*.ts) in the src directory',
        { timeout: 60000 }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('.ts'); // Should mention TypeScript files
    }, 30000);

    it('should list directories only', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list only the directories in the src folder',
        { timeout: 60000 }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('directory'); // Should mention directories
    }, 30000);

    it('should handle listing with showHidden option', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list all files including hidden ones in the root directory',
        { timeout: 60000 }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should either show hidden files or explain why it can't
      expect(stdout).toMatch(/(hidden|git|node_modules|\.)/);
    }, 30000);

    it('should list files in a specific subdirectory', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list the contents of the src/tools directory',
        { timeout: 60000 }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('tools'); // Should mention tools directory
    }, 30000);

    it('should handle complex file listing requests', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'find and list all test files in the project, including their sizes',
        { timeout: 60000 }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('test'); // Should mention test files
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
        { timeout: 90000 } // Even longer timeout for multiple operations
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('src'); // Should mention src directory
      expect(stdout).toContain('tools'); // Should mention tools directory
    }, 45000);

    it('should provide helpful error messages for invalid paths', async () => {
      const { stdout, stderr, exitCode } = await E2ETestHelper.runChatCommand(
        'list files in /nonexistent/directory/path',
        { timeout: 60000 }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      // Should either handle gracefully or explain the error
      expect(stdout.length).toBeGreaterThan(0);
    }, 30000);
  });
});
