import { FileTracker } from '../utils/FileTracker.js';

describe('FileTracker', () => {
  let fileTracker: FileTracker;

  beforeEach(() => {
    fileTracker = new FileTracker();
  });

  describe('File Access Tracking', () => {
    it('should track file read access', () => {
      // Create a temporary test file
      const fs = require('fs');
      const path = require('path');
      const testFile = path.join(process.cwd(), 'test-file.txt');
      fs.writeFileSync(testFile, 'test content');

      try {
        fileTracker.trackFileAccess(testFile, 'read', 'read');

        const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
        expect(recentFiles.length).toBe(1);
        expect(recentFiles[0].filePath).toBe(testFile);
        expect(recentFiles[0].accessCount).toBe(1);
        expect(recentFiles[0].toolsUsed).toContain('read');
      } finally {
        // Clean up
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should track file write access', () => {
      const testFile = '/tmp/test-write.txt';

      fileTracker.trackFileAccess(testFile, 'write', 'edit');

      const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
      expect(recentFiles.length).toBe(1);
      expect(recentFiles[0].filePath).toBe(testFile);
      expect(recentFiles[0].accessCount).toBe(1);
      expect(recentFiles[0].toolsUsed).toContain('edit');
    });

    it('should track multiple accesses to the same file', () => {
      const testFile = '/tmp/test-multiple.txt';

      // Create the file first for read access
      const fs = require('fs');
      fs.writeFileSync(testFile, 'test content');

      try {
        fileTracker.trackFileAccess(testFile, 'read', 'read');
        fileTracker.trackFileAccess(testFile, 'write', 'edit');
        fileTracker.trackFileAccess(testFile, 'search', 'grep');

        const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
        expect(recentFiles.length).toBe(1);
        expect(recentFiles[0].filePath).toBe(testFile);
        expect(recentFiles[0].accessCount).toBe(3);
        expect(recentFiles[0].toolsUsed).toEqual(['read', 'edit', 'grep']);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should not track non-existent files for read operations', () => {
      const nonExistentFile = '/tmp/non-existent-file.txt';

      fileTracker.trackFileAccess(nonExistentFile, 'read', 'read');

      const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
      expect(recentFiles.length).toBe(0);
    });

    it('should track non-existent files for write operations', () => {
      const nonExistentFile = '/tmp/non-existent-write.txt';

      fileTracker.trackFileAccess(nonExistentFile, 'write', 'edit');

      const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
      expect(recentFiles.length).toBe(1);
      expect(recentFiles[0].filePath).toBe(nonExistentFile);
    });
  });

  describe('Recently Accessed Files', () => {
    it('should return files accessed within time window', () => {
      const testFile1 = '/tmp/test-recent-1.txt';
      const testFile2 = '/tmp/test-recent-2.txt';

      // Create files first
      const fs = require('fs');
      fs.writeFileSync(testFile1, 'content1');
      fs.writeFileSync(testFile2, 'content2');

      try {
        fileTracker.trackFileAccess(testFile1, 'read', 'read');

        // Wait 2 seconds
        const startTime = Date.now();
        while (Date.now() - startTime < 2000) {
          // Busy wait
        }

        fileTracker.trackFileAccess(testFile2, 'write', 'edit');

        // Should return both files (within 5 minutes)
        const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
        expect(recentFiles.length).toBe(2);

        // Should return only the recent file (within 1 second)
        const veryRecentFiles = fileTracker.getRecentlyAccessedFiles(1 / 60); // 1 second in minutes
        expect(veryRecentFiles.length).toBe(1);
        expect(veryRecentFiles[0].filePath).toBe(testFile2);
      } finally {
        if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
        if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
      }
    });

    it('should sort files by most recent access', () => {
      const testFile1 = '/tmp/test-sort-1.txt';
      const testFile2 = '/tmp/test-sort-2.txt';
      const testFile3 = '/tmp/test-sort-3.txt';

      // Create files first
      const fs = require('fs');
      fs.writeFileSync(testFile1, 'content1');
      fs.writeFileSync(testFile2, 'content2');
      fs.writeFileSync(testFile3, 'content3');

      try {
        fileTracker.trackFileAccess(testFile1, 'read', 'read');

        // Wait a bit
        const startTime = Date.now();
        while (Date.now() - startTime < 100) {}

        fileTracker.trackFileAccess(testFile2, 'write', 'edit');

        // Wait a bit more
        const startTime2 = Date.now();
        while (Date.now() - startTime2 < 100) {}

        fileTracker.trackFileAccess(testFile3, 'search', 'grep');

        const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
        expect(recentFiles.length).toBe(3);
        expect(recentFiles[0].filePath).toBe(testFile3); // Most recent
        expect(recentFiles[1].filePath).toBe(testFile2);
        expect(recentFiles[2].filePath).toBe(testFile1); // Least recent
      } finally {
        if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
        if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
        if (fs.existsSync(testFile3)) fs.unlinkSync(testFile3);
      }
    });
  });

  describe('Most Accessed Files', () => {
    it('should return most frequently accessed files', () => {
      const testFile1 = '/tmp/test-freq-1.txt';
      const testFile2 = '/tmp/test-freq-2.txt';

      // Create files first
      const fs = require('fs');
      fs.writeFileSync(testFile1, 'content1');
      fs.writeFileSync(testFile2, 'content2');

      try {
        // Access file1 multiple times
        fileTracker.trackFileAccess(testFile1, 'read', 'read');
        fileTracker.trackFileAccess(testFile1, 'write', 'edit');
        fileTracker.trackFileAccess(testFile1, 'search', 'grep');

        // Access file2 once
        fileTracker.trackFileAccess(testFile2, 'read', 'read');

        const mostAccessed = fileTracker.getMostAccessedFiles(10);
        expect(mostAccessed.length).toBe(2);
        expect(mostAccessed[0].filePath).toBe(testFile1);
        expect(mostAccessed[0].accessCount).toBe(3);
        expect(mostAccessed[1].filePath).toBe(testFile2);
        expect(mostAccessed[1].accessCount).toBe(1);
      } finally {
        if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
        if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
      }
    });
  });

  describe('Files by Tool', () => {
    it('should return files accessed by specific tool', () => {
      const testFile1 = '/tmp/test-tool-1.txt';
      const testFile2 = '/tmp/test-tool-2.txt';
      const testFile3 = '/tmp/test-tool-3.txt';

      // Create files first
      const fs = require('fs');
      fs.writeFileSync(testFile1, 'content1');
      fs.writeFileSync(testFile2, 'content2');
      fs.writeFileSync(testFile3, 'content3');

      try {
        fileTracker.trackFileAccess(testFile1, 'read', 'read');
        fileTracker.trackFileAccess(testFile2, 'read', 'read');
        fileTracker.trackFileAccess(testFile2, 'write', 'edit');
        fileTracker.trackFileAccess(testFile3, 'search', 'grep');

        const readFiles = fileTracker.getFilesByTool('read');
        expect(readFiles).toHaveLength(2);
        expect(readFiles).toContain(testFile1);
        expect(readFiles).toContain(testFile2);

        const editFiles = fileTracker.getFilesByTool('edit');
        expect(editFiles).toHaveLength(1);
        expect(editFiles).toContain(testFile2);

        const grepFiles = fileTracker.getFilesByTool('grep');
        expect(grepFiles).toHaveLength(1);
        expect(grepFiles).toContain(testFile3);
      } finally {
        if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
        if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
        if (fs.existsSync(testFile3)) fs.unlinkSync(testFile3);
      }
    });
  });

  describe('Session Summary', () => {
    it('should provide session summary statistics', () => {
      const testFile1 = '/tmp/test-summary-1.txt';
      const testFile2 = '/tmp/test-summary-2.txt';

      // Create files first
      const fs = require('fs');
      fs.writeFileSync(testFile1, 'content1');
      fs.writeFileSync(testFile2, 'content2');

      try {
        fileTracker.trackFileAccess(testFile1, 'read', 'read');
        fileTracker.trackFileAccess(testFile2, 'write', 'edit');
        fileTracker.trackFileAccess(testFile1, 'search', 'grep');

        const summary = fileTracker.getSessionSummary();

        expect(summary.totalAccesses).toBe(3);
        expect(summary.uniqueFiles).toBe(2);
        expect(typeof summary.sessionDuration).toBe('number');
        expect(summary.sessionDuration).toBeGreaterThanOrEqual(0);
        expect(summary.toolsUsed).toEqual(['read', 'edit', 'grep']);
      } finally {
        if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
        if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
      }
    });
  });

  describe('Data Management', () => {
    it('should maintain maximum entries limit', () => {
      const maxEntries = 5;
      const smallTracker = new FileTracker(maxEntries);

      // Create files first and add more entries than the limit
      const fs = require('fs');
      const testFiles: string[] = [];

      for (let i = 0; i < maxEntries + 3; i++) {
        const testFile = `/tmp/test-file-${i}.txt`;
        testFiles.push(testFile);
        fs.writeFileSync(testFile, `content${i}`);
        smallTracker.trackFileAccess(testFile, 'read', 'read');
      }

      try {
        const rawAccesses = smallTracker.getRawAccesses();
        expect(rawAccesses.length).toBe(maxEntries);
      } finally {
        // Clean up
        testFiles.forEach(file => {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        });
      }
    });

    it('should clear all tracked data', () => {
      const testFile = '/tmp/test-clear.txt';

      // Create file first
      const fs = require('fs');
      fs.writeFileSync(testFile, 'test content');

      try {
        fileTracker.trackFileAccess(testFile, 'read', 'read');
        expect(fileTracker.getRawAccesses().length).toBe(1);

        fileTracker.clear();
        expect(fileTracker.getRawAccesses().length).toBe(0);
      } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      }
    });
  });
});
