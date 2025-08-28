import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('Multi-Response E2E Tests', () => {
  let testConfigPath: string;
  let mockServerProcess: ChildProcessWithoutNullStreams;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'fosscode-multiresponse-'));

    // Start mock API server that supports streaming and multi-response scenarios
    mockServerProcess = spawn('node', [
      '-e',
      `
      const http = require('http');
      const server = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            const data = JSON.parse(body);
            const messages = data.messages || [];
            const lastMessage = messages[messages.length - 1];
            const isStreaming = data.stream === true;

            if (isStreaming) {
              // Handle streaming response
              res.writeHead(200, {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              });

              // Send multiple chunks to simulate streaming
              const chunks = [
                'data: {"choices":[{"index":0,"delta":{"content":"I"},"finish_reason":null}]}\n\n',
                'data: {"choices":[{"index":0,"delta":{"content":" am"},"finish_reason":null}]}\n\n',
                'data: {"choices":[{"index":0,"delta":{"content":" creating"},"finish_reason":null}]}\n\n',
                'data: {"choices":[{"index":0,"delta":{"content":" a function"},"finish_reason":null}]}\n\n',
                'data: {"choices":[{"index":0,"delta":{"content":" for you."},"finish_reason":"stop"}]}\n\n',
                'data: [DONE]\n\n'
              ];

              let chunkIndex = 0;
              const sendChunk = () => {
                if (chunkIndex < chunks.length) {
                  res.write(chunks[chunkIndex]);
                  chunkIndex++;
                  setTimeout(sendChunk, 100); // Simulate realistic streaming delay
                } else {
                  res.end();
                }
              };
              sendChunk();
            } else {
              // Handle regular response with multiple parts
              res.writeHead(200, { 'Content-Type': 'application/json' });

              if (lastMessage && lastMessage.content.includes('complex task')) {
                // Simulate a complex multi-step response
                res.end(JSON.stringify({
                  choices: [{
                    message: {
                      content: 'I\\'ll help you with this complex task. Let me break it down into steps.',
                      tool_calls: [
                        {
                          id: 'step1-call',
                          type: 'function',
                          function: {
                            name: 'write',
                            arguments: JSON.stringify({
                              filePath: '${tempDir}/step1.js',
                              content: '// Step 1: Initial setup\\nconsole.log("Step 1 completed");'
                            })
                          }
                        },
                        {
                          id: 'step2-call',
                          type: 'function',
                          function: {
                            name: 'write',
                            arguments: JSON.stringify({
                              filePath: '${tempDir}/step2.js',
                              content: '// Step 2: Main logic\\nconsole.log("Step 2 completed");'
                            })
                          }
                        }
                      ]
                    }
                  }]
                }));
              } else if (lastMessage && lastMessage.content.includes('partial')) {
                // Simulate partial response that gets continued
                res.end(JSON.stringify({
                  choices: [{
                    message: {
                      content: 'This is a partial response that should be continued...',
                      partial: true
                    }
                  }]
                }));
              } else {
                res.end(JSON.stringify({
                  choices: [{
                    message: {
                      content: 'I understand your request. How can I help you further?'
                    }
                  }]
                }));
              }
            }
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3003, () => console.log('Multi-response mock server running on 3003'));
    `.replace(/\${tempDir}/g, tempDir),
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    testConfigPath = path.join(__dirname, 'test-multiresponse-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'sk-test-key-123456789012345678901234567890',
          baseURL: 'http://localhost:3003/v1',
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

  test('should handle streaming responses correctly', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Streaming test timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'create a function',
          '--non-interactive',
          '--config',
          testConfigPath,
          '--stream',
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
      let streamChunks: string[] = [];

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        output += chunk;
        streamChunks.push(chunk);
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.length).toBeGreaterThan(0);
        // Verify that we received multiple chunks (streaming behavior)
        expect(streamChunks.length).toBeGreaterThan(1);
        // Verify the final content is complete
        expect(output).toContain('I am creating a function for you');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);

  test('should handle multiple tool calls in single response', async () => {
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
          'help me with this complex task',
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

        // Verify both files were created from multiple tool calls
        const step1File = path.join(tempDir, 'step1.js');
        const step2File = path.join(tempDir, 'step2.js');
        expect(fs.existsSync(step1File)).toBe(true);
        expect(fs.existsSync(step2File)).toBe(true);

        // Verify file contents
        const step1Content = fs.readFileSync(step1File, 'utf8');
        const step2Content = fs.readFileSync(step2File, 'utf8');
        expect(step1Content).toContain('Step 1');
        expect(step2Content).toContain('Step 2');

        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 25000);

  test('should handle partial responses and continuation', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Partial response test timed out'));
      }, 15000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'give me a partial response',
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
        // Verify partial response was handled
        expect(output).toContain('partial response');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 20000);

  test('should handle response interruption and recovery', async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Response interruption test timed out'));
      }, 20000);

      const child = spawn(
        'bun',
        [
          'run',
          'src/index.ts',
          'chat',
          'start a long response',
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
      let interrupted = false;

      child.stdout?.on('data', data => {
        output += data.toString();
        // Simulate interruption after receiving some data
        if (!interrupted && output.length > 10) {
          interrupted = true;
          setTimeout(() => {
            child.kill('SIGINT');
          }, 500);
        }
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        // Should handle interruption gracefully
        expect(code === 0 || code === 130).toBe(true);
        expect(output.length).toBeGreaterThan(0);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 25000);

  test('should handle concurrent multi-response scenarios', async () => {
    const promises: Promise<void>[] = [];

    // Run multiple concurrent requests to test multi-response handling
    for (let i = 0; i < 3; i++) {
      const promise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Concurrent test ${i} timed out`));
        }, 15000);

        const child = spawn(
          'bun',
          [
            'run',
            'src/index.ts',
            'chat',
            `concurrent request ${i}`,
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

      promises.push(promise);
    }

    await Promise.all(promises);
  }, 45000);
});
