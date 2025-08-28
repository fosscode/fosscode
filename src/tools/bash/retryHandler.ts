import { CommandExecutionResult } from './types.js';
import { BashToolInstaller } from './toolInstaller.js';
import { BashCommandExecutor } from './commandExecutor.js';

export class BashRetryHandler {
  constructor(
    private toolInstaller: BashToolInstaller,
    private commandExecutor: BashCommandExecutor
  ) {}

  async executeCommandWithRetry(
    command: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<CommandExecutionResult> {
    const lastResult = await this.commandExecutor.executeCommand(command, cwd, timeout, shell);

    // If command succeeded, return immediately
    if (lastResult.exitCode === 0) {
      return lastResult;
    }

    // Check if this looks like a missing tool error
    const detection = this.toolInstaller.detectMissingTool(command, lastResult.stderr);

    if (detection.tool && detection.shouldInstall) {
      console.log(`🔧 Detected missing tool: ${detection.tool}. Attempting to install...`);

      // Try to install the missing tool
      const installResult = await this.attemptInstallation(detection.tool, cwd, timeout, shell);

      if (installResult.exitCode === 0) {
        console.log(`✅ Successfully installed ${detection.tool}. Retrying original command...`);
        this.toolInstaller.markToolAsInstalled(detection.tool);
        // Retry the original command
        return await this.commandExecutor.executeCommand(command, cwd, timeout, shell);
      } else {
        console.log(`❌ Failed to install ${detection.tool}. Continuing with original error.`);
        this.toolInstaller.markToolAsInstalled(detection.tool); // Mark as attempted even if failed
      }
    }

    return lastResult;
  }

  private async attemptInstallation(
    tool: string,
    cwd: string,
    timeout: number,
    shell: string
  ): Promise<CommandExecutionResult> {
    const installCommands = this.toolInstaller.getInstallationCommands();
    const commands = installCommands[tool];

    if (!commands) {
      // Generic installation attempt
      return await this.commandExecutor.executeCommand(
        `which ${tool} || echo "No installation method available for ${tool}"`,
        cwd,
        timeout,
        shell
      );
    }

    // Try each installation method
    for (const installCmd of commands) {
      console.log(`🔧 Trying to install ${tool} with: ${installCmd}`);
      const result = await this.commandExecutor.executeCommand(installCmd, cwd, timeout, shell);
      if (result.exitCode === 0) {
        return result;
      }
    }

    // If all methods failed, return the last result
    return await this.commandExecutor.executeCommand(
      commands[commands.length - 1],
      cwd,
      timeout,
      shell
    );
  }
}
