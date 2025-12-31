import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Represents a checkpoint of a file's state before modification
 */
export interface Checkpoint {
  id: string;
  timestamp: Date;
  filePath: string;
  originalContent: string;
  newContent?: string | undefined;
  operation: 'write' | 'edit' | 'multiedit' | 'patch';
  description?: string | undefined;
  sessionId: string;
  diff?: string | undefined;
}

/**
 * Checkpoint metadata for listing and navigation
 */
export interface CheckpointMetadata {
  id: string;
  timestamp: Date;
  filePath: string;
  operation: string;
  description?: string;
  sessionId: string;
  hasNewContent: boolean;
}

/**
 * Session information for grouping checkpoints
 */
export interface CheckpointSession {
  id: string;
  startTime: Date;
  checkpointCount: number;
  lastCheckpointTime?: Date;
}

/**
 * Diff result for showing changes between checkpoints
 */
export interface CheckpointDiff {
  filePath: string;
  beforeContent: string;
  afterContent: string;
  unifiedDiff: string;
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
}

/**
 * CheckpointManager - Manages file state checkpoints for undo/rewind functionality
 *
 * Features:
 * - Automatic checkpoint creation before file modifications
 * - Checkpoint persistence across sessions
 * - Diff generation between checkpoints
 * - Quick undo of last change
 * - Full rewind to any previous checkpoint
 */
export class CheckpointManager {
  private checkpointDir: string;
  private sessionId: string;
  private maxCheckpoints: number;
  private checkpoints: Map<string, Checkpoint> = new Map();
  private lastCheckpointId: string | null = null;

  constructor(maxCheckpoints: number = 100) {
    // Store checkpoints in ~/.config/fosscode/checkpoints/
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.checkpointDir = path.join(xdgConfigDir, 'fosscode', 'checkpoints');
    this.maxCheckpoints = maxCheckpoints;
    this.sessionId = this.generateSessionId();
    this.ensureCheckpointDir();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `session-${timestamp}-${random}`;
  }

