import { render } from 'cli-testing-library';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Interactive CLI Testing with CLI Testing Library', () => {
  let testConfigPath: string;

  beforeAll(() => {
    // Create test config
    testConfigPath = path.join(__dirname, 'test-interactive-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'sk-test-key-123456789012345678901234567890',
          baseURL: 'http://localhost:8080/v1',
        },
      },
      defaultProvider: 'openai',
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  afterAll(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test.skip('should handle interactive chat session (requires mock server)', async () => {
    const { findByText, userEvent, cleanup } = await render('bun', ['run', 'src/index.ts', 'chat']);

    // Wait for initial prompt
    const prompt = await findByText('🚀 fosscode');
    expect(prompt).toBeInTheConsole();

    // Simulate user typing a message
    userEvent.keyboard('hello world');
    userEvent.keyboard('[Enter]');

    // Wait for response (this would need a mock server running)
    // const response = await findByText('Hello! I can help you with coding tasks');
    // expect(response).toBeInTheConsole();

    // Test /help command
    userEvent.keyboard('/help');
    userEvent.keyboard('[Enter]');

    // Should show help information
    const helpText = await findByText('Available commands');
    expect(helpText).toBeInTheConsole();

    // Exit the session
    userEvent.keyboard('[Ctrl+C]');

    cleanup();
  });

  test('should handle CLI argument validation', async () => {
    const { findByText, cleanup } = await render('bun', [
      'run',
      'src/index.ts',
      'chat',
      '--invalid-option',
    ]);

    // Should show error for invalid option
    const errorText = await findByText(/error|Error|unknown option/i);
    expect(errorText).toBeInTheConsole();

    cleanup();
  });

  test('should handle missing message in non-interactive mode', async () => {
    const { findByText, cleanup } = await render('bun', [
      'run',
      'src/index.ts',
      'chat',
      '--non-interactive',
    ]);

    // Should show error about missing message
    const errorText = await findByText(/message is required|Message is required/i);
    expect(errorText).toBeInTheConsole();

    cleanup();
  });

  test('should show proper exit codes', async () => {
    const { waitForExit, cleanup } = await render('bun', ['run', 'src/index.ts', '--version']);

    const exitResult = await waitForExit();
    expect(exitResult.code).toBe(0); // Version command should succeed

    cleanup();
  });

  test('should handle invalid commands gracefully', async () => {
    const { findByText, cleanup } = await render('bun', ['run', 'src/index.ts', 'invalid-command']);

    // Should show error for unknown command
    const errorText = await findByText(/error|Error|unknown command/i);
    expect(errorText).toBeInTheConsole();

    cleanup();
  });
});
