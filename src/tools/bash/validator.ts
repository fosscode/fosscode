import { securityManager } from '../SecurityManager.js';
import { CommandValidationResult } from './types.js';

export class BashCommandValidator {
  static async validateCommand(
    command: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<CommandValidationResult> {
    // Validate command
    if (!command || typeof command !== 'string') {
      return {
        isValid: false,
        error: 'Command must be a non-empty string',
      };
    }

    // Validate timeout - allow longer timeouts for complex operations
    const maxTimeout = command.includes('jest') || command.includes('test') ? 120000 : 30000; // 2 minutes for tests, 30 seconds for others
    if (typeof timeout !== 'number' || timeout < 0 || timeout > maxTimeout) {
      return {
        isValid: false,
        error: `Timeout must be a number between 0 and ${maxTimeout} milliseconds`,
      };
    }

    // Validate shell
    if (!['bash', 'zsh'].includes(shell)) {
      return {
        isValid: false,
        error: 'Shell must be either bash or zsh',
      };
    }

    // Validate working directory
    try {
      await securityManager.validateDirectoryOperation(cwd);
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid working directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    return { isValid: true };
  }
}
