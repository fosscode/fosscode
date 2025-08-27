import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * Directory listing tool
 * Provides capabilities to list files and directories with filtering options
 */
export class ListTool implements Tool {
  name = 'list';
  description = 'List files and directories in a specified path with optional filtering';

  parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: 'Absolute path to the directory to list (defaults to current directory)',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'showHidden',
      type: 'boolean',
      description: 'Include hidden files (starting with .)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'type',
      type: 'string',
      description: 'Filter by type: "all", "files", "dirs" (defaults to "all")',
      required: false,
      defaultValue: 'all',
    },
    {
      name: 'pattern',
      type: 'string',
      description: 'Filter by name pattern (simple wildcard, e.g., "*.ts")',
      required: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { path: dirPath = process.cwd(), showHidden = false, type = 'all', pattern } = params;

      // Validate directory path and permissions
      const validatedPath = await securityManager.validateFileOperation(dirPath, 'read');

      // Read directory contents
      const items = await fs.promises.readdir(validatedPath);

      // Filter items based on criteria
      let filteredItems = items;

      // Filter hidden files
      if (!showHidden) {
        filteredItems = filteredItems.filter(item => !item.startsWith('.'));
      }

      // Filter by type
      if (type === 'files') {
        const statsPromises = filteredItems.map(async item => {
          const itemPath = path.join(validatedPath, item);
          const stats = await fs.promises.stat(itemPath);
          return { name: item, isFile: stats.isFile() };
        });
        const statsResults = await Promise.all(statsPromises);
        filteredItems = statsResults.filter(result => result.isFile).map(result => result.name);
      } else if (type === 'dirs') {
        const statsPromises = filteredItems.map(async item => {
          const itemPath = path.join(validatedPath, item);
          const stats = await fs.promises.stat(itemPath);
          return { name: item, isDirectory: stats.isDirectory() };
        });
        const statsResults = await Promise.all(statsPromises);
        filteredItems = statsResults
          .filter(result => result.isDirectory)
          .map(result => result.name);
      }

      // Filter by pattern
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        filteredItems = filteredItems.filter(item => regex.test(item));
      }

      // Get detailed information for each item
      const itemDetails = await Promise.all(
        filteredItems.map(async item => {
          const itemPath = path.join(validatedPath, item);
          const stats = await fs.promises.stat(itemPath);
          return {
            name: item,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        })
      );

      return {
        success: true,
        data: {
          path: path.relative(process.cwd(), validatedPath),
          items: itemDetails,
          totalCount: itemDetails.length,
          filtered: {
            showHidden,
            type,
            pattern,
          },
        },
        metadata: {
          listTime: Date.now(),
          absolutePath: validatedPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred while listing directory',
      };
    }
  }
}
