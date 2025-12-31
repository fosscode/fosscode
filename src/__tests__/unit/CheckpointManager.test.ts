import * as fs from 'fs';
import * as path from 'path';
import {
  CheckpointManager,
  getCheckpointManager,
  resetCheckpointManager,
} from '../../utils/CheckpointManager.js';

describe('CheckpointManager', () => {
  let checkpointManager: CheckpointManager;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Reset the singleton
    resetCheckpointManager();

    // Create a unique test directory for each test in current working directory to avoid security issues
    testDir = path.join(process.cwd(), `.test-checkpoint-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(testDir, { recursive: true });

    // Create a test file
    testFile = path.join(testDir, 'test-file.txt');
    await fs.promises.writeFile(testFile, 'Original content');

    // Create a CheckpointManager with a custom checkpoint directory
    checkpointManager = new CheckpointManager(50);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clean up checkpoint directory
    try {
      const checkpointDir = checkpointManager.getCheckpointDir();
      const files = await fs.promises.readdir(checkpointDir);
      for (const file of files) {
        if (file.startsWith('cp-') || file.startsWith('session-')) {
          await fs.promises.unlink(path.join(checkpointDir, file)).catch(() => {});
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Checkpoint Creation', () => {
    it('should create a checkpoint for an existing file', async () => {
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit', 'Test edit');

      expect(checkpointId).toBeDefined();
      expect(checkpointId).toMatch(/^cp-/);
    });

    it('should create a checkpoint for a new file', async () => {
      const newFile = path.join(testDir, 'new-file.txt');
      const checkpointId = await checkpointManager.createCheckpoint(newFile, 'write', 'Create file');

      expect(checkpointId).toBeDefined();
    });

    it('should store the original content in the checkpoint', async () => {
      const originalContent = 'Original content';
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit');

      // Update with new content
      await checkpointManager.updateCheckpointWithNewContent(checkpointId, 'New content');

      // Get the diff to verify original content was stored
      const diff = await checkpointManager.getCheckpointDiff(checkpointId);
      expect(diff).not.toBeNull();
      expect(diff?.beforeContent).toBe(originalContent);
    });

    it('should update checkpoint with new content', async () => {
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit');
      const newContent = 'Updated content';

      await checkpointManager.updateCheckpointWithNewContent(checkpointId, newContent);

      const diff = await checkpointManager.getCheckpointDiff(checkpointId);
      expect(diff?.afterContent).toBe(newContent);
    });
  });

  describe('Quick Undo', () => {
    it('should undo the last change', async () => {
      const originalContent = 'Original content';

      // Create checkpoint
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit');

      // Modify the file
      const newContent = 'Modified content';
      await fs.promises.writeFile(testFile, newContent);
      await checkpointManager.updateCheckpointWithNewContent(checkpointId, newContent);

      // Verify file was modified
      const modifiedContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(modifiedContent).toBe(newContent);

      // Quick undo
      const result = await checkpointManager.quickUndo();
      expect(result.success).toBe(true);

      // Verify file was restored
      const restoredContent = await fs.promises.readFile(testFile, 'utf-8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should return error when no checkpoint available', async () => {
      const result = await checkpointManager.quickUndo();
      expect(result.success).toBe(false);
      expect(result.message).toContain('No checkpoint');
    });
  });

  describe('Rewind to Checkpoint', () => {
    it('should rewind to a specific checkpoint', async () => {
      const originalContent = 'Original content';

      // Create first checkpoint
      const checkpointId1 = await checkpointManager.createCheckpoint(testFile, 'edit');
      await fs.promises.writeFile(testFile, 'First modification');
      await checkpointManager.updateCheckpointWithNewContent(checkpointId1, 'First modification');

      // Create second checkpoint
      await checkpointManager.createCheckpoint(testFile, 'edit');
      await fs.promises.writeFile(testFile, 'Second modification');

      // Rewind to first checkpoint
      const result = await checkpointManager.rewindToCheckpoint(checkpointId1);
      expect(result.success).toBe(true);

      // Verify content was reverted
      const content = await fs.promises.readFile(testFile, 'utf-8');
      expect(content).toBe(originalContent);
    });

    it('should return error for non-existent checkpoint', async () => {
      const result = await checkpointManager.rewindToCheckpoint('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('Checkpoint Listing', () => {
    it('should list checkpoints', async () => {
      // Create multiple checkpoints
      await checkpointManager.createCheckpoint(testFile, 'edit', 'First');
      await checkpointManager.createCheckpoint(testFile, 'edit', 'Second');
      await checkpointManager.createCheckpoint(testFile, 'write', 'Third');

      const checkpoints = await checkpointManager.listCheckpoints();

      expect(checkpoints.length).toBe(3);
    });

    it('should filter checkpoints by file path', async () => {
      const file2 = path.join(testDir, 'file2.txt');
      await fs.promises.writeFile(file2, 'Content');

      await checkpointManager.createCheckpoint(testFile, 'edit');
      await checkpointManager.createCheckpoint(file2, 'edit');
      await checkpointManager.createCheckpoint(testFile, 'edit');

      const checkpoints = await checkpointManager.listCheckpoints({ filePath: testFile });

      expect(checkpoints.length).toBe(2);
      checkpoints.forEach(cp => {
        expect(cp.filePath).toBe(testFile);
      });
    });

    it('should filter checkpoints by operation', async () => {
      await checkpointManager.createCheckpoint(testFile, 'edit');
      await checkpointManager.createCheckpoint(testFile, 'write');
      await checkpointManager.createCheckpoint(testFile, 'edit');

      // Wait for file system sync
      await new Promise(resolve => setTimeout(resolve, 100));

      const checkpoints = await checkpointManager.listCheckpoints({ operation: 'edit' });

      expect(checkpoints.length).toBe(2);
      checkpoints.forEach(cp => {
        expect(cp.operation).toBe('edit');
      });
    });

    it('should sort checkpoints by timestamp (newest first)', async () => {
      await checkpointManager.createCheckpoint(testFile, 'edit', 'First');
      await new Promise(resolve => setTimeout(resolve, 100));
      await checkpointManager.createCheckpoint(testFile, 'edit', 'Second');
      await new Promise(resolve => setTimeout(resolve, 100));
      await checkpointManager.createCheckpoint(testFile, 'edit', 'Third');

      // Wait for file system sync
      await new Promise(resolve => setTimeout(resolve, 100));

      const checkpoints = await checkpointManager.listCheckpoints();

      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
      // Newest (Third) should come first
      expect(checkpoints[0].description).toBe('Third');
      // Oldest (First) should come last among our 3
      const first = checkpoints.find(cp => cp.description === 'First');
      expect(first).toBeDefined();
    });

    it('should limit the number of checkpoints returned', async () => {
      for (let i = 0; i < 10; i++) {
        await checkpointManager.createCheckpoint(testFile, 'edit', `Checkpoint ${i}`);
      }

      const checkpoints = await checkpointManager.listCheckpoints({ limit: 5 });

      expect(checkpoints.length).toBe(5);
    });
  });

  describe('Diff Generation', () => {
    it('should generate diff for a checkpoint', async () => {
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit');

      const newContent = 'Modified\ncontent\nwith\nmultiple\nlines';
      await fs.promises.writeFile(testFile, newContent);
      await checkpointManager.updateCheckpointWithNewContent(checkpointId, newContent);

      const diff = await checkpointManager.getCheckpointDiff(checkpointId);

      expect(diff).not.toBeNull();
      expect(diff?.unifiedDiff).toContain('-Original content');
      expect(diff?.unifiedDiff).toContain('+Modified');
      expect(diff?.linesAdded).toBeGreaterThan(0);
      expect(diff?.linesRemoved).toBeGreaterThan(0);
    });

    it('should generate diff between two checkpoints', async () => {
      // Create first checkpoint
      const checkpointId1 = await checkpointManager.createCheckpoint(testFile, 'edit');
      await fs.promises.writeFile(testFile, 'Content after first edit');
      await checkpointManager.updateCheckpointWithNewContent(checkpointId1, 'Content after first edit');

      // Create second checkpoint
      const checkpointId2 = await checkpointManager.createCheckpoint(testFile, 'edit');
      await fs.promises.writeFile(testFile, 'Content after second edit');
      await checkpointManager.updateCheckpointWithNewContent(checkpointId2, 'Content after second edit');

      const diff = await checkpointManager.getDiffBetweenCheckpoints(checkpointId1, checkpointId2);

      expect(diff).not.toBeNull();
      expect(diff?.filePath).toBe(testFile);
    });

    it('should return null for non-existent checkpoint diff', async () => {
      const diff = await checkpointManager.getCheckpointDiff('non-existent');
      expect(diff).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should have a unique session ID', () => {
      const sessionId = checkpointManager.getCurrentSessionId();
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-/);
    });

    it('should list sessions', async () => {
      await checkpointManager.createCheckpoint(testFile, 'edit');
      await checkpointManager.createCheckpoint(testFile, 'edit');

      const sessions = await checkpointManager.listSessions();

      expect(sessions.length).toBeGreaterThanOrEqual(1);
      const currentSession = sessions.find(s => s.id === checkpointManager.getCurrentSessionId());
      expect(currentSession).toBeDefined();
      expect(currentSession?.checkpointCount).toBe(2);
    });
  });

  describe('Checkpoint Cleanup', () => {
    it('should delete a specific checkpoint', async () => {
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit');

      const checkpointsBefore = await checkpointManager.listCheckpoints();
      expect(checkpointsBefore.some(cp => cp.id === checkpointId)).toBe(true);

      const deleted = await checkpointManager.deleteCheckpoint(checkpointId);
      expect(deleted).toBe(true);

      const checkpointsAfter = await checkpointManager.listCheckpoints();
      expect(checkpointsAfter.some(cp => cp.id === checkpointId)).toBe(false);
    });

    it('should clear all checkpoints', async () => {
      await checkpointManager.createCheckpoint(testFile, 'edit');
      await checkpointManager.createCheckpoint(testFile, 'edit');
      await checkpointManager.createCheckpoint(testFile, 'edit');

      await checkpointManager.clearAllCheckpoints();

      const checkpoints = await checkpointManager.listCheckpoints();
      expect(checkpoints.length).toBe(0);
    });
  });

  describe('Persistence', () => {
    it('should persist checkpoints across instances', async () => {
      // Create checkpoint with first instance
      const checkpointId = await checkpointManager.createCheckpoint(testFile, 'edit', 'Persistent test');
      await checkpointManager.updateCheckpointWithNewContent(checkpointId, 'New content');

      // Create new instance
      const newManager = new CheckpointManager();

      // Checkpoint should be accessible
      const checkpoints = await newManager.listCheckpoints();
      const found = checkpoints.find(cp => cp.id === checkpointId);
      expect(found).toBeDefined();
      expect(found?.description).toBe('Persistent test');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance from getCheckpointManager', () => {
      const instance1 = getCheckpointManager();
      const instance2 = getCheckpointManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset the singleton with resetCheckpointManager', () => {
      const instance1 = getCheckpointManager();
      resetCheckpointManager();
      const instance2 = getCheckpointManager();
      expect(instance1).not.toBe(instance2);
    });
  });
});
