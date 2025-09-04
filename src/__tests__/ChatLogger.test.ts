import { ChatLogger } from '../config/ChatLogger.js';
import * as fs from 'fs/promises';

describe('ChatLogger', () => {
  let chatLogger: ChatLogger;
  let testLogPath: string | null;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    chatLogger = new ChatLogger();
    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
  });

  afterEach(async () => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clean up test log file if it exists
    if (testLogPath) {
      try {
        await fs.unlink(testLogPath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  });

  describe('Console Interception', () => {
    it('should intercept console.log and write to log file', async () => {
      // Start a session
      await chatLogger.initialize();
      await chatLogger.startSession('openai', 'gpt-4');

      // Get the current log path
      testLogPath = chatLogger.getCurrentLogPath();
      expect(testLogPath).toBeTruthy();

      // Test console.log interception
      const testMessage = 'Test message with emoji 🚀';
      console.log(testMessage);

      // Wait a bit for async file write
      await new Promise(resolve => setTimeout(resolve, 100));

      // Read the log file
      if (testLogPath) {
        const logContent = await fs.readFile(testLogPath, 'utf8');

        // Verify the message was logged
        expect(logContent).toContain('STDOUT: Test message with emoji 🚀');
        expect(logContent).toContain('[openai/gpt-4]');
      }

      // End session to restore console
      await chatLogger.endSession('test ended');
    });

    it('should intercept console.error and write to log file', async () => {
      // Start a session
      await chatLogger.initialize();
      await chatLogger.startSession('anthropic', 'claude-3');

      // Get the current log path
      testLogPath = chatLogger.getCurrentLogPath();

      // Test console.error interception
      const testError = 'Test error message ⚠️';
      console.error(testError);

      // Wait a bit for async file write
      await new Promise(resolve => setTimeout(resolve, 100));

      // Read the log file
      if (testLogPath) {
        const logContent = await fs.readFile(testLogPath, 'utf8');

        // Verify the error was logged
        expect(logContent).toContain('STDERR: Test error message ⚠️');
        expect(logContent).toContain('[anthropic/claude-3]');
      }

      // End session to restore console
      await chatLogger.endSession('test ended');
    });

    it('should restore original console methods after session ends', async () => {
      // Start a session
      await chatLogger.initialize();
      await chatLogger.startSession('openai', 'gpt-4');

      // Verify console methods are intercepted
      expect(console.log).not.toBe(originalConsoleLog);

      // End session
      await chatLogger.endSession('test ended');

      // Verify console methods are restored
      expect(console.log).toBe(originalConsoleLog);
      expect(console.error).toBe(originalConsoleError);
    });
  });
});
