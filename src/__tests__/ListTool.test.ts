// Mock dependencies before importing
// @ts-nocheck - Jest mock typing issues in test file
jest.mock('fs');
jest.mock('path');
jest.mock('../tools/SecurityManager');

import { ListTool } from '../tools/ListTool';
import * as fs from 'fs';
import * as path from 'path';
import { securityManager } from '../tools/SecurityManager';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockSecurityManager = securityManager as jest.Mocked<typeof securityManager>;

describe('ListTool', () => {
  let listTool: ListTool;

  beforeEach(() => {
    jest.clearAllMocks();
    listTool = new ListTool();
  });

  describe('constructor', () => {
    it('should create a ListTool instance with correct properties', () => {
      expect(listTool.name).toBe('list');
      expect(listTool.description).toContain('List files and directories');
      expect(listTool.parameters).toHaveLength(4);
    });

    it('should have correct parameters', () => {
      const pathParam = listTool.parameters.find(p => p.name === 'path');
      const showHiddenParam = listTool.parameters.find(p => p.name === 'showHidden');
      const typeParam = listTool.parameters.find(p => p.name === 'type');
      const patternParam = listTool.parameters.find(p => p.name === 'pattern');

      expect(pathParam).toEqual({
        name: 'path',
        type: 'string',
        description: 'Absolute path to the directory to list (defaults to current directory)',
        required: false,
        defaultValue: process.cwd(),
      });

      expect(showHiddenParam).toEqual({
        name: 'showHidden',
        type: 'boolean',
        description: 'Include hidden files (starting with .)',
        required: false,
        defaultValue: false,
      });

      expect(typeParam).toEqual({
        name: 'type',
        type: 'string',
        description: 'Filter by type: "all", "files", "dirs" (defaults to "all")',
        required: false,
        defaultValue: 'all',
      });

      expect(patternParam).toEqual({
        name: 'pattern',
        type: 'string',
        description: 'Filter by name pattern (simple wildcard, e.g., "*.ts")',
        required: false,
      });
    });
  });

  describe('execute', () => {
    const mockStats = {
      isFile: jest.fn(),
      isDirectory: jest.fn(),
      size: 1024,
      mtime: new Date('2023-01-01T00:00:00.000Z'),
    };

    beforeEach(() => {
      mockSecurityManager.validateFileOperation.mockResolvedValue('/test/path');
      mockPath.relative.mockReturnValue('test/path');
      mockPath.join.mockImplementation((...args) => args.join('/'));
    });

    it('should list directory contents successfully', async () => {
      const params = {};
      const mockItems = ['file1.txt', 'file2.js', 'dir1'];

      (
        mockFs.promises.readdir as jest.MockedFunction<typeof fs.promises.readdir>
      ).mockResolvedValue(mockItems as any);
      (mockFs.promises.stat as jest.MockedFunction<typeof fs.promises.stat>).mockResolvedValue(
        mockStats as any
      );
      mockStats.isFile.mockReturnValue(true);
      mockStats.isDirectory.mockReturnValue(false);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        path: 'test/path',
        items: [
          {
            name: 'file1.txt',
            type: 'file',
            size: 1024,
            modified: '2023-01-01T00:00:00.000Z',
          },
          {
            name: 'file2.js',
            type: 'file',
            size: 1024,
            modified: '2023-01-01T00:00:00.000Z',
          },
          {
            name: 'dir1',
            type: 'file',
            size: 1024,
            modified: '2023-01-01T00:00:00.000Z',
          },
        ],
        totalCount: 3,
        filtered: {
          showHidden: false,
          type: 'all',
          pattern: undefined,
        },
      });
      expect(mockSecurityManager.validateFileOperation).toHaveBeenCalledWith(process.cwd(), 'read');
      expect(mockFs.promises.readdir).toHaveBeenCalledWith('/test/path');
    });

    it('should filter hidden files when showHidden is false', async () => {
      const params = { showHidden: false };
      const mockItems = ['.hidden', 'visible.txt'];

      mockFs.promises.readdir.mockResolvedValue(mockItems as any);
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockStats.isFile.mockReturnValue(true);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].name).toBe('visible.txt');
    });

    it('should include hidden files when showHidden is true', async () => {
      const params = { showHidden: true };
      const mockItems = ['.hidden', 'visible.txt'];

      mockFs.promises.readdir.mockResolvedValue(mockItems as any);
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockStats.isFile.mockReturnValue(true);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.items.map(item => item.name)).toEqual(['.hidden', 'visible.txt']);
    });

    it('should filter files only when type is files', async () => {
      const params = { type: 'files' };
      const mockItems = ['file1.txt', 'dir1'];

      mockFs.promises.readdir.mockResolvedValue(mockItems as any);

      // Mock stats for file
      const fileStats = {
        ...mockStats,
        isFile: jest.fn().mockReturnValue(true),
        isDirectory: jest.fn().mockReturnValue(false),
      };
      // Mock stats for directory
      const dirStats = {
        ...mockStats,
        isFile: jest.fn().mockReturnValue(false),
        isDirectory: jest.fn().mockReturnValue(true),
      };

      mockFs.promises.stat
        .mockResolvedValueOnce(fileStats as any)
        .mockResolvedValueOnce(dirStats as any);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].name).toBe('file1.txt');
    });

    it('should filter directories only when type is dirs', async () => {
      const params = { type: 'dirs' };
      const mockItems = ['file1.txt', 'dir1'];

      mockFs.promises.readdir.mockResolvedValue(mockItems as any);

      // Mock stats for file
      const fileStats = {
        ...mockStats,
        isFile: jest.fn().mockReturnValue(true),
        isDirectory: jest.fn().mockReturnValue(false),
      };
      // Mock stats for directory
      const dirStats = {
        ...mockStats,
        isFile: jest.fn().mockReturnValue(false),
        isDirectory: jest.fn().mockReturnValue(true),
      };

      mockFs.promises.stat
        .mockResolvedValueOnce(fileStats as any)
        .mockResolvedValueOnce(dirStats as any);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].name).toBe('dir1');
    });

    it('should filter by pattern', async () => {
      const params = { pattern: '*.txt' };
      const mockItems = ['file1.txt', 'file2.js', 'file3.txt'];

      mockFs.promises.readdir.mockResolvedValue(mockItems as any);
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockStats.isFile.mockReturnValue(true);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.items.map(item => item.name)).toEqual(['file1.txt', 'file3.txt']);
    });

    it('should handle custom path', async () => {
      const params = { path: '/custom/path' };
      const mockItems = ['file1.txt'];

      mockSecurityManager.validateFileOperation.mockResolvedValue('/custom/path');
      mockFs.promises.readdir.mockResolvedValue(mockItems as any);
      mockFs.promises.stat.mockResolvedValue(mockStats as any);
      mockStats.isFile.mockReturnValue(true);

      const result = await listTool.execute(params);

      expect(result.success).toBe(true);
      expect(mockSecurityManager.validateFileOperation).toHaveBeenCalledWith(
        '/custom/path',
        'read'
      );
    });

    it('should handle security validation error', async () => {
      const params = {};
      const errorMessage = 'Access denied';

      mockSecurityManager.validateFileOperation.mockRejectedValue(new Error(errorMessage));

      const result = await listTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    it('should handle readdir error', async () => {
      const params = {};
      const errorMessage = 'Directory not found';

      mockSecurityManager.validateFileOperation.mockResolvedValue('/test/path');
      mockFs.promises.readdir.mockRejectedValue(new Error(errorMessage));

      const result = await listTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    it('should handle stat error', async () => {
      const params = {};
      const mockItems = ['file1.txt'];
      const errorMessage = 'Permission denied';

      mockSecurityManager.validateFileOperation.mockResolvedValue('/test/path');
      mockFs.promises.readdir.mockResolvedValue(mockItems as any);
      mockFs.promises.stat.mockRejectedValue(new Error(errorMessage));

      const result = await listTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    it('should handle unknown error', async () => {
      const params = {};

      mockSecurityManager.validateFileOperation.mockRejectedValue('String error');

      const result = await listTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred while listing directory');
    });
  });
});
