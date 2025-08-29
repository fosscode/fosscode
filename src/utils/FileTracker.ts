import * as path from 'path';
import * as fs from 'fs';

interface FileAccess {
  filePath: string;
  accessTime: Date;
  accessType: 'read' | 'write' | 'search' | 'tool';
  toolName?: string | undefined;
}

interface FileStats {
  filePath: string;
  lastAccessed: Date;
  accessCount: number;
  toolsUsed: string[];
}

export class FileTracker {
  private fileAccesses: FileAccess[] = [];
  private maxEntries: number;
  private sessionStart: Date;

  constructor(maxEntries: number = 100) {
    this.maxEntries = maxEntries;
    this.sessionStart = new Date();
  }

  /**
   * Track a file access
   */
  trackFileAccess(
    filePath: string,
    accessType: 'read' | 'write' | 'search' | 'tool',
    toolName?: string
  ): void {
    const absolutePath = path.resolve(filePath);

    // Check if file exists (for read operations)
    if (accessType === 'read') {
      try {
        fs.accessSync(absolutePath, fs.constants.F_OK);
      } catch {
        // File doesn't exist, don't track
        return;
      }
    }

    const access: FileAccess = {
      filePath: absolutePath,
      accessTime: new Date(),
      accessType,
      toolName,
    };

    this.fileAccesses.push(access);

    // Maintain maximum entries
    if (this.fileAccesses.length > this.maxEntries) {
      this.fileAccesses = this.fileAccesses.slice(-this.maxEntries);
    }
  }

  /**
   * Get recently accessed files (within the last N minutes)
   */
  getRecentlyAccessedFiles(minutes: number = 30): FileStats[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

    const fileStats = new Map<string, FileStats>();

    // Process accesses within the time window
    for (const access of this.fileAccesses) {
      if (access.accessTime >= cutoffTime) {
        const existing = fileStats.get(access.filePath);
        if (existing) {
          existing.accessCount++;
          existing.lastAccessed = access.accessTime;
          if (access.toolName && !existing.toolsUsed.includes(access.toolName)) {
            existing.toolsUsed.push(access.toolName);
          }
        } else {
          fileStats.set(access.filePath, {
            filePath: access.filePath,
            lastAccessed: access.accessTime,
            accessCount: 1,
            toolsUsed: access.toolName ? [access.toolName] : [],
          });
        }
      }
    }

    // Convert to array and sort by most recent access
    return Array.from(fileStats.values()).sort(
      (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
    );
  }

  /**
   * Get most frequently accessed files
   */
  getMostAccessedFiles(limit: number = 10): FileStats[] {
    const fileStats = new Map<string, FileStats>();

    // Aggregate all accesses
    for (const access of this.fileAccesses) {
      const existing = fileStats.get(access.filePath);
      if (existing) {
        existing.accessCount++;
        if (access.accessTime > existing.lastAccessed) {
          existing.lastAccessed = access.accessTime;
        }
        if (access.toolName && !existing.toolsUsed.includes(access.toolName)) {
          existing.toolsUsed.push(access.toolName);
        }
      } else {
        fileStats.set(access.filePath, {
          filePath: access.filePath,
          lastAccessed: access.accessTime,
          accessCount: 1,
          toolsUsed: access.toolName ? [access.toolName] : [],
        });
      }
    }

    // Convert to array and sort by access count
    return Array.from(fileStats.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get files accessed by specific tools
   */
  getFilesByTool(toolName: string): string[] {
    const files = new Set<string>();

    for (const access of this.fileAccesses) {
      if (access.toolName === toolName) {
        files.add(access.filePath);
      }
    }

    return Array.from(files);
  }

  /**
   * Get session summary
   */
  getSessionSummary(): {
    totalAccesses: number;
    uniqueFiles: number;
    sessionDuration: number;
    toolsUsed: string[];
  } {
    const uniqueFiles = new Set(this.fileAccesses.map(access => access.filePath));
    const toolsUsed = new Set(this.fileAccesses.map(access => access.toolName).filter(Boolean));

    return {
      totalAccesses: this.fileAccesses.length,
      uniqueFiles: uniqueFiles.size,
      sessionDuration: Date.now() - this.sessionStart.getTime(),
      toolsUsed: Array.from(toolsUsed) as string[],
    };
  }

  /**
   * Clear all tracked data
   */
  clear(): void {
    this.fileAccesses = [];
    this.sessionStart = new Date();
  }

  /**
   * Get raw access data (for debugging)
   */
  getRawAccesses(): FileAccess[] {
    return [...this.fileAccesses];
  }
}
