import * as fs from 'fs';
import * as path from 'path';
import { RewindCommand, handleRewindCommand } from '../../commands/RewindCommand.js';
import { WriteTool } from '../../tools/WriteTool.js';
import { EditTool } from '../../tools/EditTool.js';
import { resetCheckpointManager, getCheckpointManager } from '../../utils/CheckpointManager.js';

describe('Rewind Integration Tests', () => {
  let testDir: string;
  let testFile: string;
  let rewindCommand: RewindCommand;

  beforeEach(async () => {
    // Reset the checkpoint manager for each test
    resetCheckpointManager();

    // Create a unique test directory in current working directory to avoid security manager issues
    testDir = path.join(process.cwd(), `.test-rewind-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(testDir, { recursive: true });

    // Create a test file
    testFile = path.join(testDir, 'test-file.txt');
    await fs.promises.writeFile(testFile, 'Initial content');

    // Create rewind command instance
    rewindCommand = new RewindCommand();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Clean up checkpoints
    try {
      const checkpointManager = getCheckpointManager();
      await checkpointManager.clearAllCheckpoints();
    } catch {
      // Ignore errors
    }
  });

  describe('WriteTool Integration', () => {
    it('should create checkpoint when writing a file', async () => {
      const writeTool = new WriteTool();

      // Write to file using WriteTool
      const result = await writeTool.execute({
        filePath: testFile,
        content: 'New content from WriteTool',
        createBackup: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.checkpointId).toBeDefined();

      // Verify checkpoint was created
      const checkpointManager = getCheckpointManager();
      const checkpoints = await checkpointManager.listCheckpoints({ filePath: testFile });
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should be able to undo a write operation', async () => {
      const writeTool = new WriteTool();
      const originalContent = 'Initial content';
      const newContent = 'New content from WriteTool';

      // Write to file
      await writeTool.execute({
        filePath: testFile,
        content: newContent,
        createBackup: false,
      });

      // Verify file was changed
      const afterWrite = await fs.promises.readFile(testFile, 'utf-8');
      expect(afterWrite).toBe(newContent);

      // Undo using rewind command
      const undoResult = await rewindCommand.execute(['undo']);
      expect(undoResult).toContain('successful');

      // Verify file was restored
      const afterUndo = await fs.promises.readFile(testFile, 'utf-8');
      expect(afterUndo).toBe(originalContent);
    });
  });

  describe('EditTool Integration', () => {
    it('should create checkpoint when editing a file', async () => {
      const editTool = new EditTool();

      // Edit file using EditTool
      const result = await editTool.execute({
        filePath: testFile,
        oldString: 'Initial',
        newString: 'Modified',
        createBackup: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.checkpointId).toBeDefined();

      // Verify checkpoint was created
      const checkpointManager = getCheckpointManager();
      const checkpoints = await checkpointManager.listCheckpoints({ filePath: testFile });
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it('should be able to undo an edit operation', async () => {
      const editTool = new EditTool();
      const originalContent = 'Initial content';

      // Edit file
      await editTool.execute({
        filePath: testFile,
        oldString: 'Initial',
        newString: 'Modified',
        createBackup: false,
      });

      // Verify file was changed
      const afterEdit = await fs.promises.readFile(testFile, 'utf-8');
      expect(afterEdit).toBe('Modified content');

      // Undo using rewind command
      const undoResult = await rewindCommand.execute(['undo']);
      expect(undoResult).toContain('successful');

      // Verify file was restored
      const afterUndo = await fs.promises.readFile(testFile, 'utf-8');
      expect(afterUndo).toBe(originalContent);
    });
  });

  describe('RewindCommand', () => {
    it('should list checkpoints', async () => {
      const writeTool = new WriteTool();

      // Create some checkpoints
      await writeTool.execute({
        filePath: testFile,
        content: 'Content 1',
        createBackup: false,
      });

      await writeTool.execute({
        filePath: testFile,
        content: 'Content 2',
        createBackup: false,
      });

      // List checkpoints
      const listResult = await rewindCommand.execute([]);

      expect(listResult).toContain('Checkpoints');
      expect(listResult).toContain('cp-');
    });

    it('should show diff for a checkpoint', async () => {
      const writeTool = new WriteTool();

      // Create checkpoint
      const result = await writeTool.execute({
        filePath: testFile,
        content: 'New content for diff',
        createBackup: false,
      });

      const checkpointId = result.data?.checkpointId;
      expect(checkpointId).toBeDefined();

      // Get diff
      const diffResult = await rewindCommand.execute(['diff', checkpointId!]);

      expect(diffResult).toContain('Diff');
      expect(diffResult).toContain('Lines');
    });

    it('should rewind to a specific checkpoint', async () => {
      const writeTool = new WriteTool();

      // Create first checkpoint
      const result1 = await writeTool.execute({
        filePath: testFile,
        content: 'Content 1',
        createBackup: false,
      });

      const checkpointId1 = result1.data?.checkpointId;

      // Create second checkpoint
      await writeTool.execute({
        filePath: testFile,
        content: 'Content 2',
        createBackup: false,
      });

      // Verify we're at Content 2
      const beforeRewind = await fs.promises.readFile(testFile, 'utf-8');
      expect(beforeRewind).toBe('Content 2');

      // Rewind to first checkpoint
      const rewindResult = await rewindCommand.execute([checkpointId1!]);
      expect(rewindResult).toContain('successful');

      // Verify we're back to original content (before first write)
      const afterRewind = await fs.promises.readFile(testFile, 'utf-8');
      expect(afterRewind).toBe('Initial content');
    });

    it('should clear all checkpoints', async () => {
      const writeTool = new WriteTool();

      // Create some checkpoints
      await writeTool.execute({
        filePath: testFile,
        content: 'Content 1',
        createBackup: false,
      });

      // Clear all checkpoints
      const clearResult = await rewindCommand.execute(['clear']);
      expect(clearResult).toContain('cleared');

      // Verify checkpoints are gone
      const checkpointManager = getCheckpointManager();
      const checkpoints = await checkpointManager.listCheckpoints();
      expect(checkpoints.length).toBe(0);
    });

    it('should list sessions', async () => {
      const writeTool = new WriteTool();

      // Create some checkpoints
      await writeTool.execute({
        filePath: testFile,
        content: 'Content 1',
        createBackup: false,
      });

      // List sessions
      const sessionsResult = await rewindCommand.execute(['sessions']);
      expect(sessionsResult).toContain('Sessions');
      expect(sessionsResult).toContain('session-');
    });

    it('should show help', async () => {
      const helpResult = await rewindCommand.execute(['help']);

      expect(helpResult).toContain('Usage');
      expect(helpResult).toContain('/rewind');
      expect(helpResult).toContain('undo');
      expect(helpResult).toContain('diff');
    });
  });

  describe('handleRewindCommand', () => {
    it('should parse and execute rewind commands', async () => {
      const helpResult = await handleRewindCommand('/rewind help');
      expect(helpResult).toContain('Usage');
    });

    it('should handle undo command', async () => {
      const undoResult = await handleRewindCommand('/rewind undo');
      // Since no checkpoints exist, should indicate no checkpoint
      expect(undoResult).toContain('No checkpoint');
    });
  });

  describe('Multiple File Checkpoints', () => {
    it('should handle checkpoints for multiple files', async () => {
      const writeTool = new WriteTool();
      const file2 = path.join(testDir, 'file2.txt');

      // Write to first file
      await writeTool.execute({
        filePath: testFile,
        content: 'File 1 content',
        createBackup: false,
      });

      // Write to second file
      await writeTool.execute({
        filePath: file2,
        content: 'File 2 content',
        createBackup: false,
      });

      // Verify both files have checkpoints
      const checkpointManager = getCheckpointManager();

      const file1Checkpoints = await checkpointManager.listCheckpoints({ filePath: testFile });
      const file2Checkpoints = await checkpointManager.listCheckpoints({ filePath: file2 });

      expect(file1Checkpoints.length).toBeGreaterThan(0);
      expect(file2Checkpoints.length).toBeGreaterThan(0);
    });
  });

  describe('Checkpoint Persistence', () => {
    it('should persist checkpoints across checkpoint manager instances', async () => {
      const writeTool = new WriteTool();

      // Create checkpoint
      const result = await writeTool.execute({
        filePath: testFile,
        content: 'Persistent content',
        createBackup: false,
      });

      const checkpointId = result.data?.checkpointId;

      // Reset and get new manager
      resetCheckpointManager();
      const newManager = getCheckpointManager();

      // Checkpoint should still be accessible
      const checkpoints = await newManager.listCheckpoints();
      const found = checkpoints.find(cp => cp.id === checkpointId);
      expect(found).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle rewind to non-existent checkpoint', async () => {
      const result = await rewindCommand.execute(['non-existent-id']);
      expect(result).toContain('not found');
    });

    it('should handle diff for non-existent checkpoint', async () => {
      const result = await rewindCommand.execute(['diff', 'non-existent-id']);
      expect(result).toContain('not found');
    });

    it('should handle undo when no checkpoints exist', async () => {
      const result = await rewindCommand.execute(['undo']);
      expect(result).toContain('No checkpoint');
    });
  });
});
