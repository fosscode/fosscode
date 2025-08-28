import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('Multi-Turn Conversation E2E Tests', () => {
  let testConfigPath: string;
  let mockServerProcess: ChildProcessWithoutNullStreams;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'fosscode-conversation-'));

    // Start mock API server that simulates conversation memory
    mockServerProcess = spawn('node', [
      '-e',
      `
      const http = require('http');
      let conversationHistory = [];
      
      const server = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            const data = JSON.parse(body);
            const messages = data.messages || [];
            const lastMessage = messages[messages.length - 1];
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            
            if (lastMessage && lastMessage.content.includes('create function')) {
              res.end(JSON.stringify({
                choices: [{
                  message: {
                    content: 'I will create a JavaScript function for you.',
                    tool_calls: [{
                      id: 'write-call-1',
                      type: 'function',
                      function: {
                        name: 'write',
                        arguments: JSON.stringify({
                          filePath: '${tempDir}/greet.js',
                          content: 'function greet(name) {\\n  return "Hello, " + name + "!";\\n}\\n\\nmodule.exports = greet;'
                        })
                      }
                    }]
                  }
                }]
              }));
            } else if (lastMessage && lastMessage.content.includes('test')) {
              res.end(JSON.stringify({
                choices: [{
                  message: {
                    content: 'I will create a test for the function.',
                    tool_calls: [{
                      id: 'write-call-2',
                      type: 'function',
                      function: {
                        name: 'write',
                        arguments: JSON.stringify({
                          filePath: '${tempDir}/test.js',
                          content: 'const greet = require("./greet");\\nconsole.log(greet("World")); // Should output: Hello, World!'
                        })
                      }
                    }]
                  }
                }]
              }));
            } else {
              res.end(JSON.stringify({
                choices: [{
                  message: {
                    content: 'I understand. How can I help you with your code today?'
                  }
                }]
              }));
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3002, () => console.log('Mock conversation server running on 3002'));
    `.replace(/\${tempDir}/g, tempDir),
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    testConfigPath = path.join(__dirname, 'test-conversation-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'sk-test-key-123456789012345678901234567890',
          baseURL: 'http://localhost:3002/v1',
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

  test.skip('should handle sequential non-interactive messages', async () => {
    // First message - create function
    const result1 = await new Promise<{ code: number; output: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('First message timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'create function to greet users',
          '--non-interactive',
          '--config',
          testConfigPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
        }
      );

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        resolve({ code: code || 0, output });
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(result1.code).toBe(0);
    expect(result1.output.length).toBeGreaterThan(0);

    // Check if the function file was created
    const functionFile = path.join(tempDir, 'greet.js');
    if (fs.existsSync(functionFile)) {
      const content = fs.readFileSync(functionFile, 'utf8');
      expect(content).toContain('greet');
    }

    // Second message - create test
    const result2 = await new Promise<{ code: number; output: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Second message timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'create a test for the greet function',
          '--non-interactive',
          '--config',
          testConfigPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
        }
      );

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        resolve({ code: code || 0, output });
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(result2.code).toBe(0);
    expect(result2.output.length).toBeGreaterThan(0);
  }, 35000);

  test('should handle basic CLI commands', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Basic CLI test timed out'));
      }, 5000);

      const child = spawn('bun', ['run', 'src/index.ts', 'providers'], {
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
        expect(output).toContain('providers');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 10000);

  test.skip('should handle simple conversation', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Simple conversation test timed out'));
      }, 10000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'hello there',
          '--non-interactive',
          '--config',
          testConfigPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
        }
      );

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output).toContain('help');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);

  test('should handle error conditions gracefully', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Error handling test timed out'));
      }, 10000);

      // Test with invalid provider config
      const invalidConfigPath = path.join(__dirname, 'invalid-config.json');
      const invalidConfig = {
        providers: {
          openai: {
            apiKey: 'invalid-key',
            baseUrl: 'http://localhost:9999/v1',
          },
        },
        defaultProvider: 'openai',
      };
      fs.writeFileSync(invalidConfigPath, JSON.stringify(invalidConfig, null, 2));

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'hello',
          '--non-interactive',
          '--config',
          invalidConfigPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
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
        fs.unlinkSync(invalidConfigPath);
        // Should fail gracefully with non-zero exit code
        expect(code).not.toBe(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        fs.unlinkSync(invalidConfigPath);
        reject(error);
      });
    });
  }, 15000);
});
