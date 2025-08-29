import { spawn } from 'child_process';
import * as path from 'path';

export class E2ETestHelper {
  private static projectRoot = path.resolve(__dirname, '../../..');
  private static distPath = path.join(E2ETestHelper.projectRoot, 'dist/index.js');

  static async buildProject() {
    return new Promise<void>((resolve, reject) => {
      const child = spawn('bun', ['run', 'build'], {
        cwd: E2ETestHelper.projectRoot,
        stdio: 'inherit',
      });

      child.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  private static mockResponses: Array<{ regex: string; response: string }> = [];

  static setupMockResponse(promptRegex: RegExp, response: string) {
    // Store mock responses to pass to child process via environment variable
    this.mockResponses.push({
      regex: promptRegex.source,
      response: response,
    });
  }

  static clearMockResponses() {
    this.mockResponses = [];
  }

  static async runCliCommand(args: string[], options?: { timeout?: number }) {
    return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = spawn('node', [E2ETestHelper.distPath, ...args], {
        env: {
          ...process.env,
          FOSSCODE_PROVIDER: 'mock',
          NODE_ENV: 'test',
          MOCK_RESPONSES: JSON.stringify(this.mockResponses),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Command timed out'));
      }, options?.timeout || 30000);

      child.on('close', code => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  static async runChatCommand(message: string, options?: { timeout?: number }) {
    return await E2ETestHelper.runCliCommand(
      ['chat', '--provider=mock', '--non-interactive', message],
      options
    );
  }

  static async runModelsCommand(provider = 'mock', options?: { timeout?: number }) {
    return await E2ETestHelper.runCliCommand(['models', provider], options);
  }

  static async runProvidersCommand(options?: { timeout?: number }) {
    return await E2ETestHelper.runCliCommand(['providers'], options);
  }
}
