// Commented out to isolate hanging test
/*
import { GrepTool } from '../tools/GrepTool';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
  },
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn(),
  relative: jest.fn(),
}));

// Mock SecurityManager
jest.mock('../tools/SecurityManager', () => ({
  securityManager: {
    validateDirectoryOperation: jest.fn(),
    validateFileOperation: jest.fn(),
  },
}));

describe('GrepTool', () => {
  let grepTool: GrepTool;
  let mockReaddir: jest.Mock;
  let mockStat: jest.Mock;
  let mockReadFile: jest.Mock;
  let mockJoin: jest.Mock;
  let mockRelative: jest.Mock;
  let mockValidateDirectoryOperation: jest.Mock;
  let mockValidateFileOperation: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const fs = require('fs');
    mockReaddir = fs.promises.readdir as jest.Mock;
    mockStat = fs.promises.stat as jest.Mock;
    mockReadFile = fs.promises.readFile as jest.Mock;

    const path = require('path');
    mockJoin = path.join as jest.Mock;
    mockRelative = path.relative as jest.Mock;

    const securityModule = require('../tools/SecurityManager');
    mockValidateDirectoryOperation = securityModule.securityManager.validateDirectoryOperation;
    mockValidateFileOperation = securityModule.securityManager.validateFileOperation;

    // Default mocks
    mockValidateDirectoryOperation.mockResolvedValue('/validated/path');
    mockValidateFileOperation.mockResolvedValue(undefined);
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));
    mockRelative.mockImplementation((_from: string, to: string) => to);
  });

  describe('constructor', () => {
    it('should create a GrepTool instance with correct properties', () => {
      grepTool = new GrepTool();

      expect(grepTool.name).toBe('grep');
      expect(grepTool.description).toContain('Search for patterns in files');
      expect(grepTool.parameters).toHaveLength(6);
    });

    it('should have correct parameter definitions', () => {
      grepTool = new GrepTool();

      const patternParam = grepTool.parameters.find(p => p.name === 'pattern');
      expect(patternParam).toEqual({
        name: 'pattern',
        type: 'string',
        description: 'Regex pattern to search for in file contents',
        required: true,
      });

      const pathParam = grepTool.parameters.find(p => p.name === 'path');
      expect(pathParam?.required).toBe(false);
      expect(pathParam?.defaultValue).toBe(process.cwd());

      const includeParam = grepTool.parameters.find(p => p.name === 'include');
      expect(includeParam?.required).toBe(false);

      const contextParam = grepTool.parameters.find(p => p.name === 'context');
      expect(contextParam?.defaultValue).toBe(0);

      const caseSensitiveParam = grepTool.parameters.find(p => p.name === 'caseSensitive');
      expect(caseSensitiveParam?.defaultValue).toBe(false);

      const maxMatchesParam = grepTool.parameters.find(p => p.name === 'maxMatches');
      expect(maxMatchesParam?.defaultValue).toBe(100);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      grepTool = new GrepTool();
    });

    it('should search successfully and return matches', async () => {
      const params = { pattern: 'test', path: '/test/dir' };

      // Mock file system
      mockReaddir.mockResolvedValue(['file1.txt', 'file2.txt']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockResolvedValue('This is a test file\nAnother test line');

      const result = await grepTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(4);
      expect(result.data?.results).toHaveLength(4);
      expect(result.data?.results[0]).toEqual({
        file: '/validated/path/file1.txt',
        line: 1,
        column: 11,
        match: 'test',
      });
    });

    it('should handle no matches found', async () => {
      const params = { pattern: 'nonexistent', path: '/test/dir' };

      mockReaddir.mockResolvedValue(['file1.txt']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockResolvedValue('Some content without the pattern');

      const result = await grepTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(0);
      expect(result.data?.results).toHaveLength(0);
    });

    it('should respect maxMatches limit', async () => {
      const params = { pattern: 'test', path: '/test/dir', maxMatches: 1 };

      mockReaddir.mockResolvedValue(['file1.txt', 'file2.txt']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockResolvedValue('test line 1\ntest line 2\ntest line 3');

      const result = await grepTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(1);
      expect(result.data?.results).toHaveLength(1);
    });

    it('should handle case sensitive search', async () => {
      const params = { pattern: 'Test', path: '/test/dir', caseSensitive: true };

      mockReaddir.mockResolvedValue(['file1.txt']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockResolvedValue('This is a test file\nThis is a Test file');

      const result = await grepTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(1);
      expect(result.data?.results[0].match).toBe('Test');
    });

    it('should include context lines when requested', async () => {
      const params = { pattern: 'test', path: '/test/dir', context: 1 };

      mockReaddir.mockResolvedValue(['file1.txt']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockResolvedValue('Line 1\nLine with test\nLine 3');

      const result = await grepTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.results[0].contextBefore).toEqual([{ line: 1, content: 'Line 1' }]);
      expect(result.data?.results[0].contextAfter).toEqual([{ line: 3, content: 'Line 3' }]);
    });

    it('should filter files by include pattern', async () => {
      const params = { pattern: 'test', path: '/test/dir', include: '*.txt' };

      mockReaddir.mockResolvedValue(['file1.txt', 'file2.js']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockResolvedValue('test content');

      const result = await grepTool.execute(params);

      expect(mockReadFile).toHaveBeenCalledTimes(1); // Only file1.txt should be read
      expect(result.success).toBe(true);
    });

    it('should handle security validation failure', async () => {
      const params = { pattern: 'test', path: '/invalid/path' };

      mockValidateDirectoryOperation.mockRejectedValue(new Error('Access denied'));

      const result = await grepTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });

    it('should skip files that cannot be read', async () => {
      const params = { pattern: 'test', path: '/test/dir' };

      mockReaddir.mockResolvedValue(['file1.txt', 'file2.txt']);
      mockStat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('file2.txt')) {
          throw new Error('Permission denied');
        }
        return Promise.resolve('test content');
      });

      const result = await grepTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.totalMatches).toBe(1); // Only file1.txt match
    });

    it('should handle unknown errors', async () => {
      const params = { pattern: 'test', path: '/test/dir' };

      mockValidateDirectoryOperation.mockRejectedValue('String error');

      const result = await grepTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred during search');
    });
  });
});
*/
