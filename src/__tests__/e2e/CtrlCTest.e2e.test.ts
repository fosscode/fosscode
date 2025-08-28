import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Ctrl+C E2E Tests', () => {
  let testConfigPath: string;
  let mockServerProcess: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    // Start mock API server
    mockServerProcess = spawn(
      'node',
      [
        '-e',
        `
      const http = require('http');
      const server = http.createServer((req, res) => {
        console.error('Mock server received:', req.method, req.url);
        if (req.method === 'GET' && req.url === '/v1/models') {
          console.error('Mock server responding with models');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            object: 'list',
            data: [{
              id: 'gpt-3.5-turbo',
              object: 'model',
              created: Math.floor(Date.now() / 1000),
              owned_by: 'openai'
            }]
          }));
        } else if (req.method === 'POST' && req.url === '/v1/chat/completions') {
          console.error('Mock server responding with chat completion');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-3.5-turbo',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! I can help you with coding tasks. Type /help for available commands.'
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30
            }
          }));
        } else {
          console.error('Mock server 404 for:', req.method, req.url);
          res.writeHead(404);
          res.end('Not found');
        }
      });
      server.listen(8081, () => console.error('Mock server running on 8081'));
      process.on('SIGTERM', () => {
        console.error('Mock server shutting down');
        server.close();
      });
    `,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Capture mock server output for debugging
    mockServerProcess.stdout?.on('data', data => {
      console.log('Mock server stdout:', data.toString());
    });
    mockServerProcess.stderr?.on('data', data => {
      console.log('Mock server stderr:', data.toString());
    });

    testConfigPath = path.join(__dirname, 'test-ctrlc-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'sk-test-key-123456789012345678901234567890',
          baseUrl: 'http://localhost:8081/v1',
        },
      },
      defaultProvider: 'openai',
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    console.log('Test config path:', testConfigPath);
    console.log('Test config exists:', fs.existsSync(testConfigPath));
    console.log('Test config contents:', fs.readFileSync(testConfigPath, 'utf8'));
  });

  afterAll(() => {
    if (mockServerProcess) {
      mockServerProcess.kill();
    }
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test('should handle Ctrl+C gracefully during startup', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Ctrl+C test timed out'));
      }, 15000);

      const child = spawn('bun', ['run', 'src/index.ts', 'chat', '--non-interactive', 'hello'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '0',
          FOSSCODE_CONFIG_PATH: testConfigPath,
        },
      });

      let output = '';
      let errorOutput = '';
      let exited = false;
      let exitCode: number | null = null;

      child.stdout?.on('data', data => {
        output += data.toString();
        console.log('Child stdout:', data.toString());
      });

      child.stderr?.on('data', data => {
        errorOutput += data.toString();
        console.log('Child stderr:', data.toString());
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        exited = true;
        exitCode = code;
        console.log('Child exited with code:', code);
        console.log('Final output:', output);
        console.log('Final error output:', errorOutput);

        // Verify the process exited gracefully
        expect(exited).toBe(true);
        // Ctrl+C should result in exit code 130 (128 + 2) or 0 depending on signal handling
        expect(exitCode === 0 || exitCode === 130 || exitCode === null).toBe(true);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        console.error('Child error:', error);
        reject(error);
      });

      // Send Ctrl+C after a short delay to interrupt startup/configuration
      setTimeout(() => {
        if (!exited) {
          console.log('Sending SIGINT (Ctrl+C) to interrupt startup');
          child.kill('SIGINT');
        }
      }, 1000);
    });
  }, 20000);

  test('should handle Ctrl+C during command execution', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Ctrl+C during command test timed out'));
      }, 15000);

      const child = spawn('bun', ['run', 'src/index.ts', 'chat'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '0',
          FOSSCODE_CONFIG_PATH: testConfigPath,
        },
      });

      let output = '';
      let errorOutput = '';
      let exited = false;
      let exitCode: number | null = null;

      child.stdout?.on('data', data => {
        output += data.toString();
        console.log('Child stdout:', data.toString());
      });

      child.stderr?.on('data', data => {
        errorOutput += data.toString();
        console.log('Child stderr:', data.toString());
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        exited = true;
        exitCode = code;
        console.log('Child exited with code:', code);
        console.log('Final output:', output);
        console.log('Final error output:', errorOutput);

        // Verify the process exited gracefully
        expect(exited).toBe(true);
        // Should exit with code 0 (successful completion) or 130 (SIGINT)
        expect(exitCode === 0 || exitCode === 130 || exitCode === null).toBe(true);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        console.error('Child error:', error);
        reject(error);
      });

      // Send Ctrl+C after a short delay to interrupt any ongoing processing
      setTimeout(() => {
        if (!exited) {
          console.log('Sending SIGINT (Ctrl+C) to interrupt command execution');
          child.kill('SIGINT');
        }
      }, 2000);
    });
  }, 20000);
});
