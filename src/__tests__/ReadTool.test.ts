import * as fs from 'fs';
import * as path from 'path';
import { ReadTool } from '../tools/ReadTool';

// Mock the security manager
jest.mock('../tools/SecurityManager', () => ({
  securityManager: {
    validateFileOperation: jest.fn(),
  },
}));

import { securityManager } from '../tools/SecurityManager';

describe('ReadTool', () => {
  let readTool: ReadTool;
  let testFilePath: string;
  let testContent: string;

  beforeEach(() => {
    readTool = new ReadTool();
    testFilePath = path.join(__dirname, 'test-file.txt');
    testContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'; // Remove trailing newline

    // Reset mocks
    jest.clearAllMocks();

    // Mock security validation to return the file path
    (securityManager.validateFileOperation as jest.Mock).mockResolvedValue(testFilePath);
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.promises.unlink(testFilePath);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  describe('constructor', () => {
    it('should create a ReadTool instance with correct properties', () => {
      expect(readTool.name).toBe('read');
      expect(readTool.description).toContain('Read file contents');
      expect(readTool.parameters).toHaveLength(5);
    });

    it('should have correct parameter definitions', () => {
      const params = readTool.parameters;
      expect(params[0]).toEqual({
        name: 'filePath',
        type: 'string',
        description: 'Absolute path to the file to read',
        required: true,
      });

      expect(params[1]).toEqual({
        name: 'offset',
        type: 'number',
        description: 'Starting line number (0-based, defaults to 0)',
        required: false,
        defaultValue: 0,
      });
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      // Create test file
      await fs.promises.writeFile(testFilePath, testContent, 'utf-8');
    });

    it('should read entire file successfully', async () => {
      const result = await readTool.execute({ filePath: testFilePath });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        filePath: expect.stringContaining('test-file.txt'),
        content: '     1|Line 1\n     2|Line 2\n     3|Line 3\n     4|Line 4\n     5|Line 5',
        totalLines: 5,
        readLines: 5,
        startLine: 1,
        endLine: 5,
        encoding: 'utf-8',
        truncated: false,
      });
      expect(result.metadata).toHaveProperty('fileSize');
      expect(result.metadata).toHaveProperty('lastModified');
      expect(result.metadata).toHaveProperty('readTime');
    });

    it('should read file with offset', async () => {
      const result = await readTool.execute({ filePath: testFilePath, offset: 2 });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('     3|Line 3\n     4|Line 4\n     5|Line 5');
      expect(result.data.startLine).toBe(3);
      expect(result.data.endLine).toBe(5);
      expect(result.data.readLines).toBe(3);
    });

    it('should read file with offset and limit', async () => {
      const result = await readTool.execute({ filePath: testFilePath, offset: 1, limit: 2 });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('     2|Line 2\n     3|Line 3');
      expect(result.data.startLine).toBe(2);
      expect(result.data.endLine).toBe(3);
      expect(result.data.readLines).toBe(2);
    });

    it('should read file without line numbers', async () => {
      const result = await readTool.execute({ filePath: testFilePath, withLineNumbers: false });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    });

    it('should handle different encoding', async () => {
      const result = await readTool.execute({ filePath: testFilePath, encoding: 'utf-8' });

      expect(result.success).toBe(true);
      expect(result.data.encoding).toBe('utf-8');
    });

    it('should handle empty file', async () => {
      const emptyFilePath = path.join(__dirname, 'empty.txt');
      await fs.promises.writeFile(emptyFilePath, '', 'utf-8');
      (securityManager.validateFileOperation as jest.Mock).mockResolvedValue(emptyFilePath);

      const result = await readTool.execute({ filePath: emptyFilePath });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('     1|');
      expect(result.data.totalLines).toBe(1); // Empty file has one empty line
      expect(result.data.readLines).toBe(1);

      // Clean up
      await fs.promises.unlink(emptyFilePath);
    });

    it('should handle file with single line', async () => {
      const singleLineFilePath = path.join(__dirname, 'single.txt');
      await fs.promises.writeFile(singleLineFilePath, 'Single line content', 'utf-8');
      (securityManager.validateFileOperation as jest.Mock).mockResolvedValue(singleLineFilePath);

      const result = await readTool.execute({ filePath: singleLineFilePath });

      expect(result.success).toBe(true);
      expect(result.data.content).toBe('     1|Single line content');
      expect(result.data.totalLines).toBe(1);
      expect(result.data.readLines).toBe(1);

      // Clean up
      await fs.promises.unlink(singleLineFilePath);
    });

    describe('error handling', () => {
      it('should handle file not found', async () => {
        const nonExistentPath = '/non/existent/file.txt';
        (securityManager.validateFileOperation as jest.Mock).mockResolvedValue(nonExistentPath);

        const result = await readTool.execute({ filePath: nonExistentPath });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error occurred while reading file');
      });

      it('should handle invalid offset', async () => {
        const result = await readTool.execute({ filePath: testFilePath, offset: 10 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid offset: 10');
      });

      it('should handle negative offset', async () => {
        const result = await readTool.execute({ filePath: testFilePath, offset: -1 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid offset: -1');
      });

      it('should handle security validation failure', async () => {
        (securityManager.validateFileOperation as jest.Mock).mockRejectedValue(
          new Error('Access denied')
        );

        const result = await readTool.execute({ filePath: testFilePath });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Access denied');
      });
    });

    describe('truncation', () => {
      it('should indicate truncation when limit is applied', async () => {
        const result = await readTool.execute({ filePath: testFilePath, offset: 0, limit: 3 });

        expect(result.success).toBe(true);
        expect(result.data.truncated).toBe(true);
        expect(result.data.endLine).toBe(3);
      });

      it('should not indicate truncation when reading all lines', async () => {
        const result = await readTool.execute({ filePath: testFilePath });

        expect(result.success).toBe(true);
        expect(result.data.truncated).toBe(false);
        expect(result.data.endLine).toBe(5);
      });
    });
  });
});
