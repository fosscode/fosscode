/// <reference types="node" />
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import chalk from 'chalk';

export type CancellationLevel = 'command' | 'full';

export interface CancellationToken {
  isCancelled: boolean;
  level: CancellationLevel;
  reason?: string;
}

/**
 * Manages cancellation of operations triggered by escape key presses
 */
export class CancellationManager extends EventEmitter {
  private isListening = false;
  private escapeCount = 0;
  private escapeTimer: NodeJS.Timeout | null = null;
  private cancellationToken: CancellationToken = {
    isCancelled: false,
    level: 'command',
  };
  private activeProcesses = new Set<child_process.ChildProcess>();

  constructor() {
    super();
  }

  /**
   * Start listening for escape key presses
   */
  startListening(): void {
    if (this.isListening) return;

    this.isListening = true;
    this.setupKeypressListener();
    this.emit('listeningStarted');
  }

  /**
   * Stop listening for escape key presses
   */
  stopListening(): void {
    if (!this.isListening) return;

    this.isListening = false;
    this.removeKeypressListener();
    this.emit('listeningStopped');
  }

  /**
   * Get the current cancellation token
   */
  getCancellationToken(): CancellationToken {
    return { ...this.cancellationToken };
  }

  /**
   * Check if operations should be cancelled
   */
  shouldCancel(): boolean {
    return this.cancellationToken.isCancelled;
  }

  /**
   * Register a child process for cancellation tracking
   */
  registerProcess(process: child_process.ChildProcess): void {
    this.activeProcesses.add(process);

    process.on('close', () => {
      this.activeProcesses.delete(process);
    });

    process.on('error', () => {
      this.activeProcesses.delete(process);
    });
  }

  /**
   * Cancel all operations based on the current cancellation level
   */
  private cancelOperations(level: CancellationLevel): void {
    this.cancellationToken = {
      isCancelled: true,
      level,
      reason:
        level === 'command'
          ? 'Command cancelled by user (ESC)'
          : 'Full cancellation requested by user (ESC ESC)',
    };

    console.log(chalk.yellow(`\n${this.cancellationToken.reason}`));

    if (level === 'full') {
      this.killAllProcesses();
    }

    this.emit('cancelled', this.cancellationToken);
  }

  /**
   * Kill all tracked child processes
   */
  private killAllProcesses(): void {
    for (const process of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Process might already be dead
      }
    }
    this.activeProcesses.clear();
    console.log(chalk.red('🛑 Killed all background processes'));
  }

  /**
   * Reset cancellation state
   */
  reset(): void {
    this.cancellationToken = {
      isCancelled: false,
      level: 'command',
    };
    this.escapeCount = 0;
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
      this.escapeTimer = null;
    }
  }

  /**
   * Setup keypress event listener
   */
  private setupKeypressListener(): void {
    // Enable raw mode for stdin to capture escape key
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }

    process.stdin.on('data', data => {
      const key = data.toString();

      // Check for escape key (ASCII 27)
      if (key === '\u001b') {
        this.handleEscapePress();
      }
    });
  }

  /**
   * Remove keypress event listener
   */
  private removeKeypressListener(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    process.stdin.removeAllListeners('data');
  }

  /**
   * Handle escape key press with double-tap detection
   */
  private handleEscapePress(): void {
    this.escapeCount++;

    if (this.escapeCount === 1) {
      // Start timer for double-tap detection
      this.escapeTimer = setTimeout(() => {
        // Single escape - cancel command processing
        this.cancelOperations('command');
        this.escapeCount = 0;
      }, 500); // 500ms window for double escape
    } else if (this.escapeCount === 2) {
      // Double escape - full cancellation
      if (this.escapeTimer) {
        clearTimeout(this.escapeTimer);
        this.escapeTimer = null;
      }
      this.cancelOperations('full');
      this.escapeCount = 0;
    }
  }
}

// Export singleton instance
export const cancellationManager = new CancellationManager();
