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
      const fs = require('fs');
      const path = require('path');

      // Maintain conversation history per session
      const conversations = new Map();
      let messageCounter = 0;

      const server = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const messages = data.messages || [];
              const lastMessage = messages[messages.length - 1];
              const conversationId = data.conversation_id || 'default';

              // Initialize conversation history if not exists
              if (!conversations.has(conversationId)) {
                conversations.set(conversationId, []);
              }
              const history = conversations.get(conversationId);

              // Add current message to history
              history.push({
                role: lastMessage.role,
                content: lastMessage.content,
                timestamp: Date.now()
              });

              res.writeHead(200, { 'Content-Type': 'application/json' });

              // Intelligent response based on conversation context
              let response = {};
              const conversationLength = history.length;
              const fullContext = history.map(m => m.content).join(' ');

              if (conversationLength === 1 && lastMessage.content.includes('create function')) {
                response = {
                  choices: [{
                    message: {
                      content: 'I will create a JavaScript function for you. What should the function do?',
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
                };
              } else if (conversationLength === 2 && lastMessage.content.includes('test')) {
                response = {
                  choices: [{
                    message: {
                      content: 'I see you want to test the greet function. I\\'ll create a test file that demonstrates its usage.',
                      tool_calls: [{
                        id: 'write-call-2',
                        type: 'function',
                        function: {
                          name: 'write',
                          arguments: JSON.stringify({
                            filePath: '${tempDir}/test.js',
                            content: 'const greet = require("./greet");\\nconsole.log(greet("World")); // Should output: Hello, World!\\nconsole.log(greet("Alice")); // Should output: Hello, Alice!'
                          })
                        }
                      }]
                    }
                  }]
                };
              } else if (lastMessage.content.includes('run') || lastMessage.content.includes('execute')) {
                response = {
                  choices: [{
                    message: {
                      content: 'I\\'ll run the test to show you the function works.',
                      tool_calls: [{
                        id: 'bash-call-1',
                        type: 'function',
                        function: {
                          name: 'bash',
                          arguments: JSON.stringify({
                            command: 'cd "${tempDir}" && node test.js',
                            description: 'Run the test script to demonstrate the greet function'
                          })
                        }
                      }]
                    }
                  }]
                };
              } else if (lastMessage.content.includes('read') || lastMessage.content.includes('show')) {
                response = {
                  choices: [{
                    message: {
                      content: 'Let me show you the contents of the files we created.',
                      tool_calls: [{
                        id: 'read-call-1',
                        type: 'function',
                        function: {
                          name: 'read',
                          arguments: JSON.stringify({
                            filePath: '${tempDir}/greet.js'
                          })
                        }
                      }]
                    }
                  }]
                };
              } else if (lastMessage.content.includes('hello') || lastMessage.content.includes('hi')) {
                response = {
                  choices: [{
                    message: {
                      content: 'Hello! I\\'m here to help you with coding tasks. I can see from our conversation that we\\'ve been working on a greet function. What would you like to do next?'
                    }
                  }]
                };
              } else {
                response = {
                  choices: [{
                    message: {
                      content: 'I understand you\\'re continuing our conversation about the greet function. How else can I assist you with your code?'
                    }
                  }]
                };
              }

              // Add response to history
              history.push({
                role: 'assistant',
                content: JSON.stringify(response),
                timestamp: Date.now()
              });

              res.end(JSON.stringify(response));
            } catch (error) {
              console.error('Mock server error:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        } else if (req.url === '/v1/conversations/reset') {
          // Reset conversation endpoint
          const conversationId = req.headers['x-conversation-id'] || 'default';
          conversations.delete(conversationId);
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'Conversation reset' }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3002, () => console.log('Enhanced mock conversation server running on 3002'));
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

  test('should handle sequential non-interactive messages', async () => {
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

  test('should handle simple conversation', async () => {
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

  test('should handle network timeouts gracefully', async () => {
    return new Promise<void>((resolve, reject) => {
      // Create a config that points to a non-responsive server
      const timeoutConfigPath = path.join(__dirname, 'timeout-config.json');
      const timeoutConfig = {
        providers: {
          openai: {
            apiKey: 'sk-test-key-123456789012345678901234567890',
            baseURL: 'http://localhost:9999/v1', // Non-responsive port
          },
        },
        defaultProvider: 'openai',
      };
      fs.writeFileSync(timeoutConfigPath, JSON.stringify(timeoutConfig, null, 2));

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'hello',
          '--non-interactive',
          '--config',
          timeoutConfigPath,
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            FORCE_COLOR: '0',
            FOSSCODE_CONFIG_PATH: timeoutConfigPath,
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
        fs.unlinkSync(timeoutConfigPath);
        // Should handle network error gracefully
        expect(code).not.toBe(0);
        expect(output.length).toBeGreaterThan(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        fs.unlinkSync(timeoutConfigPath);
        reject(error);
      });
    });
  }, 20000);

  test('should handle malformed API responses', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Malformed response test timed out'));
      }, 15000);

      // Create a config that points to a server that returns malformed JSON
      const malformedConfigPath = path.join(__dirname, 'malformed-config.json');
      const malformedConfig = {
        providers: {
          openai: {
            apiKey: 'sk-test-key-123456789012345678901234567890',
            baseURL: 'http://localhost:3005/v1', // Will create a malformed response server
          },
        },
        defaultProvider: 'openai',
      };
      fs.writeFileSync(malformedConfigPath, JSON.stringify(malformedConfig, null, 2));

      // Start a server that returns malformed JSON
      const malformedServer = spawn('node', [
        '-e',
        `
        const http = require('http');
        const server = http.createServer((req, res) => {
          if (req.url === '/v1/chat/completions') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{ invalid json }');
          } else {
            res.writeHead(404);
            res.end();
          }
        });
        server.listen(3005, () => console.log('Malformed response server running on 3005'));
        `,
      ]);

      setTimeout(() => {
        const child = spawn(
          'bun',
          [
            'run',
            'src/index.ts',
            'chat',
            'hello',
            '--non-interactive',
            '--config',
            malformedConfigPath,
          ],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd(),
            env: {
              ...process.env,
              NODE_ENV: 'test',
              FORCE_COLOR: '0',
              FOSSCODE_CONFIG_PATH: malformedConfigPath,
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
          fs.unlinkSync(malformedConfigPath);
          malformedServer.kill();
          // Should handle malformed JSON gracefully
          expect(code).not.toBe(0);
          expect(output.length).toBeGreaterThan(0);
          resolve();
        });

        child.on('error', error => {
          clearTimeout(timeout);
          fs.unlinkSync(malformedConfigPath);
          malformedServer.kill();
          reject(error);
        });
      }, 1000);
    });
  }, 25000);

  test('should maintain conversation context across multiple interactions', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child1.kill();
        reject(new Error('Conversation context test timed out'));
      }, 30000);

      // First interaction: Create a function
      const child1 = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'create a greet function',
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
            CONVERSATION_ID: 'test-session-123',
          },
        }
      );

      let output1 = '';
      child1.stdout?.on('data', data => {
        output1 += data.toString();
      });

      child1.on('exit', code1 => {
        expect(code1).toBe(0);
        expect(output1.length).toBeGreaterThan(0);

        // Verify the function file was created
        const functionFile = path.join(tempDir, 'greet.js');
        expect(fs.existsSync(functionFile)).toBe(true);

        // Second interaction: Create a test (should remember the function)
        const child2 = spawn(
          'bun',
          [
            'run',
            'src/index.ts',
            'chat',
            'now create a test for it',
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
              CONVERSATION_ID: 'test-session-123',
            },
          }
        );

        let output2 = '';
        child2.stdout?.on('data', data => {
          output2 += data.toString();
        });

        child2.on('exit', code2 => {
          expect(code2).toBe(0);
          expect(output2.length).toBeGreaterThan(0);

          // Verify the test file was created
          const testFile = path.join(tempDir, 'test.js');
          expect(fs.existsSync(testFile)).toBe(true);

          // Third interaction: Run the test (should remember both previous steps)
          const child3 = spawn(
            'bun',
            [
              'run',
              'src/index.ts',
              'chat',
              'run the test to show it works',
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
                CONVERSATION_ID: 'test-session-123',
              },
            }
          );

          let output3 = '';
          child3.stdout?.on('data', data => {
            output3 += data.toString();
          });

          child3.on('exit', code3 => {
            clearTimeout(timeout);
            expect(code3).toBe(0);
            expect(output3.length).toBeGreaterThan(0);
            resolve();
          });

          child3.on('error', error => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        child2.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      child1.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 45000);

  test('should handle conversation reset functionality', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child1.kill();
        reject(new Error('Conversation reset test timed out'));
      }, 20000);

      const conversationId = 'reset-test-session';

      // First create some conversation context
      const child1 = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'create a function',
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
            CONVERSATION_ID: conversationId,
          },
        }
      );

      child1.on('exit', code1 => {
        expect(code1).toBe(0);

        // Simulate conversation reset by using a fresh conversation ID
        const child2 = spawn(
          'bun',
          [
            'run',
            'src/index.ts',
            'chat',
            'what were we just working on?',
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
              CONVERSATION_ID: 'fresh-session',
            },
          }
        );

        let output2 = '';
        child2.stdout?.on('data', data => {
          output2 += data.toString();
        });

        child2.on('exit', code2 => {
          clearTimeout(timeout);
          expect(code2).toBe(0);
          expect(output2.length).toBeGreaterThan(0);
          // The response should not reference the previous conversation
          expect(output2).not.toContain('function');
          resolve();
        });

        child2.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      child1.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 30000);

  test('should handle multiple tool calls in a single response', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Multiple tool calls test timed out'));
      }, 20000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'create both a utility function and its test file',
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
            CONVERSATION_ID: 'multi-tool-test',
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

        // Check that both files were created
        const utilFile = path.join(tempDir, 'greet.js');
        const testFile = path.join(tempDir, 'test.js');
        expect(fs.existsSync(utilFile)).toBe(true);
        expect(fs.existsSync(testFile)).toBe(true);

        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 25000);
});
