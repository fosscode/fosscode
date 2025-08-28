import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * File search tool using regex patterns
 * Provides grep-like functionality for searching files across the filesystem
 */
export class GrepTool implements Tool {
  name = 'grep';
  description = 'Search for patterns in files across the filesystem using regex';

  parameters: ToolParameter[] = [
    {
      name: 'pattern',
      type: 'string',
      description: 'Regex pattern to search for in file contents',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: 'Directory to search in (defaults to current directory)',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'include',
      type: 'string',
      description: 'File pattern filter (e.g., "*.ts", "*.{ts,tsx}")',
      required: false,
    },
    {
      name: 'context',
      type: 'number',
      description: 'Number of context lines to display around matches',
      required: false,
      defaultValue: 0,
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      description: 'Whether the search should be case sensitive',
      required: false,
      defaultValue: false,
    },
    {
      name: 'maxMatches',
      type: 'number',
      description: 'Maximum number of matches to return',
      required: false,
      defaultValue: 100,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        pattern,
        path: searchPath = process.cwd(),
        include,
        context = 0,
        caseSensitive = false,
        maxMatches = 100,
      } = params;

      // Validate search path
      const validatedPath = await securityManager.validateDirectoryOperation(searchPath);

      // Find files to search
      const files = await this.findFiles(validatedPath, include);

      // Compile regex pattern
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(pattern, flags);

      const results: Array<{
        file: string;
        line: number;
        column: number;
        match: string;
        contextBefore?: string[];
        contextAfter?: string[];
      }> = [];

      let matchCount = 0;

      // Search through files
      for (const file of files) {
        if (matchCount >= maxMatches) break;

        try {
          // Validate file access and size
          await securityManager.validateFileOperation(file, 'read');

          const content = await fs.promises.readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (matchCount >= maxMatches) break;

            const line = lines[lineIndex];
            const matches = [...line.matchAll(regex)];

            for (const match of matches) {
              if (matchCount >= maxMatches) break;

              const result: any = {
                file: path.relative(process.cwd(), file),
                line: lineIndex + 1,
                column: match.index + 1,
                match: match[0],
              };

              // Add context lines if requested
              if (context > 0) {
                result.contextBefore = [];
                result.contextAfter = [];

                // Context before
                for (let i = Math.max(0, lineIndex - context); i < lineIndex; i++) {
                  result.contextBefore.push({
                    line: i + 1,
                    content: lines[i],
                  });
                }

                // Context after
                for (
                  let i = lineIndex + 1;
                  i <= Math.min(lines.length - 1, lineIndex + context);
                  i++
                ) {
                  result.contextAfter.push({
                    line: i + 1,
                    content: lines[i],
                  });
                }
              }

              results.push(result);
              matchCount++;
            }
          }
        } catch (_error) {
          // Skip files that can't be read
          continue;
        }
      }

      return {
        success: true,
        data: {
          pattern,
          searchPath: validatedPath,
          totalMatches: results.length,
          results,
        },
        metadata: {
          filesSearched: files.length,
          searchTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during search',
      };
    }
  }

  /**
   * Recursively find files matching the pattern
   * @param dir Directory to search
   * @param includePattern File pattern to match (optional)
   * @returns Array of matching file paths
   */
  private async findFiles(dir: string, includePattern?: string): Promise<string[]> {
    const files: string[] = [];
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'];

    const walkDir = async (currentDir: string): Promise<void> => {
      try {
        const items = await fs.promises.readdir(currentDir);

        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          const stats = await fs.promises.stat(fullPath);

          if (stats.isDirectory()) {
            if (!ignoreDirs.includes(item)) {
              await walkDir(fullPath);
            }
          } else if (stats.isFile()) {
            // Check if file matches include pattern
            if (!includePattern || this.matchesPattern(item, includePattern)) {
              files.push(fullPath);
            }
          }
        }
      } catch (_error) {
        // Skip directories we can't read
      }
    };

    await walkDir(dir);
    return files;
  }

  /**
   * Check if filename matches the include pattern
   * @param filename The filename to check
   * @param pattern The pattern (e.g., "*.ts", "*.{ts,tsx}")
   * @returns true if matches, false otherwise
   */
  private matchesPattern(filename: string, pattern?: string): boolean {
    if (!pattern) {
      return true;
    }
    if (pattern.includes('{') && pattern.includes('}')) {
      // Multiple extensions like "*.{ts,tsx}"
      const extMatch = pattern.match(/^\*\.\{([^}]+)\}$/);
      if (extMatch) {
        const extensions = extMatch[1].split(',');
        return extensions.some(ext => filename.endsWith(`.${ext.trim()}`));
      }
    } else if (pattern.startsWith('*.')) {
      // Simple extension match like "*.ts"
      const ext = pattern.slice(2);
      return filename.endsWith(`.${ext}`);
    }

    // For more complex patterns, you could implement a more sophisticated matcher
    // For now, return true if no specific pattern
    return true;
  }
}
