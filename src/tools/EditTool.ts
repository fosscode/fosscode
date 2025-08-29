import * as fs from 'fs';
/// <reference types="node" />
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * Content replacement tool with precision editing capabilities
 * Provides string replacement functionality with context-aware operations
 */
export class EditTool implements Tool {
  name = 'edit';
  description =
    'Modify existing file content with precision string replacement and context-aware operations';

  parameters: ToolParameter[] = [
    {
      name: 'filePath',
      type: 'string',
      description: 'Absolute path to the file to modify',
      required: true,
    },
    {
      name: 'oldString',
      type: 'string',
      description: 'String to replace in the file',
      required: true,
    },
    {
      name: 'newString',
      type: 'string',
      description: 'Replacement string',
      required: true,
    },
    {
      name: 'replaceAll',
      type: 'boolean',
      description: 'Replace all occurrences (defaults to first occurrence only)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'createBackup',
      type: 'boolean',
      description: 'Create backup before making changes',
      required: false,
      defaultValue: true,
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding (defaults to utf-8)',
      required: false,
      defaultValue: 'utf-8',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        filePath,
        oldString,
        newString,
        replaceAll = false,
        createBackup = true,
        encoding = 'utf-8',
      } = params;

      // Validate inputs
      if (!oldString) {
        throw new Error('oldString cannot be empty');
      }

      // Validate file path and permissions
      const validatedPath = await securityManager.validateFileOperation(filePath, 'write');

      // Read current content
      const content = await fs.promises.readFile(validatedPath, {
        encoding: encoding as BufferEncoding,
      });

      // Check if oldString exists in content
      const occurrences = this.countOccurrences(content, oldString);
      if (occurrences === 0) {
        throw new Error(`String "${oldString}" not found in file`);
      }

      // Create backup if requested
      let backupCreated = false;
      let backupPath = '';
      if (createBackup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `${validatedPath}.backup.${timestamp}`;
        await fs.promises.copyFile(validatedPath, backupPath);
        backupCreated = true;
      }

      // Perform replacement
      let newContent: string;
      let replacementsMade: number;

      if (replaceAll) {
        newContent = content.replaceAll(oldString, newString);
        replacementsMade = occurrences;
      } else {
        newContent = content.replace(oldString, newString);
        replacementsMade = 1;
      }

      // Write the modified content atomically
      const tempPath = `${validatedPath}.tmp.${Date.now()}`;
      try {
        await fs.promises.writeFile(tempPath, newContent, { encoding: encoding as BufferEncoding });
        await fs.promises.rename(tempPath, validatedPath);
      } catch (error) {
        // Clean up temp file if write failed
        try {
          await fs.promises.unlink(tempPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw error;
      }

      // Get file stats
      const stats = await fs.promises.stat(validatedPath);

      return {
        success: true,
        data: {
          filePath: path.relative(process.cwd(), validatedPath),
          oldString,
          newString,
          replacementsMade,
          totalOccurrences: occurrences,
          replaceAll,
          backupCreated,
          backupPath: backupCreated ? path.relative(process.cwd(), backupPath) : null,
          encoding,
        },
        metadata: {
          fileSize: stats.size,
          lastModified: stats.mtime.toISOString(),
          editTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while editing file',
      };
    }
  }

  /**
   * Count occurrences of a string in content
   * @param content The content to search in
   * @param searchString The string to count
   * @returns Number of occurrences
   */
  private countOccurrences(content: string, searchString: string): number {
    if (!searchString) return 0;

    let count = 0;
    let index = 0;

    while ((index = content.indexOf(searchString, index)) !== -1) {
      count++;
      index += 1; // Move by 1 to catch overlapping occurrences
    }

    return count;
  }
}
