import { PatchTool } from '../tools/PatchTool.js';
import * as fs from 'fs';
import { jest } from '@jest/globals';

// Mock SecurityManager to avoid path validation issues in tests
jest.mock('../tools/SecurityManager.js', () => ({
  securityManager: {
    validateDirectoryOperation: jest.fn().mockImplementation(path => Promise.resolve(path)),
  },
}));

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
  },
  existsSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  resolve: jest.fn((...args) => args.join('/')),
  basename: jest.fn(),
  join: jest.fn((...args) => args.join('/')),
  relative: jest.fn(),
  normalize: jest.fn(p => p),
}));

describe('PatchTool', () => {
  let patchTool: PatchTool;
  let mockReadFile: jest.MockedFunction<typeof fs.promises.readFile>;
  let mockWriteFile: jest.MockedFunction<typeof fs.promises.writeFile>;
  let mockCopyFile: jest.MockedFunction<typeof fs.promises.copyFile>;
  let mockExistsSync: jest.MockedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    patchTool = new PatchTool();
    mockReadFile = fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>;
    mockWriteFile = fs.promises.writeFile as jest.MockedFunction<typeof fs.promises.writeFile>;
    mockCopyFile = fs.promises.copyFile as jest.MockedFunction<typeof fs.promises.copyFile>;
    mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    jest.clearAllMocks();

    // Default mocks
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('line 1\nline 2\nline 3\nline 4\nline 5\n');
    mockWriteFile.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
  });

  describe('basic functionality', () => {
    it('should have correct name and description', () => {
      expect(patchTool.name).toBe('patch');
      expect(patchTool.description).toContain('diff patches');
    });

    it('should have required parameters', () => {
      expect(patchTool.parameters).toHaveLength(6);
      const patchParam = patchTool.parameters.find(p => p.name === 'patch');
      expect(patchParam?.required).toBe(true);
      expect(patchParam?.type).toBe('string');
    });
  });

  describe('execute method validation', () => {
    it('should return error for missing patch', async () => {
      const result = await patchTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Patch parameter is required');
    });

    it('should return error for empty patch', async () => {
      const result = await patchTool.execute({ patch: '' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Patch parameter is required');
    });

    it('should return error for invalid patch type', async () => {
      const result = await patchTool.execute({ patch: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Patch parameter is required');
    });
  });

  describe('patch parsing', () => {
    it('should parse simple unified diff', () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3
`;

      const tool = patchTool as any;
      const result = tool.parseUnifiedDiff(patch, 0);

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('a/test.txt');
      expect(result[0].hunks).toHaveLength(1);
      expect(result[0].hunks[0].lines).toContain('+new line');
    });

    it('should handle multiple files', () => {
      const patch = `--- a/file1.txt
+++ b/file1.txt
@@ -1,2 +1,2 @@
-old line
+new line
--- a/file2.txt
+++ b/file2.txt
@@ -1,2 +1,2 @@
-old line 2
+new line 2
`;

      const tool = patchTool as any;
      const result = tool.parseUnifiedDiff(patch, 0);

      expect(result).toHaveLength(2);
      expect(result[0].filename).toBe('a/file1.txt');
      expect(result[1].filename).toBe('a/file2.txt');
    });

    it('should strip path components', () => {
      const patch = `--- a/src/test/file.txt
+++ b/src/test/file.txt
@@ -1,2 +1,2 @@
 old
+new
`;

      const tool = patchTool as any;
      const result = tool.parseUnifiedDiff(patch, 2);

      expect(result[0].filename).toBe('test/file.txt');
    });
  });

  describe('patch validation', () => {
    it('should validate simple patch successfully', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.validated).toBe(true);
      expect(result.data?.applied).toBe(false);
    });

    it('should fail validation for non-existent file', async () => {
      mockExistsSync.mockReturnValue(false);

      const patch = `--- a/missing.txt
+++ b/missing.txt
@@ -1,2 +1,2 @@
 old
+new
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should fail validation for context mismatch', async () => {
      mockReadFile.mockResolvedValue('different content\nline 2\nline 3\n');

      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,3 @@
 line 1
 line 2
+new line
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });

  describe('patch application', () => {
    it('should apply simple patch successfully', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3
`;

      const result = await patchTool.execute({ patch });

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(true);
      expect(result.data?.files).toContain('a/test.txt');
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should create backup files when requested', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
 old
+new
`;

      const result = await patchTool.execute({
        patch,
        createBackup: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.backups).toHaveLength(1);
      expect(mockCopyFile).toHaveBeenCalled();
    });

    it('should skip backup creation when disabled', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
 old
+new
`;

      const result = await patchTool.execute({
        patch,
        createBackup: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.backups).toHaveLength(0);
      expect(mockCopyFile).not.toHaveBeenCalled();
    });
  });

  describe('reverse patching', () => {
    it('should reverse patch successfully', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3
`;

      // First apply the patch
      mockReadFile.mockResolvedValue('line 1\nline 2\nnew line\nline 3\nline 4\nline 5\n');

      const result = await patchTool.execute({
        patch,
        reverse: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.reversed).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle invalid patch format', async () => {
      const invalidPatch = 'this is not a valid patch';

      const result = await patchTool.execute({ patch: invalidPatch });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid hunks found');
    });

    it('should handle file system errors during validation', async () => {
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
 old
+new
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should handle file system errors during application', async () => {
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,2 @@
 old
+new
`;

      const result = await patchTool.execute({ patch });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Write failed');
    });
  });

  describe('complex patches', () => {
    it('should handle patches with multiple hunks', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,2 +1,3 @@
 line 1
+added line 1
 line 2
@@ -4,2 +5,3 @@
 line 4
+added line 2
 line 5
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.hunks).toBe(2);
    });

    it('should handle patches with only additions', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,1 +1,3 @@
 line 1
+new line 1
+new line 2
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(true);
    });

    it('should handle patches with only removals', async () => {
      const patch = `--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,1 @@
 line 1
-line 2
-line 3
`;

      const result = await patchTool.execute({
        patch,
        validateOnly: true,
      });

      expect(result.success).toBe(true);
    });
  });
});
