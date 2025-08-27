import * as child_process from 'child_process';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';
import { cancellationManager } from '../utils/CancellationManager.js';

/**
 * Bash command execution tool
 * Provides secure execution of bash/zsh commands with timeout and output limits
 */
export class BashTool implements Tool {
  name = 'bash';
  description = 'Execute bash or zsh commands in a secure environment with timeout protection';

  // Track installed tools to prevent infinite loops
  private installedTools = new Set<string>();

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
      description: 'Command timeout in milliseconds (max 30000ms)',
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
      const { command, cwd = process.cwd(), timeout = 10000, shell = 'bash' } = params;

      // Validate inputs
      if (!command || typeof command !== 'string') {
        throw new Error('Command must be a non-empty string');
      }

      if (typeof timeout !== 'number' || timeout < 0 || timeout > 30000) {
        throw new Error('Timeout must be a number between 0 and 30000 milliseconds');
      }

      if (!['bash', 'zsh'].includes(shell)) {
        throw new Error('Shell must be either bash or zsh');
      }

      // Validate working directory
      const validatedCwd = await securityManager.validateDirectoryOperation(cwd);

      // Execute command with retry logic
      const result = await this.executeCommandWithRetry(command, validatedCwd, timeout, shell);

      return {
        success: true,
        data: {
          command,
          cwd: path.relative(process.cwd(), validatedCwd),
          shell,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          timeout: result.timedOut,
          executionTime: result.executionTime,
        },
        metadata: {
          executedAt: new Date().toISOString(),
          workingDirectory: validatedCwd,
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

  /**
   * Execute a command with retry logic and installation attempts
   */
  private async executeCommandWithRetry(
    command: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    executionTime: number;
  }> {
    const lastResult = await this.executeCommand(command, cwd, timeout, shell);

    // If command succeeded, return immediately
    if (lastResult.exitCode === 0) {
      return lastResult;
    }

    // Check if this looks like a missing tool error
    const missingTool = this.detectMissingTool(command, lastResult.stderr);

    if (missingTool) {
      // Check if we've already tried to install this tool to prevent loops
      if (this.installedTools.has(missingTool)) {
        console.log(
          `🔧 Tool ${missingTool} was already installed in this session. Skipping installation to prevent loop.`
        );
      } else {
        console.log(`🔧 Detected missing tool: ${missingTool}. Attempting to install...`);

        // Try to install the missing tool
        const installResult = await this.attemptInstallation(missingTool, cwd, timeout, shell);

        if (installResult.exitCode === 0) {
          console.log(`✅ Successfully installed ${missingTool}. Retrying original command...`);
          this.installedTools.add(missingTool);
          // Retry the original command
          return await this.executeCommand(command, cwd, timeout, shell);
        } else {
          console.log(`❌ Failed to install ${missingTool}. Continuing with original error.`);
          this.installedTools.add(missingTool); // Mark as attempted even if failed
        }
      }
    }

    return lastResult;
  }

  /**
   * Detect if error indicates a missing tool
   */
  private detectMissingTool(command: string, stderr: string): string | null {
    const errorText = stderr.toLowerCase();

    // Common missing tool patterns
    const patterns = [
      {
        pattern: /command not found/,
        tools: ['npm', 'bun', 'node', 'python', 'pip', 'git', 'curl', 'wget'],
      },
      { pattern: /npm: command not found/, tool: 'npm' },
      { pattern: /bun: command not found/, tool: 'bun' },
      { pattern: /node: command not found/, tool: 'node' },
      { pattern: /python: command not found/, tool: 'python' },
      { pattern: /pip: command not found/, tool: 'pip' },
      { pattern: /git: command not found/, tool: 'git' },
      { pattern: /curl: command not found/, tool: 'curl' },
      { pattern: /wget: command not found/, tool: 'wget' },
      { pattern: /'([^']+)': command not found/, tool: '$1' },
      { pattern: /"([^"]+)": command not found/, tool: '$1' },
    ];

    for (const { pattern, tools, tool } of patterns) {
      const match = errorText.match(pattern);
      if (match) {
        if (tools) {
          // Check if the command contains any of the tools
          for (const t of tools) {
            if (command.includes(t)) {
              return t;
            }
          }
        } else if (tool) {
          return tool === '$1' ? match[1] : tool;
        }
      }
    }

    return null;
  }

  /**
   * Attempt to install a missing tool
   */
  private async attemptInstallation(
    tool: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    executionTime: number;
  }> {
    const installCommands: Record<string, string[]> = {
      npm: [
        'curl -L https://www.npmjs.com/install.sh | sh',
        'apt-get update && apt-get install -y npm',
        'yum install -y npm',
      ],
      bun: ['curl -fsSL https://bun.sh/install | bash', 'npm install -g bun'],
      node: [
        'curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && apt-get install -y nodejs',
        'yum install -y nodejs',
        'brew install node',
      ],
      python: [
        'apt-get update && apt-get install -y python3',
        'yum install -y python3',
        'brew install python',
      ],
      pip: [
        'apt-get update && apt-get install -y python3-pip',
        'yum install -y python3-pip',
        'python3 -m ensurepip --upgrade',
      ],
      git: ['apt-get update && apt-get install -y git', 'yum install -y git', 'brew install git'],
      curl: [
        'apt-get update && apt-get install -y curl',
        'yum install -y curl',
        'brew install curl',
      ],
      wget: [
        'apt-get update && apt-get install -y wget',
        'yum install -y wget',
        'brew install wget',
      ],
    };

    const commands = installCommands[tool];
    if (!commands) {
      // Generic installation attempt
      return await this.executeCommand(
        `which ${tool} || echo "No installation method available for ${tool}"`,
        cwd,
        timeout,
        shell
      );
    }

    // Try each installation method
    for (const installCmd of commands) {
      console.log(`🔧 Trying to install ${tool} with: ${installCmd}`);
      const result = await this.executeCommand(installCmd, cwd, timeout, shell);
      if (result.exitCode === 0) {
        return result;
      }
    }

    // If all methods failed, return the last result
    return await this.executeCommand(commands[commands.length - 1], cwd, timeout, shell);
  }

  /**
   * Execute a command with timeout and capture output
   */
  private async executeCommand(
    command: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    executionTime: number;
  }> {
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
