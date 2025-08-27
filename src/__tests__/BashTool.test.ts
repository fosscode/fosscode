import { BashTool } from '../tools/BashTool';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  relative: jest.fn((_from: string, to: string) => to),
}));

// Mock SecurityManager
jest.mock('../tools/SecurityManager', () => ({
  securityManager: {
    validateDirectoryOperation: jest.fn(),
  },
}));

describe('BashTool', () => {
  let bashTool: BashTool;
  let mockChildProcess: any;
  let mockSpawn: jest.Mock;
  let mockValidateDirectoryOperation: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const childProcess = require('child_process');
    mockSpawn = childProcess.spawn as jest.Mock;

    const securityModule = require('../tools/SecurityManager');
    mockValidateDirectoryOperation = securityModule.securityManager.validateDirectoryOperation;

    const securityManager = require('../tools/SecurityManager').securityManager;
    mockValidateDirectoryOperation = securityManager.validateDirectoryOperation as jest.Mock;

    // Create mock child process
    mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess);
    mockValidateDirectoryOperation.mockResolvedValue('/validated/path');
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
    beforeEach(() => {
      bashTool = new BashTool();
    });

    it('should execute a simple command successfully', async () => {
      const params = { command: 'echo "hello world"' };

      // Mock successful command execution
      mockChildProcess.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            callback(0); // Exit code 0 (success)
          }
        }
      );

      mockChildProcess.stdout.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'data') {
            callback(Buffer.from('hello world\n'));
          }
        }
      );

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        command: 'echo "hello world"',
        cwd: '/validated/path',
        shell: 'bash',
        exitCode: 0,
        stdout: 'hello world',
        stderr: '',
        timeout: false,
        executionTime: expect.any(Number),
      });
      expect(result.metadata).toEqual({
        executedAt: expect.any(String),
        workingDirectory: '/validated/path',
      });
    });

    it('should handle command with stderr output', async () => {
      const params = { command: 'echo "error" >&2' };

      mockChildProcess.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            callback(0);
          }
        }
      );

      mockChildProcess.stderr.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'data') {
            callback(Buffer.from('error\n'));
          }
        }
      );

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.stderr).toBe('error');
      expect(result.data?.stdout).toBe('');
    });

    it('should handle non-zero exit codes', async () => {
      const params = { command: 'exit 1' };

      mockChildProcess.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            callback(1); // Exit code 1 (failure)
          }
        }
      );

      const result = await bashTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.exitCode).toBe(1);
    });

    it('should use custom working directory', async () => {
      const params = { command: 'pwd', cwd: '/custom/path' };

      mockValidateDirectoryOperation.mockResolvedValue('/custom/path');

      mockChildProcess.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            callback(0);
          }
        }
      );

      mockChildProcess.stdout.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'data') {
            callback(Buffer.from('/custom/path\n'));
          }
        }
      );

      const result = await bashTool.execute(params);

      expect(mockValidateDirectoryOperation).toHaveBeenCalledWith('/custom/path');
      expect(result.data?.cwd).toBe('/custom/path');
    });

    it('should use zsh shell when specified', async () => {
      const params = { command: 'echo test', shell: 'zsh' };

      mockChildProcess.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            callback(0);
          }
        }
      );

      const result = await bashTool.execute(params);

      expect(mockSpawn).toHaveBeenCalledWith('zsh', ['-c', 'echo test'], expect.any(Object));
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
        const params = { command: 'echo test', cwd: '/invalid/path' };

        mockValidateDirectoryOperation.mockRejectedValue(new Error('Access denied'));

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Access denied');
      });
    });

    describe('error handling', () => {
      it('should handle spawn errors', async () => {
        const params = { command: 'echo test' };

        mockSpawn.mockImplementation(() => {
          throw new Error('Failed to execute command: Shell not found');
        });

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to execute command: Shell not found');
      });

      it('should handle child process errors', async () => {
        const params = { command: 'echo test' };

        mockChildProcess.on.mockImplementation(
          (event: string, callback: (...args: any[]) => void) => {
            if (event === 'error') {
              callback(new Error('Process failed'));
            }
          }
        );

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to execute command: Process failed');
      });

      it('should handle unknown errors', async () => {
        const params = { command: 'echo test' };

        mockSpawn.mockImplementation(() => {
          throw 'String error'; // Non-Error object
        });

        const result = await bashTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error occurred while executing command');
      });
    });
  });

  describe('executeCommand', () => {
    beforeEach(() => {
      bashTool = new BashTool();
    });

    it('should set up correct spawn options', async () => {
      const command = 'ls -la';
      const cwd = '/test/path';
      const timeout = 5000;
      const shell = 'zsh';

      mockChildProcess.on.mockImplementation(
        (event: string, callback: (...args: any[]) => void) => {
          if (event === 'close') {
            callback(0);
          }
        }
      );

      await (bashTool as any).executeCommand(command, cwd, timeout, shell);

      expect(mockSpawn).toHaveBeenCalledWith('zsh', ['-c', 'ls -la'], {
        cwd: '/test/path',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: expect.objectContaining({
          PWD: '/test/path',
        }),
      });
    });
  });
});
