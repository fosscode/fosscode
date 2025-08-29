import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * Advanced file pattern matching tool using glob patterns
 * Provides fast file discovery with support for complex glob patterns
 */
export class GlobTool implements Tool {
  name = 'glob';
  description =
    'Fast file pattern matching tool that works with any codebase size. Supports glob patterns like "**/*.js" or "src/**/*.ts"';

  parameters: ToolParameter[] = [
    {
      name: 'pattern',
      type: 'string',
      description:
        'The glob pattern to match files against (e.g., "**/*.ts", "src/**/*.js", "*.{ts,tsx}")',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description:
        'The directory to search in. If not specified, the current working directory will be used.',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'ignore',
      type: 'array',
      description: 'List of glob patterns to ignore (e.g., ["node_modules/**", ".git/**"])',
      required: false,
      defaultValue: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      defaultValue: 1000,
    },
    {
      name: 'includeDirs',
      type: 'boolean',
      description: 'Whether to include directories in results',
      required: false,
      defaultValue: false,
    },
    {
      name: 'sortBy',
      type: 'string',
      description: 'Sort results by: "name", "path", "modified" (modification time)',
      required: false,
      defaultValue: 'name',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        pattern,
        path: searchPath = process.cwd(),
        ignore = ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        maxResults = 1000,
        includeDirs = false,
        sortBy = 'name',
      } = params;

      if (!pattern || typeof pattern !== 'string' || pattern.trim().length === 0) {
        throw new Error('Pattern parameter is required and must be a non-empty string');
      }

      // Validate search path
      const validatedPath = await securityManager.validateDirectoryOperation(searchPath);

      // Find files matching the pattern
      const matches = await this.findMatches(validatedPath, pattern, ignore, includeDirs);

      // Sort results
      const sortedMatches = this.sortMatches(matches, sortBy);

      // Limit results
      const limitedMatches = sortedMatches.slice(0, maxResults);

      // Convert to relative paths for better readability
      const relativeMatches = limitedMatches.map(match => ({
        ...match,
        path: path.relative(process.cwd(), match.path),
      }));

      return {
        success: true,
        data: {
          pattern,
          searchPath: validatedPath,
          totalMatches: matches.length,
          returnedMatches: relativeMatches.length,
          matches: relativeMatches,
        },
        metadata: {
          searchTime: Date.now(),
          truncated: matches.length > maxResults,
          sortBy,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during glob search',
      };
    }
  }

  /**
   * Find files and directories matching the glob pattern
   */
  private async findMatches(
    searchPath: string,
    pattern: string,
    ignorePatterns: string[] = [],
    includeDirs: boolean = false
  ): Promise<Array<{ path: string; type: 'file' | 'directory'; size?: number; modified?: Date }>> {
    const matches: Array<{
      path: string;
      type: 'file' | 'directory';
      size?: number;
      modified?: Date;
    }> = [];

    const walkDir = async (currentDir: string): Promise<void> => {
      try {
        const items = await fs.promises.readdir(currentDir);

        for (const item of items) {
          const fullPath = path.join(currentDir, item);

          // Check if path should be ignored
          if (this.shouldIgnore(fullPath, ignorePatterns)) {
            continue;
          }

          try {
            const stats = await fs.promises.stat(fullPath);

            // Check if this item matches the pattern
            if (this.matchesGlobPattern(fullPath, pattern, searchPath)) {
              const match: any = {
                path: fullPath,
                type: stats.isDirectory() ? 'directory' : 'file',
              };

              if (stats.isFile()) {
                match.size = stats.size;
                match.modified = stats.mtime;
              } else if (includeDirs) {
                match.modified = stats.mtime;
              }

              // Only include files, or directories if includeDirs is true
              if (stats.isFile() || (stats.isDirectory() && includeDirs)) {
                matches.push(match);
              }
            }

            // Recursively walk directories
            if (stats.isDirectory()) {
              await walkDir(fullPath);
            }
          } catch (error) {
            // Skip items we can't access
            continue;
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await walkDir(searchPath);
    return matches;
  }

  /**
   * Check if a path should be ignored based on ignore patterns
   */
  private shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
    for (const pattern of ignorePatterns) {
      if (this.matchesGlobPattern(filePath, pattern, process.cwd())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a path matches a glob pattern
   */
  private matchesGlobPattern(filePath: string, pattern: string, basePath: string): boolean {
    const relativePath = path.relative(basePath, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize for cross-platform

    // Convert glob pattern to regex
    const regexPattern = this.globToRegex(pattern);
    const regex = new RegExp(`^${regexPattern}$`);

    return regex.test(normalizedPath);
  }

  /**
   * Convert glob pattern to regex pattern
   */
  private globToRegex(pattern: string): string {
    // Escape special regex characters
    let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // Convert glob patterns to regex
    regex = regex
      .replace(/\*\*/g, '.*') // ** matches any number of directories
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\?/g, '[^/]'); // ? matches any single character except /

    // Handle {ext1,ext2} patterns
    regex = regex.replace(/\{([^}]+)\}/g, (match, options) => {
      const alternatives = options.split(',').map((opt: string) => opt.trim());
      return `(${alternatives.join('|')})`;
    });

    return regex;
  }

  /**
   * Sort matches by the specified criteria
   */
  private sortMatches(
    matches: Array<{ path: string; type: 'file' | 'directory'; size?: number; modified?: Date }>,
    sortBy: string
  ): Array<{ path: string; type: 'file' | 'directory'; size?: number; modified?: Date }> {
    return [...matches].sort((a, b) => {
      switch (sortBy) {
        case 'path':
          return a.path.localeCompare(b.path);
        case 'modified':
          const aTime = a.modified?.getTime() || 0;
          const bTime = b.modified?.getTime() || 0;
          return bTime - aTime; // Newest first
        case 'name':
        default:
          const aName = path.basename(a.path);
          const bName = path.basename(b.path);
          return aName.localeCompare(bName);
      }
    });
  }
}
