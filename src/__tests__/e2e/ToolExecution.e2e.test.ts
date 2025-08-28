import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
/**
 * Tool Execution E2E Tests
 *
 * These tests validate the tool execution pipeline and file system operations
 * of fosscode. Some tests are currently skipped due to mock server limitations
 * or complex multi-step scenarios that require further development.
 *
 * Skipped tests represent intended functionality that should work but
 * currently have infrastructure or implementation issues.
 */

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

    // Start enhanced mock API server that supports complex tool execution
    mockServerProcess = spawn('node', [
      '-e',
      `
      const http = require('http');
      const fs = require('fs');
      const path = require('path');

      let requestCount = 0;
      const toolExecutionHistory = new Map();

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

              // Initialize tool history for this conversation
              if (!toolExecutionHistory.has(conversationId)) {
                toolExecutionHistory.set(conversationId, []);
              }
              const history = toolExecutionHistory.get(conversationId);

              res.writeHead(200, { 'Content-Type': 'application/json' });

               let response = {};

               console.error('Mock server received message:', lastMessage.content);
               if (lastMessage && lastMessage.content.includes('list files')) {
                response = {
                  choices: [{
                    message: {
                      content: 'I\\'ll list the files in the directory for you.',
                      tool_calls: [{
                        id: 'list-call-1',
                        type: 'function',
                        function: {
                          name: 'bash',
                          arguments: JSON.stringify({
                            command: 'ls -la "${tempDir}"',
                            description: 'List all files in the test directory with details'
                          })
                        }
                      }]
                    }
                  }]
                };
               } else if (lastMessage && lastMessage.content.includes('create') && lastMessage.content.includes('file')) {
                 // Handle specific step1.txt creation for complex tool chain test
                 if (lastMessage.content.includes('step1.txt') && lastMessage.content.includes('Step 1: Initial setup completed')) {
                   response = {
                     choices: [{
                       message: {
                         content: 'I\\'ll create the step1.txt file for you.',
                         tool_calls: [{
                           id: 'write-call-step1',
                           type: 'function',
                           function: {
                             name: 'write',
                             arguments: JSON.stringify({
                               filePath: '${tempDir}/step1.txt',
                               content: 'Step 1: Initial setup completed'
                             })
                           }
                         }]
                       }
                     }
                   }]
                 } else {
                   // Handle general file creation
                   response = {
                     choices: [{
                       message: {
                         content: 'I\\'ll create a test file for you.',
                         tool_calls: [{
                           id: 'write-call-1',
                           type: 'function',
                           function: {
                             name: 'write',
                             arguments: JSON.stringify({
                               filePath: '${tempDir}/created-file.txt',
                               content: 'This is a test file created by the tool execution test.\\nIt contains multiple lines.\\nLine 3: End of file.'
                             })
                           }
                         }]
                       }
                     }
                   }]
                 }
              } else if (lastMessage && lastMessage.content.includes('read') && lastMessage.content.includes('file')) {
                response = {
                  choices: [{
                    message: {
                      content: 'I\\'ll read the content of the test file for you.',
                      tool_calls: [{
                        id: 'read-call-1',
                        type: 'function',
                        function: {
                          name: 'read',
                          arguments: JSON.stringify({
                            filePath: '${tempDir}/test.txt'
                          })
                        }
                      }]
                    }
                  }]
                };
              } else if (lastMessage && lastMessage.content.includes('run') || lastMessage.content.includes('execute')) {
                response = {
                  choices: [{
                    message: {
                      content: 'I\\'ll execute the script for you.',
                      tool_calls: [{
                        id: 'bash-call-1',
                        type: 'function',
                        function: {
                          name: 'bash',
                          arguments: JSON.stringify({
                            command: 'cd "${tempDir}" && node script.js',
                            description: 'Execute the JavaScript script'
                          })
                        }
                      }]
                    }
                  }]
                };
               } else if (lastMessage && (lastMessage.content.includes('create') && lastMessage.content.includes('file') && (lastMessage.content.includes('step1.txt') || lastMessage.content.includes('Step 1')))) {
                 // Multi-step tool execution - create step1.txt file
                 console.error('Mock server matched step1.txt condition');
                 response = {
                   choices: [{
                     message: {
                       content: 'I will create the step1.txt file as requested.',
                       tool_calls: [{
                         id: 'step1-call',
                         type: 'function',
                         function: {
                           name: 'write',
                           arguments: JSON.stringify({
                             filePath: '${tempDir}/step1.txt',
                             content: 'Step 1: Initial setup completed'
                           })
                         }
                       }]
                     }
                   }]
                 };
              } else if (lastMessage && lastMessage.content.includes('error') || lastMessage.content.includes('fail')) {
                // Test error handling
                response = {
                  choices: [{
                    message: {
                      content: 'I\\'ll test error handling by trying to access a non-existent file.',
                      tool_calls: [{
                        id: 'error-call-1',
                        type: 'function',
                        function: {
                          name: 'read',
                          arguments: JSON.stringify({
                            filePath: '${tempDir}/non-existent-file.txt'
                          })
                        }
                      }]
                    }
                  }]
                };
               } else {
                 console.error('Mock server fell through to default case');
                 response = {
                   choices: [{
                     message: {
                       content: 'I understand your request. What specific tool operation would you like me to perform?'
                     }
                   }]
                 };
               }

              // Track tool execution in history
              history.push({
                request: lastMessage.content,
                response: response,
                timestamp: Date.now()
              });

              res.end(JSON.stringify(response));
              requestCount++;
            } catch (error) {
              console.error('Mock server error:', error);
              res.writeHead(500);
              res.end(JSON.stringify({ error: 'Internal server error' }));
            }
          });
        } else if (req.url === '/v1/tool-results') {
          // Endpoint to check tool execution results
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const conversationId = req.headers['x-conversation-id'] || 'default';
          const history = toolExecutionHistory.get(conversationId) || [];
          res.end(JSON.stringify({ history }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3001, () => console.log('Enhanced mock tool server running on 3001'));
    `.replace(/\${tempDir}/g, tempDir),
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

  test('should execute tool calls in non-interactive mode', async () => {
    return new Promise<void>((resolve, reject) => {
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

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Tool execution test timed out'));
      }, 15000);

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

  test('should handle verbose mode with tool execution', async () => {
    return new Promise<void>((resolve, reject) => {
      const writeTestFile = path.join(tempDir, 'verbose-test.txt');

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          `create a file at ${writeTestFile} with content "test"`,
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

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Verbose test timed out'));
      }, 10000);

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
      const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('CLI validation test timed out'));
      }, 5000);

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

  test('should handle file operations', async () => {
    return new Promise<void>((resolve, reject) => {
      const testFile = path.join(tempDir, 'read-test.txt');
      fs.writeFileSync(testFile, 'Content to read\nLine 2\nLine 3');

      const child = spawn(
        'bun',
        ['run', 'src/index.ts', 'chat', `read the file ${testFile}`, '--non-interactive'],
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

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('File operation test timed out'));
      }, 10000);

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

  test('should handle complex multi-step tool chains', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Complex tool chain test timed out'));
      }, 25000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          `create a file at ${tempDir}/step1.txt with content "Step 1: Initial setup completed"`,
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
            CONVERSATION_ID: 'complex-tool-test',
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

        // Verify the first step of the complex task was completed
        const step1File = path.join(tempDir, 'step1.txt');

        expect(fs.existsSync(step1File)).toBe(true);

        const step1Content = fs.readFileSync(step1File, 'utf8');
        expect(step1Content).toContain('Step 1: Initial setup completed');

        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 30000);
});