  /**
   * Generate a unique checkpoint ID
   */
  private generateCheckpointId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `cp-${timestamp}-${random}`;
  }

  /**
   * Ensure the checkpoint directory exists
   */
  private ensureCheckpointDir(): void {
    try {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create checkpoint directory:', error);
    }
  }

  /**
   * Get the checkpoint file path for a given checkpoint ID
   */
  private getCheckpointPath(checkpointId: string): string {
    return path.join(this.checkpointDir, `${checkpointId}.json`);
  }

  /**
   * Get the content file path for storing large content
   */
  private getContentPath(checkpointId: string, type: 'original' | 'new'): string {
    return path.join(this.checkpointDir, `${checkpointId}.${type}.content`);
  }

  /**
   * Create a checkpoint before modifying a file
   * @param filePath Path to the file being modified
   * @param operation Type of operation being performed
   * @param description Optional description of the change
   * @returns Checkpoint ID
   */
  async createCheckpoint(
    filePath: string,
    operation: 'write' | 'edit' | 'multiedit' | 'patch',
    description?: string
  ): Promise<string> {
    const checkpointId = this.generateCheckpointId();
    const absolutePath = path.resolve(filePath);

    // Read original content if file exists
    let originalContent = '';
    try {
      originalContent = await fs.promises.readFile(absolutePath, 'utf-8');
    } catch {
      // File doesn't exist yet (new file)
      originalContent = '';
    }

    const checkpoint: Checkpoint = {
      id: checkpointId,
      timestamp: new Date(),
      filePath: absolutePath,
      originalContent,
      operation,
      sessionId: this.sessionId,
    };
    if (description !== undefined) {
      checkpoint.description = description;
    }

    // Store checkpoint in memory
    this.checkpoints.set(checkpointId, checkpoint);
    this.lastCheckpointId = checkpointId;

    // Persist checkpoint to disk
    await this.saveCheckpoint(checkpoint);

    // Cleanup old checkpoints if needed
    await this.cleanupOldCheckpoints();

    return checkpointId;
  }

  /**
   * Update a checkpoint with the new content after modification
   * @param checkpointId ID of the checkpoint to update
   * @param newContent The new content after modification
   */
  async updateCheckpointWithNewContent(checkpointId: string, newContent: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      // Try loading from disk
      const loaded = await this.loadCheckpoint(checkpointId);
      if (loaded) {
        loaded.newContent = newContent;
        loaded.diff = this.generateUnifiedDiff(
          loaded.originalContent,
          newContent,
          loaded.filePath
        );
        this.checkpoints.set(checkpointId, loaded);
        await this.saveCheckpoint(loaded);
      }
      return;
    }

    checkpoint.newContent = newContent;
    checkpoint.diff = this.generateUnifiedDiff(
      checkpoint.originalContent,
      newContent,
      checkpoint.filePath
    );
    await this.saveCheckpoint(checkpoint);
  }

  /**
   * Save a checkpoint to disk
   */
  private async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    try {
      // Save content separately for large files
      const originalContentPath = this.getContentPath(checkpoint.id, 'original');
      const newContentPath = this.getContentPath(checkpoint.id, 'new');

      await fs.promises.writeFile(originalContentPath, checkpoint.originalContent, 'utf-8');

      if (checkpoint.newContent) {
        await fs.promises.writeFile(newContentPath, checkpoint.newContent, 'utf-8');
      }

      // Save metadata (without content)
      const metadata = {
        id: checkpoint.id,
        timestamp: checkpoint.timestamp.toISOString(),
        filePath: checkpoint.filePath,
        operation: checkpoint.operation,
        description: checkpoint.description,
        sessionId: checkpoint.sessionId,
        diff: checkpoint.diff,
        hasNewContent: !!checkpoint.newContent,
      };

      const checkpointPath = this.getCheckpointPath(checkpoint.id);
      await fs.promises.writeFile(checkpointPath, JSON.stringify(metadata, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
    }
  }

  /**
   * Load a checkpoint from disk
   */
  private async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const checkpointPath = this.getCheckpointPath(checkpointId);
      const metadataJson = await fs.promises.readFile(checkpointPath, 'utf-8');
      const metadata = JSON.parse(metadataJson);

      // Load content
      const originalContentPath = this.getContentPath(checkpointId, 'original');
      const originalContent = await fs.promises.readFile(originalContentPath, 'utf-8');

      let newContent: string | undefined;
      if (metadata.hasNewContent) {
        const newContentPath = this.getContentPath(checkpointId, 'new');
        try {
          newContent = await fs.promises.readFile(newContentPath, 'utf-8');
        } catch {
          // New content might not exist
        }
      }

      return {
        id: metadata.id,
        timestamp: new Date(metadata.timestamp),
        filePath: metadata.filePath,
        originalContent,
        newContent,
        operation: metadata.operation,
        description: metadata.description,
        sessionId: metadata.sessionId,
        diff: metadata.diff,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the last checkpoint ID
   */
  getLastCheckpointId(): string | null {
    return this.lastCheckpointId;
  }

  /**
   * Quick undo - revert the last file change
   * @returns true if undo was successful
   */
  async quickUndo(): Promise<{ success: boolean; message: string; filePath?: string }> {
    if (!this.lastCheckpointId) {
      return { success: false, message: 'No checkpoint available for undo' };
    }

    const checkpoint = this.checkpoints.get(this.lastCheckpointId);
    if (!checkpoint) {
      const loaded = await this.loadCheckpoint(this.lastCheckpointId);
      if (!loaded) {
        return { success: false, message: 'Failed to load last checkpoint' };
      }
      return await this.revertToCheckpoint(loaded);
    }

    return await this.revertToCheckpoint(checkpoint);
  }

  /**
   * Revert a file to a specific checkpoint
   */
  async revertToCheckpoint(
    checkpoint: Checkpoint
  ): Promise<{ success: boolean; message: string; filePath?: string }> {
    try {
      // Create a backup checkpoint of current state before reverting
      await this.createCheckpoint(checkpoint.filePath, 'edit', 'Auto-backup before revert');

      // Restore original content
      await fs.promises.writeFile(checkpoint.filePath, checkpoint.originalContent, 'utf-8');

      return {
        success: true,
        message: `Reverted ${path.basename(checkpoint.filePath)} to checkpoint ${checkpoint.id}`,
        filePath: checkpoint.filePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to revert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Rewind to a specific checkpoint by ID
   */
  async rewindToCheckpoint(
    checkpointId: string
  ): Promise<{ success: boolean; message: string; filePath?: string }> {
    // First check in-memory cache
    let checkpoint: Checkpoint | null | undefined = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      // Try loading from disk
      checkpoint = await this.loadCheckpoint(checkpointId);
    }

    if (!checkpoint) {
      return { success: false, message: `Checkpoint ${checkpointId} not found` };
    }

    return await this.revertToCheckpoint(checkpoint);
  }

  /**
   * List all checkpoints with optional filters
   */
  async listCheckpoints(options?: {
    filePath?: string;
    sessionId?: string;
    operation?: string;
    limit?: number;
    offset?: number;
  }): Promise<CheckpointMetadata[]> {
    const checkpoints: CheckpointMetadata[] = [];

    try {
      const files = await fs.promises.readdir(this.checkpointDir);
      const metadataFiles = files.filter(f => f.endsWith('.json'));

      for (const file of metadataFiles) {
        try {
          const filePath = path.join(this.checkpointDir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const metadata = JSON.parse(content);

          // Apply filters
          if (options?.filePath && metadata.filePath !== options.filePath) continue;
          if (options?.sessionId && metadata.sessionId !== options.sessionId) continue;
          if (options?.operation && metadata.operation !== options.operation) continue;

          checkpoints.push({
            id: metadata.id,
            timestamp: new Date(metadata.timestamp),
            filePath: metadata.filePath,
            operation: metadata.operation,
            description: metadata.description,
            sessionId: metadata.sessionId,
            hasNewContent: metadata.hasNewContent,
          });
        } catch {
          // Skip invalid files
          continue;
        }
      }
    } catch {
      // Directory might not exist
    }

    // Sort by timestamp (newest first)
    checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    return checkpoints.slice(offset, offset + limit);
  }

  /**
   * Get checkpoint diff information
   */
  async getCheckpointDiff(checkpointId: string): Promise<CheckpointDiff | null> {
    let checkpoint: Checkpoint | null | undefined = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      checkpoint = await this.loadCheckpoint(checkpointId);
    }

    if (!checkpoint || !checkpoint.newContent) {
      return null;
    }

    const diff = this.generateDetailedDiff(
      checkpoint.originalContent,
      checkpoint.newContent,
      checkpoint.filePath
    );

    return diff;
  }

  /**
   * Get the diff between two checkpoints
   */
  async getDiffBetweenCheckpoints(
    checkpointId1: string,
    checkpointId2: string
  ): Promise<CheckpointDiff | null> {
    let checkpoint1: Checkpoint | null | undefined = this.checkpoints.get(checkpointId1);
    let checkpoint2: Checkpoint | null | undefined = this.checkpoints.get(checkpointId2);

    if (!checkpoint1) {
      checkpoint1 = await this.loadCheckpoint(checkpointId1);
    }
    if (!checkpoint2) {
      checkpoint2 = await this.loadCheckpoint(checkpointId2);
    }

    if (!checkpoint1 || !checkpoint2) {
      return null;
    }

    if (checkpoint1.filePath !== checkpoint2.filePath) {
      return null; // Can only diff checkpoints of the same file
    }

    return this.generateDetailedDiff(
      checkpoint1.originalContent,
      checkpoint2.originalContent,
      checkpoint1.filePath
    );
  }

  /**
   * Generate a unified diff between two contents
   */
  private generateUnifiedDiff(
    originalContent: string,
    newContent: string,
    filePath: string
  ): string {
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');

    const diff: string[] = [];
    diff.push(`--- a/${path.basename(filePath)}`);
    diff.push(`+++ b/${path.basename(filePath)}`);

    // Simple diff generation (similar to unified diff format)
    let i = 0;
    let j = 0;
    let currentHunk: string[] = [];
    let hunkStartOld = 0;
    let hunkStartNew = 0;
    let hunkLinesOld = 0;
    let hunkLinesNew = 0;

    const flushHunk = () => {
      if (currentHunk.length > 0) {
        diff.push(`@@ -${hunkStartOld + 1},${hunkLinesOld} +${hunkStartNew + 1},${hunkLinesNew} @@`);
        diff.push(...currentHunk);
        currentHunk = [];
        hunkLinesOld = 0;
        hunkLinesNew = 0;
      }
    };

    while (i < originalLines.length || j < newLines.length) {
      if (i >= originalLines.length) {
        // Only new lines left
        if (currentHunk.length === 0) {
          hunkStartOld = i;
          hunkStartNew = j;
        }
        currentHunk.push(`+${newLines[j]}`);
        hunkLinesNew++;
        j++;
      } else if (j >= newLines.length) {
        // Only old lines left
        if (currentHunk.length === 0) {
          hunkStartOld = i;
          hunkStartNew = j;
        }
        currentHunk.push(`-${originalLines[i]}`);
        hunkLinesOld++;
        i++;
      } else if (originalLines[i] === newLines[j]) {
        // Lines match
        if (currentHunk.length > 0 && currentHunk.length < 6) {
          currentHunk.push(` ${originalLines[i]}`);
          hunkLinesOld++;
          hunkLinesNew++;
        } else if (currentHunk.length >= 6) {
          flushHunk();
        }
        i++;
        j++;
      } else {
        // Lines differ
        if (currentHunk.length === 0) {
          hunkStartOld = i;
          hunkStartNew = j;
        }
        currentHunk.push(`-${originalLines[i]}`);
        hunkLinesOld++;
        i++;
        // Check if next line matches
        if (j < newLines.length && (i >= originalLines.length || originalLines[i] !== newLines[j])) {
          currentHunk.push(`+${newLines[j]}`);
          hunkLinesNew++;
          j++;
        }
      }
    }

    flushHunk();

    return diff.join('\n');
  }

  /**
   * Generate detailed diff with statistics
   */
  private generateDetailedDiff(
    originalContent: string,
    newContent: string,
    filePath: string
  ): CheckpointDiff {
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');

    let linesAdded = 0;
    let linesRemoved = 0;
    let linesChanged = 0;

    // Count changes using a simple LCS-based approach
    const originalSet = new Set(originalLines);
    const newSet = new Set(newLines);

    for (const line of originalLines) {
      if (!newSet.has(line)) {
        linesRemoved++;
      }
    }

    for (const line of newLines) {
      if (!originalSet.has(line)) {
        linesAdded++;
      }
    }

    linesChanged = Math.min(linesAdded, linesRemoved);

    return {
      filePath,
      beforeContent: originalContent,
      afterContent: newContent,
      unifiedDiff: this.generateUnifiedDiff(originalContent, newContent, filePath),
      linesAdded,
      linesRemoved,
      linesChanged,
    };
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<CheckpointSession[]> {
    const sessions = new Map<string, CheckpointSession>();

    try {
      const checkpoints = await this.listCheckpoints({ limit: 1000 });

      for (const cp of checkpoints) {
        const existing = sessions.get(cp.sessionId);
        if (existing) {
          existing.checkpointCount++;
          if (!existing.lastCheckpointTime || cp.timestamp > existing.lastCheckpointTime) {
            existing.lastCheckpointTime = cp.timestamp;
          }
        } else {
          sessions.set(cp.sessionId, {
            id: cp.sessionId,
            startTime: cp.timestamp,
            checkpointCount: 1,
            lastCheckpointTime: cp.timestamp,
          });
        }
      }
    } catch {
      // Return empty list on error
    }

    return Array.from(sessions.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string {
    return this.sessionId;
  }

  /**
   * Cleanup old checkpoints to stay within the limit
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    try {
      const checkpoints = await this.listCheckpoints({ limit: this.maxCheckpoints * 2 });

      if (checkpoints.length > this.maxCheckpoints) {
        const toDelete = checkpoints.slice(this.maxCheckpoints);

        for (const cp of toDelete) {
          await this.deleteCheckpoint(cp.id);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Delete a checkpoint and its associated files
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const checkpointPath = this.getCheckpointPath(checkpointId);
      const originalContentPath = this.getContentPath(checkpointId, 'original');
      const newContentPath = this.getContentPath(checkpointId, 'new');

      // Remove from memory
      this.checkpoints.delete(checkpointId);

      // Remove from disk
      await fs.promises.unlink(checkpointPath).catch(() => {});
      await fs.promises.unlink(originalContentPath).catch(() => {});
      await fs.promises.unlink(newContentPath).catch(() => {});

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all checkpoints
   */
  async clearAllCheckpoints(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.checkpointDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(this.checkpointDir, file)).catch(() => {});
      }
      this.checkpoints.clear();
      this.lastCheckpointId = null;
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get checkpoint directory path
   */
  getCheckpointDir(): string {
    return this.checkpointDir;
  }
}

// Singleton instance for global access
let checkpointManagerInstance: CheckpointManager | null = null;

/**
 * Get the global CheckpointManager instance
 */
export function getCheckpointManager(): CheckpointManager {
  if (!checkpointManagerInstance) {
    checkpointManagerInstance = new CheckpointManager();
  }
  return checkpointManagerInstance;
}

/**
 * Reset the global CheckpointManager instance (mainly for testing)
 */
export function resetCheckpointManager(): void {
  checkpointManagerInstance = null;
}
