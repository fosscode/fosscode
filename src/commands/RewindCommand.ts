import pc from 'picocolors';
import * as path from 'path';
import { getCheckpointManager, CheckpointDiff } from '../utils/CheckpointManager.js';

/**
 * RewindCommand - Handle checkpoint viewing and rewind operations
 *
 * Usage:
 *   /rewind - Show list of recent checkpoints
 *   /rewind <id> - Rewind to a specific checkpoint
 *   /rewind diff <id> - Show diff for a checkpoint
 *   /rewind diff <id1> <id2> - Show diff between two checkpoints
 *   /rewind undo - Quick undo last change
 *   /rewind clear - Clear all checkpoints
 *   /rewind sessions - List all checkpoint sessions
 */
export class RewindCommand {
  private checkpointManager = getCheckpointManager();

  async execute(args: string[]): Promise<string> {
    if (args.length === 0) {
      return await this.listCheckpoints();
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'undo':
        return await this.quickUndo();

      case 'diff':
        if (args.length === 1) {
          return this.formatError('Please specify a checkpoint ID: /rewind diff <id>');
        }
        if (args.length === 2) {
          return await this.showCheckpointDiff(args[1]);
        }
        return await this.showDiffBetweenCheckpoints(args[1], args[2]);

      case 'clear':
        return await this.clearCheckpoints();

      case 'sessions':
        return await this.listSessions();

      case 'help':
        return this.showHelp();

      default:
        // Assume it's a checkpoint ID to rewind to
        return await this.rewindToCheckpoint(subcommand);
    }
  }

  /**
   * List recent checkpoints
   */
  private async listCheckpoints(limit: number = 20): Promise<string> {
    const checkpoints = await this.checkpointManager.listCheckpoints({ limit });

    if (checkpoints.length === 0) {
      return pc.yellow('No checkpoints available.\n\nCheckpoints are created automatically when files are modified.');
    }

    let output = pc.blue('Recent Checkpoints:\n\n');

    for (const cp of checkpoints) {
      const timeAgo = this.formatTimeAgo(cp.timestamp);
      const fileName = path.basename(cp.filePath);
      const dirName = path.dirname(cp.filePath);

      output += `${pc.cyan(cp.id)}\n`;
      output += `  ${pc.white(fileName)} ${pc.gray(`(${dirName})`)}\n`;
      output += `  ${pc.gray(cp.operation)} - ${timeAgo}`;
      if (cp.description) {
        output += ` - ${pc.gray(cp.description)}`;
      }
      output += '\n\n';
    }

    output += pc.gray('Commands:\n');
    output += pc.gray('  /rewind <id>        - Rewind to checkpoint\n');
    output += pc.gray('  /rewind diff <id>   - Show changes in checkpoint\n');
    output += pc.gray('  /rewind undo        - Undo last change\n');

    return output;
  }

  /**
   * Quick undo the last change
   */
  private async quickUndo(): Promise<string> {
    const result = await this.checkpointManager.quickUndo();

    if (result.success) {
      return pc.green(`Undo successful!\n\n${result.message}\n\nFile: ${result.filePath}`);
    } else {
      return this.formatError(result.message);
    }
  }

  /**
   * Rewind to a specific checkpoint
   */
  private async rewindToCheckpoint(checkpointId: string): Promise<string> {
    const result = await this.checkpointManager.rewindToCheckpoint(checkpointId);

    if (result.success) {
      return pc.green(`Rewind successful!\n\n${result.message}\n\nFile: ${result.filePath}`);
    } else {
      return this.formatError(result.message);
    }
  }

  /**
   * Show diff for a checkpoint
   */
  private async showCheckpointDiff(checkpointId: string): Promise<string> {
    const diff = await this.checkpointManager.getCheckpointDiff(checkpointId);

    if (!diff) {
      return this.formatError(`Checkpoint ${checkpointId} not found or has no diff information.`);
    }

    return this.formatDiff(diff);
  }

