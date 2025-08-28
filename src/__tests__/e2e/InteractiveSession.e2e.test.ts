import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Interactive Session E2E Tests', () => {
  let testConfigPath: string;
  let mockServerProcess: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    // Start mock API server that supports interactive scenarios
    mockServerProcess = spawn('node', [
      '-e',
      `
      const http = require('http');
      const server = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const messages = data.messages || [];
              const lastMessage = messages[messages.length - 1];
              const isInteractive = data.interactive === true;

              res.writeHead(200, { 'Content-Type': 'application/json' });

              let response = {};

              if (isInteractive) {
                // Interactive mode responses
                if (lastMessage && lastMessage.content.includes('hello')) {
                  response = {
                    choices: [{
                      message: {
                        content: 'Hello! Welcome to fosscode interactive mode. Type your request or /help for commands.'
                      }
                    }]
                  };
                } else if (lastMessage && lastMessage.content.includes('/help')) {
                  response = {
                    choices: [{
                      message: {
                        content: 'Available commands:\\n/help - Show this help\\n/models - List available models\\n/providers - List providers\\n/themes - List themes\\n/exit - Exit interactive mode\\n\\nYou can also ask me to help with coding tasks!'
                      }
                    }]
                  };
                } else if (lastMessage && lastMessage.content.includes('/models')) {
                  response = {
                    choices: [{
                      message: {
                        content: 'Available models:\\n- gpt-3.5-turbo\\n- gpt-4\\n- claude-3-sonnet\\n\\nUse /model <name> to switch models.'
                      }
                    }]
                  };
                } else if (lastMessage && lastMessage.content.includes('/exit')) {
                  response = {
                    choices: [{
                      message: {
                        content: 'Goodbye! Thanks for using fosscode.'
                      }
                    }]
                  };
                } else if (lastMessage && lastMessage.content.includes('create')) {
                  response = {
                    choices: [{
                      message: {
                        content: 'I will help you create that. What would you like me to create?',
                        tool_calls: [{
                          id: 'create-assist',
                          type: 'function',
                          function: {
                            name: 'write',
                            arguments: JSON.stringify({
                              filePath: '/tmp/interactive-test.txt',
                              content: 'Created via interactive session'
                            })
                          }
                        }]
                      }
                    }]
                  };
                } else {
                  response = {
                    choices: [{
                      message: {
                        content: 'I understand. How can I help you with your coding task?'
                      }
                    }]
                  };
                }
              } else {
                // Non-interactive fallback
                response = {
                  choices: [{
                    message: {
                      content: 'This is a fallback response for non-interactive mode.'
                    }
                  }]
                };
              }

              res.end(JSON.stringify(response));
            } catch (error) {
              console.error('Mock server error:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3004, () => console.log('Interactive mock server running on 3004'));
    `,
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    testConfigPath = path.join(__dirname, 'test-interactive-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'sk-test-key-123456789012345678901234567890',
          baseURL: 'http://localhost:3004/v1',
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
  });

  test('should handle basic interactive session startup', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Interactive session startup test timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        ['run', 'src/index.ts', 'chat', '--interactive', '--config', testConfigPath],
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
      let startupComplete = false;

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        output += chunk;

        if (!startupComplete && output.includes('Welcome to fosscode')) {
          startupComplete = true;
          // Send exit command to terminate the session
          setTimeout(() => {
            child.stdin?.write('/exit\n');
          }, 1000);
        }
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('Welcome to fosscode');
        expect(output).toContain('Thanks for using fosscode');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);

  test('should handle command execution in interactive mode', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Interactive command test timed out'));
      }, 20000);

      const child = spawn(
        'bun',
        ['run', 'src/index.ts', 'chat', '--interactive', '--config', testConfigPath],
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
      let commandSent = false;
      let helpReceived = false;

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        output += chunk;

        if (!commandSent && output.includes('Welcome to fosscode')) {
          commandSent = true;
          // Send help command
          setTimeout(() => {
            child.stdin?.write('/help\n');
          }, 500);
        }

        if (!helpReceived && output.includes('Available commands:')) {
          helpReceived = true;
          // Send exit command
          setTimeout(() => {
            child.stdin?.write('/exit\n');
          }, 500);
        }
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('Available commands:');
        expect(output).toContain('/help');
        expect(output).toContain('/models');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 25000);

  test('should handle multi-turn conversation in interactive mode', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Multi-turn interactive test timed out'));
      }, 30000);

      const child = spawn(
        'bun',
        ['run', 'src/index.ts', 'chat', '--interactive', '--config', testConfigPath],
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
      let step = 0;

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        output += chunk;

        if (step === 0 && output.includes('Welcome to fosscode')) {
          step = 1;
          // Send first message
          setTimeout(() => {
            child.stdin?.write('hello\n');
          }, 500);
        } else if (step === 1 && output.includes('Hello! Welcome to fosscode')) {
          step = 2;
          // Send second message
          setTimeout(() => {
            child.stdin?.write('create a test file\n');
          }, 500);
        } else if (step === 2 && output.includes('I will help you create that')) {
          step = 3;
          // Send exit command
          setTimeout(() => {
            child.stdin?.write('/exit\n');
          }, 500);
        }
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('Hello! Welcome to fosscode');
        expect(output).toContain('I will help you create that');
        expect(output).toContain('Thanks for using fosscode');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 35000);

  test('should handle tool execution in interactive mode', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Interactive tool execution test timed out'));
      }, 25000);

      const child = spawn(
        'bun',
        ['run', 'src/index.ts', 'chat', '--interactive', '--config', testConfigPath],
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
      let toolExecuted = false;

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        output += chunk;

        if (!toolExecuted && output.includes('Welcome to fosscode')) {
          toolExecuted = true;
          // Send a request that triggers tool execution
          setTimeout(() => {
            child.stdin?.write('create a file for me\n');
          }, 500);
        }

        if (output.includes('Created via interactive session')) {
          // Tool execution completed, exit
          setTimeout(() => {
            child.stdin?.write('/exit\n');
          }, 500);
        }
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('I will help you create that');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 30000);

  test('should handle session interruption gracefully', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Session interruption test timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        ['run', 'src/index.ts', 'chat', '--interactive', '--config', testConfigPath],
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
      let interrupted = false;

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        output += chunk;

        if (!interrupted && output.includes('Welcome to fosscode')) {
          interrupted = true;
          // Interrupt the session after a short delay
          setTimeout(() => {
            child.kill('SIGINT');
          }, 1000);
        }
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        // Should handle interruption gracefully
        expect(code === 0 || code === 130).toBe(true);
        expect(output.length).toBeGreaterThan(0);
        expect(output).toContain('Welcome to fosscode');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);
});
