/**
 * @jest-environment node
 */
import { BashTool } from '../tools/BashTool';

describe('BashTool', () => {
  let bashTool: BashTool;

  // Helper function to check if a shell is available on the system
  async function isShellAvailable(shell: string): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync(`which ${shell}`);
      return true;
    } catch {
      return false;
    }
  }

  beforeEach(() => {
    bashTool = new BashTool();
  });

  describe('constructor', () => {
    it('should create a BashTool instance with correct properties', () => {
      bashTool = new BashTool();

      expect(bashTool.name).toBe('bash');
      expect(bashTool.description).toContain('Execute bash or zsh commands');
      expect(bashTool.parameters).toHaveLength(4);
    });

    it('should have correct parameter definitions', () => {
      bashTool = new BashTool();

      const commandParam = bashTool.parameters.find(p => p.name === 'command');
      expect(commandParam).toEqual({
        name: 'command',
        type: 'string',
        description: 'The bash/zsh command to execute',
        required: true,
      });

      const cwdParam = bashTool.parameters.find(p => p.name === 'cwd');
      expect(cwdParam?.required).toBe(false);
      expect(cwdParam?.defaultValue).toBe(process.cwd());

      const timeoutParam = bashTool.parameters.find(p => p.name === 'timeout');
      expect(timeoutParam?.defaultValue).toBe(10000);

      const shellParam = bashTool.parameters.find(p => p.name === 'shell');
      expect(shellParam?.defaultValue).toBe('bash');
    });
  });

  describe('execute', () => {
    it('should execute a simple command successfully', async () => {
      const params = { command: 'echo "hello world"' };

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.command).toBe('echo "hello world"');
      expect(result.data?.shell).toBe('bash');
      expect(result.data?.exitCode).toBe(0);
      expect(result.data?.stdout).toBe('hello world');
      expect(result.data?.stderr).toBe('');
      expect(result.data?.timeout).toBe(false);
      expect(typeof result.data?.executionTime).toBe('number');
      expect(result.metadata?.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle command with stderr output', async () => {
      const params = { command: 'echo "error" >&2' };

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.stderr).toBe('error');
      expect(result.data?.stdout).toBe('');
    });

    it('should handle non-zero exit codes', async () => {
      const params = { command: 'exit 1' };

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.exitCode).toBe(1);
    });

    it('should use custom working directory', async () => {
      const params = { command: 'pwd', cwd: process.cwd() };

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.cwd).toMatch(/^(|\.)$/); // Empty string or "." for current directory
    });

    it('should use zsh shell when specified', async () => {
      // Skip test if zsh is not available (e.g., in CI environments)
      const zshAvailable = await isShellAvailable('zsh');
      if (!zshAvailable) {
        console.log('Skipping zsh test: zsh not available on this system');
        return;
      }

      const params = { command: 'echo test', shell: 'zsh' };

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.shell).toBe('zsh');
    });

    describe('parameter validation', () => {
      it('should reject empty command', async () => {
        const params = { command: '' };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Command must be a non-empty string');
      });

      it('should reject non-string command', async () => {
        const params = { command: 123 };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Command must be a non-empty string');
      });

      it('should reject negative timeout', async () => {
        const params = { command: 'echo test', timeout: -100 };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Timeout must be a number between 0 and 30000 milliseconds');
      });

      it('should reject timeout over 30000ms', async () => {
        const params = { command: 'echo test', timeout: 40000 };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Timeout must be a number between 0 and 30000 milliseconds');
      });

      it('should reject invalid shell', async () => {
        const params = { command: 'echo test', shell: 'invalid' };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Shell must be either bash or zsh');
      });

      it('should handle security manager validation failure', async () => {
        const params = { command: 'echo test', cwd: '/root/invalid/path' };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid working directory');
      });
    });

    describe('error handling', () => {
      it('should handle invalid command errors', async () => {
        const params = { command: 'nonexistent_command_that_fails' };

        const result = await bashTool.execute(params);

        expect(result.success).toBe(true); // Command executes but returns non-zero exit code
        expect(result.data?.exitCode).not.toBe(0);
      });
    });
  });
});
