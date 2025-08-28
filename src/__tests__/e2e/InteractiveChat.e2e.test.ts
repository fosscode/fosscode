import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Interactive Chat E2E Tests', () => {
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
      server.listen(8080, () => console.error('Mock server running on 8080'));
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

    // Test the mock server directly
    const http = require('http');
    const testReq = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      res => {
        console.log('Mock server test response status:', res.statusCode);
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => console.log('Mock server test response:', data));
      }
    );
    testReq.write(JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }));
    testReq.end();

    testConfigPath = path.join(__dirname, 'test-config.json');
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

  test('should handle non-interactive mode correctly', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', 'chat', 'hello', '--non-interactive'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FORCE_COLOR: '0',
          FOSSCODE_CONFIG_PATH: testConfigPath,
        },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Non-interactive test timed out'));
      }, 10000);

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
        console.log('Exit code:', code);
        console.log('Output:', output);
        console.log('Error output:', errorOutput);
        expect(code).toBe(0);
        expect(output).toContain('Hello');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);

  test('should show help information', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', '--help'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Help test timed out'));
      }, 5000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output).toContain('fosscode');
        expect(output).toContain('chat');
        expect(output).toContain('providers');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 10000);

  test('should list providers', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', 'providers'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Providers test timed out'));
      }, 5000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output).toContain('Available providers');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 10000);

  test('should handle theme commands', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', 'themes'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Themes test timed out'));
      }, 5000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output).toContain('Themes');
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 10000);

  test('should display version', async () => {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'src/index.ts', '--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Version test timed out'));
      }, 5000);

      let output = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.on('exit', code => {
        clearTimeout(timeout);
        expect(code).toBe(0);
        expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
        resolve();
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 10000);
});
