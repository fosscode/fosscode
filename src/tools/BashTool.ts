import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { BashCommandValidator } from './bash/validator.js';
import { BashToolInstaller } from './bash/toolInstaller.js';
import { BashCommandExecutor } from './bash/commandExecutor.js';
import { BashRetryHandler } from './bash/retryHandler.js';

/**
 * Bash command execution tool
 * Provides secure execution of bash/zsh commands with timeout and output limits
 */
export class BashTool implements Tool {
  name = 'bash';
  description = 'Execute bash or zsh commands in a secure environment with timeout protection';

  private toolInstaller: BashToolInstaller;
  private commandExecutor: BashCommandExecutor;
  private retryHandler: BashRetryHandler;

  constructor() {
    this.toolInstaller = new BashToolInstaller();
    this.commandExecutor = new BashCommandExecutor();
    this.retryHandler = new BashRetryHandler(this.toolInstaller, this.commandExecutor);
  }

  parameters: ToolParameter[] = [
    {
      name: 'command',
      type: 'string',
      description: 'The bash/zsh command to execute',
      required: true,
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'Working directory for command execution (defaults to current directory)',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Command timeout in milliseconds (max 120000ms for tests, 30000ms for others)',
      required: false,
      defaultValue: 10000,
    },
    {
      name: 'shell',
      type: 'string',
      description: 'Shell to use (bash or zsh, defaults to bash)',
      required: false,
      defaultValue: 'bash',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { command, cwd = process.cwd(), shell = 'bash' } = params;

      // Use higher default timeout for test commands
      const defaultTimeout = command.includes('jest') || command.includes('test') ? 60000 : 10000;
      const timeout = params.timeout ?? defaultTimeout;

      // Validate inputs
      const validation = await BashCommandValidator.validateCommand(command, cwd, timeout, shell);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Execute command with retry logic
      const result = await this.retryHandler.executeCommandWithRetry(command, cwd, timeout, shell);

      return {
        success: true,
        data: {
          command,
          cwd: path.relative(process.cwd(), cwd),
          shell,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          timeout: result.timedOut,
          executionTime: result.executionTime,
        },
        metadata: {
          executedAt: new Date().toISOString(),
          workingDirectory: cwd,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred while executing command',
      };
    }
  }
}
