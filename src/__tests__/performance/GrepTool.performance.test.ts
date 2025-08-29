import { GrepTool } from '../../tools/GrepTool.js';
import { performanceFramework } from './PerformanceTestFramework.js';
import * as fs from 'fs';
import * as path from 'path';

describe('GrepTool Performance Tests', () => {
  let grepTool: GrepTool;
  let testDir: string;

  beforeEach(() => {
    grepTool = new GrepTool();

    // Create a temporary directory with test files
    testDir = path.join(process.cwd(), 'test-temp-dir');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test files with various content
    for (let i = 0; i < 100; i++) {
      const fileName = `test-file-${i}.txt`;
      const filePath = path.join(testDir, fileName);
      const content =
        `This is test file ${i}\nIt contains some sample content\nWith multiple lines\nAnd the word "performance" appears here\nEnd of file ${i}\n`.repeat(
          10
        );
      fs.writeFileSync(filePath, content);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Search Performance', () => {
    it('should search through multiple files efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'searchMultipleFiles',
        async () => {
          return await grepTool.execute({
            pattern: 'performance',
            path: testDir,
          });
        },
        {
          maxExecutionTime: 2000, // 2 seconds for 100 files
          maxMemoryDelta: 50 * 1024 * 1024, // 50MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(2000);
      expect(result.data.matches).toBeDefined();
      expect(result.data.matches.length).toBeGreaterThan(0);
    });

    it('should handle regex patterns efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'regexSearch',
        async () => {
          return await grepTool.execute({
            pattern: 'test.*file.*\\d+',
            path: testDir,
          });
        },
        {
          maxExecutionTime: 3000, // 3 seconds for regex search
          maxMemoryDelta: 50 * 1024 * 1024, // 50MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(3000);
      expect(result.data.matches).toBeDefined();
    });

    it('should search with file type filtering', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'filteredSearch',
        async () => {
          return await grepTool.execute({
            pattern: 'performance',
            path: testDir,
            include: '*.txt',
          });
        },
        {
          maxExecutionTime: 1500, // 1.5 seconds with filtering
          maxMemoryDelta: 30 * 1024 * 1024, // 30MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(1500);
      expect(result.data.matches).toBeDefined();
    });
  });

  describe('Large File Handling', () => {
    it('should handle large files efficiently', async () => {
      // Create a large test file
      const largeFilePath = path.join(testDir, 'large-file.txt');
      const largeContent =
        'This is a large file\n'.repeat(10000) + 'performance test content\n'.repeat(1000);
      fs.writeFileSync(largeFilePath, largeContent);

      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'largeFileSearch',
        async () => {
          return await grepTool.execute({
            pattern: 'performance',
            path: largeFilePath,
          });
        },
        {
          maxExecutionTime: 1000, // 1 second for large file
          maxMemoryDelta: 100 * 1024 * 1024, // 100MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(1000);
      expect(result.data.matches).toBeDefined();
      expect(result.data.matches.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Pattern Performance', () => {
    it('should handle complex regex patterns', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'complexRegex',
        async () => {
          return await grepTool.execute({
            pattern: '\\b[A-Za-z]+\\s+\\w+\\s+\\w+\\b', // Word patterns
            path: testDir,
          });
        },
        {
          maxExecutionTime: 5000, // 5 seconds for complex regex
          maxMemoryDelta: 100 * 1024 * 1024, // 100MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(5000);
      expect(result.data.matches).toBeDefined();
    });

    it('should handle case-insensitive search efficiently', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'caseInsensitive',
        async () => {
          return await grepTool.execute({
            pattern: 'PERFORMANCE',
            path: testDir,
            caseInsensitive: true,
          });
        },
        {
          maxExecutionTime: 2000, // 2 seconds
          maxMemoryDelta: 50 * 1024 * 1024, // 50MB
        }
      );

      expect(result.success).toBe(true);
      expect(metrics.executionTime).toBeLessThan(2000);
      expect(result.data.matches).toBeDefined();
      expect(result.data.matches.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle non-existent paths gracefully', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'nonExistentPath',
        async () => {
          return await grepTool.execute({
            pattern: 'test',
            path: '/non/existent/path',
          });
        },
        {
          maxExecutionTime: 500, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(500);
    });

    it('should handle invalid regex patterns', async () => {
      const { result, metrics } = await performanceFramework.measurePerformance(
        'GrepTool',
        'invalidRegex',
        async () => {
          return await grepTool.execute({
            pattern: '[invalid regex',
            path: testDir,
          });
        },
        {
          maxExecutionTime: 100, // Should fail quickly
        }
      );

      expect(result.success).toBe(false);
      expect(metrics.executionTime).toBeLessThan(100);
    });
  });
});