  /**
   * Show diff between two checkpoints
   */
  private async showDiffBetweenCheckpoints(id1: string, id2: string): Promise<string> {
    const diff = await this.checkpointManager.getDiffBetweenCheckpoints(id1, id2);

    if (!diff) {
      return this.formatError('Could not generate diff between checkpoints. They may not exist or may be for different files.');
    }

    return this.formatDiff(diff);
  }

  /**
   * Format a diff for display
   */
  private formatDiff(diff: CheckpointDiff): string {
    let output = pc.blue(`Diff for: ${diff.filePath}\n\n`);

    output += pc.cyan(`Lines added: ${pc.green(`+${diff.linesAdded}`)}\n`);
    output += pc.cyan(`Lines removed: ${pc.red(`-${diff.linesRemoved}`)}\n`);
    output += pc.cyan(`Lines changed: ${pc.yellow(`~${diff.linesChanged}`)}\n\n`);

    // Format the unified diff with colors
    const lines = diff.unifiedDiff.split('\n');
    for (const line of lines) {
      if (line.startsWith('+++') || line.startsWith('---')) {
        output += pc.bold(pc.blue(line)) + '\n';
      } else if (line.startsWith('@@')) {
        output += pc.cyan(line) + '\n';
      } else if (line.startsWith('+')) {
        output += pc.green(line) + '\n';
      } else if (line.startsWith('-')) {
        output += pc.red(line) + '\n';
      } else {
        output += pc.gray(line) + '\n';
      }
    }

    return output;
  }

  /**
   * Clear all checkpoints
   */
  private async clearCheckpoints(): Promise<string> {
    await this.checkpointManager.clearAllCheckpoints();
    return pc.green('All checkpoints have been cleared.');
  }

  /**
   * List checkpoint sessions
   */
  private async listSessions(): Promise<string> {
    const sessions = await this.checkpointManager.listSessions();

    if (sessions.length === 0) {
      return pc.yellow('No checkpoint sessions found.');
    }

    let output = pc.blue('Checkpoint Sessions:\n\n');

    for (const session of sessions) {
      const timeAgo = this.formatTimeAgo(session.startTime);
      const current = session.id === this.checkpointManager.getCurrentSessionId() ? pc.green(' (current)') : '';

      output += `${pc.cyan(session.id)}${current}\n`;
      output += `  Started: ${timeAgo}\n`;
      output += `  Checkpoints: ${session.checkpointCount}\n`;
      if (session.lastCheckpointTime) {
        output += `  Last activity: ${this.formatTimeAgo(session.lastCheckpointTime)}\n`;
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Show help for the rewind command
   */
  private showHelp(): string {
    return `${pc.blue('Rewind Command Help')}\n\n` +
      `${pc.white('Usage:')}\n` +
      `  /rewind              - List recent checkpoints\n` +
      `  /rewind <id>         - Rewind to a specific checkpoint\n` +
      `  /rewind diff <id>    - Show diff for a checkpoint\n` +
      `  /rewind diff <a> <b> - Show diff between two checkpoints\n` +
      `  /rewind undo         - Quick undo last change\n` +
      `  /rewind clear        - Clear all checkpoints\n` +
      `  /rewind sessions     - List checkpoint sessions\n` +
      `  /rewind help         - Show this help\n\n` +
      `${pc.gray('Checkpoints are automatically created when files are modified.')}`;
  }

  /**
   * Format an error message
   */
  private formatError(message: string): string {
    return pc.red(`Error: ${message}`);
  }

  /**
   * Format a timestamp as "X ago"
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    } else {
      return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    }
  }
}

/**
 * Parse and execute a rewind command
 * @param command The full command string (e.g., "/rewind diff abc123")
 * @returns The command result message
 */
export async function handleRewindCommand(command: string): Promise<string> {
  const parts = command.trim().split(/\s+/);
  // Remove the /rewind part
  const args = parts.slice(1);

  const rewindCommand = new RewindCommand();
  return await rewindCommand.execute(args);
}
