import * as fs from 'fs';
/// <reference types="node" />
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * File reading tool with flexible options
 * Provides capabilities to read files completely or read specific line ranges
 */
export class ReadTool implements Tool {
  name = 'read';
  description = 'Read file contents with flexible options for entire files or specific line ranges';

  parameters: ToolParameter[] = [
    {
      name: 'filePath',
      type: 'string',
      description: 'Absolute path to the file to read',
      required: true,
    },
    {
      name: 'offset',
      type: 'number',
      description: 'Starting line number (0-based, defaults to 0)',
      required: false,
      defaultValue: 0,
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Number of lines to read (defaults to all lines)',
      required: false,
      defaultValue: -1,
    },
    {
      name: 'withLineNumbers',
      type: 'boolean',
      description: 'Include line numbers in output',
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
        offset = 0,
        limit = -1,
        withLineNumbers = true,
        encoding = 'utf-8',
      } = params;

      // Validate file path and permissions
      const validatedPath = await securityManager.validateFileOperation(filePath, 'read');

      // Read file content
      const content = await fs.promises.readFile(validatedPath, {
        encoding: encoding as BufferEncoding,
      });
      const lines = content.split('\n');

      // Validate offset and limit
      if (offset < 0 || offset >= lines.length) {
        throw new Error(`Invalid offset: ${offset}. File has ${lines.length} lines.`);
      }

      // Calculate end line
      const endLine = limit === -1 ? lines.length : Math.min(offset + limit, lines.length);
      const selectedLines = lines.slice(offset, endLine);

      // Prepare output
      let output: string;
      if (withLineNumbers) {
        output = selectedLines
          .map((line, index) => `${String(offset + index + 1).padStart(6)}|${line}`)
          .join('\n');
      } else {
        output = selectedLines.join('\n');
      }

      // Get file stats
      const stats = await fs.promises.stat(validatedPath);

      return {
        success: true,
        data: {
          filePath: path.relative(process.cwd(), validatedPath),
          content: output,
          totalLines: lines.length,
          readLines: selectedLines.length,
          startLine: offset + 1,
          endLine: endLine,
          encoding,
          truncated: endLine < lines.length,
        },
        metadata: {
          fileSize: stats.size,
          lastModified: stats.mtime.toISOString(),
          readTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while reading file',
      };
    }
  }
}
