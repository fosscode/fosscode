import 'cli-testing-library/jest';
import { render, cleanup } from 'cli-testing-library';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('CLI Testing Library Example', () => {
  let testConfigPath: string;

  beforeAll(() => {
    // Create test config
    testConfigPath = path.join(__dirname, 'test-cli-lib-config.json');
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

  test('should handle basic CLI commands with CLI Testing Library', async () => {
    const { findByText } = await render('./dist/fosscode', ['--help'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NODE_ENV: 'test',
      },
    });

    // Wait for help output - be more flexible with text matching
    const helpText = await findByText(text => text.includes('fosscode'));
    expect(helpText).toBeTruthy();

    // Check for specific commands
    expect(await findByText(text => text.includes('chat'))).toBeTruthy();
    expect(await findByText(text => text.includes('providers'))).toBeTruthy();

    cleanup();
  });
});
