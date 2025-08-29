import * as fs from 'fs';
/// <reference types="node" />
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * File writing tool with atomic operations and backup support
 * Provides capabilities to create new files or overwrite existing ones safely
 */
export class WriteTool implements Tool {
  name = 'write';
  description =
    'Create new files or overwrite existing ones with atomic operations and backup support';

  parameters: ToolParameter[] = [
    {
      name: 'filePath',
      type: 'string',
      description: 'Absolute path for the file to write',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the file',
      required: true,
    },
    {
      name: 'createBackup',
      type: 'boolean',
      description: 'Create backup of existing file before overwriting',
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
    {
      name: 'createDirectories',
      type: 'boolean',
      description: 'Create parent directories if they do not exist',
      required: false,
      defaultValue: true,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        filePath,
        content,
        createBackup = true,
        encoding = 'utf-8',
        createDirectories = true,
      } = params;

      // Validate file path and permissions
      const validatedPath = await securityManager.validateFileOperation(filePath, 'write');

      // Check if file exists for backup
      let backupCreated = false;
      let backupPath = '';

      try {
        await fs.promises.access(validatedPath);
        // File exists, create backup if requested
        if (createBackup) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          backupPath = `${validatedPath}.backup.${timestamp}`;
          await fs.promises.copyFile(validatedPath, backupPath);
          backupCreated = true;
        }
      } catch (error) {
        // File doesn't exist, no backup needed
      }

      // Create parent directories if requested
      if (createDirectories) {
        const directory = path.dirname(validatedPath);
        await fs.promises.mkdir(directory, { recursive: true });
      }

      // Write file atomically using temporary file
      const tempPath = `${validatedPath}.tmp.${Date.now()}`;
      try {
        await fs.promises.writeFile(tempPath, content, { encoding: encoding as BufferEncoding });
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
          bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding),
          backupCreated,
          backupPath: backupCreated ? path.relative(process.cwd(), backupPath) : null,
          encoding,
          created: !backupCreated, // If no backup was created, file is new
        },
        metadata: {
          fileSize: stats.size,
          lastModified: stats.mtime.toISOString(),
          writeTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while writing file',
      };
    }
  }
}
