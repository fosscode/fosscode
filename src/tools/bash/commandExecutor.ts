import * as child_process from 'child_process';
import { cancellationManager } from '../../utils/CancellationManager.js';
import { CommandExecutionResult } from './types.js';

export class BashCommandExecutor {
  async executeCommand(
    command: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<CommandExecutionResult> {
    return new Promise((resolve, reject) => {
      // Check if cancellation was requested before starting
      if (cancellationManager.shouldCancel()) {
        reject(new Error('Command cancelled by user'));
        return;
      }

      const startTime = Date.now();

      const child = child_process.spawn(shell, ['-c', command], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PWD: cwd },
      });

      // Register the child process for cancellation tracking
      cancellationManager.registerProcess(child);

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);

      // Capture stdout
      child.stdout?.on('data', data => {
        // Check for cancellation during execution
        if (cancellationManager.shouldCancel()) {
          child.kill('SIGTERM');
          return;
        }

        stdout += data.toString();
        // Limit output size to prevent memory issues
        if (stdout.length > 1024 * 1024) {
          // 1MB limit
          child.kill('SIGTERM');
        }
      });

      // Capture stderr
      child.stderr?.on('data', data => {
        // Check for cancellation during execution
        if (cancellationManager.shouldCancel()) {
          child.kill('SIGTERM');
          return;
        }

        stderr += data.toString();
        // Limit output size
        if (stderr.length > 1024 * 1024) {
          // 1MB limit
          child.kill('SIGTERM');
        }
      });

      // Handle process completion
      child.on('close', code => {
        clearTimeout(timer);
        const executionTime = Date.now() - startTime;

        resolve({
          exitCode: code ?? -1,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timedOut,
          executionTime,
        });
      });

      // Handle spawn errors
      child.on('error', error => {
        clearTimeout(timer);
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }
}
