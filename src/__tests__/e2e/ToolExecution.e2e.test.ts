import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('Tool Execution E2E Tests', () => {
  let testConfigPath: string;
  let mockServerProcess: ChildProcessWithoutNullStreams;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'fosscode-e2e-'));

    // Create test files
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'Hello, world!\nThis is a test file.\n');
    fs.writeFileSync(path.join(tempDir, 'script.js'), 'console.log("Hello from script!");');

    // Start mock API server that returns tool calls
    mockServerProcess = spawn('node', [
      '-e',
      `
      const http = require('http');
      let requestCount = 0;
      const server = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          
          if (requestCount === 0) {
            // First request - return a bash tool call
            res.end(JSON.stringify({
              choices: [{
                message: {
                  content: 'I will list the files for you.',
                  tool_calls: [{
                    id: 'test-call-1',
                    type: 'function',
                    function: {
                      name: 'bash',
                      arguments: JSON.stringify({ 
                        command: 'ls -la "${tempDir}"', 
                        description: 'List files in test directory' 
                      })
                    }
                  }]
                }
              }]
            }));
          } else {
            // Subsequent requests - just return text response
            res.end(JSON.stringify({
              choices: [{
                message: {
                  content: 'Files have been listed successfully.'
                }
              }]
            }));
          }
          requestCount++;
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3001, () => console.log('Mock tool server running on 3001'));
    `.replace('${tempDir}', tempDir),
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    testConfigPath = path.join(__dirname, 'test-tool-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'sk-test-key-123456789012345678901234567890',
          baseURL: 'http://localhost:3001/v1',
        },
      },
      defaultProvider: 'openai',
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  afterAll(() => {
    if (mockServerProcess) {
      mockServerProcess.kill();
    }
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test.skip('should execute tool calls in non-interactive mode', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Tool execution test timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          `list files in ${tempDir}`,
          '--non-interactive',
          '--verbose',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            FORCE_COLOR: '0',
            FOSSCODE_CONFIG_PATH: testConfigPath,
          },
        }
      );

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.stderr?.on('data', data => {
        errorOutput += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        // Should succeed (code 0) and show file listing
        expect(code).toBe(0);
        // Should contain either the tool execution or the files
        expect(output.length).toBeGreaterThan(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);

  test.skip('should handle verbose mode with tool execution', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Verbose test timed out'));
      }, 10000);

      const writeTestFile = path.join(tempDir, 'verbose-test.txt');

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          `create a file at ${writeTestFile} with content "test"`,
          '--non-interactive',
          '--config',
          testConfigPath,
          '--verbose',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            FORCE_COLOR: '0',
            FOSSCODE_CONFIG_PATH: testConfigPath,
          },
        }
      );

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);

  test('should validate CLI tool availability', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('CLI validation test timed out'));
      }, 5000);

      const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output).toContain('chat');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 10000);

  test.skip('should handle file operations', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('File operation test timed out'));
      }, 10000);

      const testFile = path.join(tempDir, 'read-test.txt');
      fs.writeFileSync(testFile, 'Content to read\nLine 2\nLine 3');

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          `read the file ${testFile}`,
          '--non-interactive',
          '--config',
          testConfigPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            FORCE_COLOR: '0',
            FOSSCODE_CONFIG_PATH: testConfigPath,
          },
        }
      );

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);
});
