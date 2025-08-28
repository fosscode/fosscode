import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Interactive Chat E2E Tests', () => {
  let testConfigPath: string;
  let mockServerProcess: ChildProcessWithoutNullStreams;

  beforeAll(async () => {
    // Start mock API server
    mockServerProcess = spawn('node', [
      '-e',
      `
      const http = require('http');
      const server = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            choices: [{
              message: {
                content: 'Hello! I can help you with coding tasks. Type /help for available commands.'
              }
            }]
          }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(3000, () => console.log('Mock server running on 3000'));
    `,
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000));

    testConfigPath = path.join(__dirname, 'test-config.json');
    const testConfig = {
      providers: {
        openai: {
          apiKey: 'test-key',
          baseUrl: 'http://localhost:3000/v1',
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
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Non-interactive test timed out'));
      }, 10000);

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
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Help test timed out'));
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
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Providers test timed out'));
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
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Themes test timed out'));
      }, 5000);

      const child = spawn('bun', ['run', 'src/index.ts', 'themes'], {
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
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Version test timed out'));
      }, 5000);

      const child = spawn('bun', ['run', 'src/index.ts', '--version'], {
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
