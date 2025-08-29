import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';
import { GlobTool } from './GlobTool.js';

/**
 * Multi-file editing tool for bulk find-and-replace operations
 * Supports pattern-based file selection and transaction-like operations
 */
export class MultieditTool implements Tool {
  name = 'multiedit';
  description =
    'Perform bulk find-and-replace operations across multiple files with pattern matching and transaction support';

  parameters: ToolParameter[] = [
    {
      name: 'pattern',
      type: 'string',
      description: 'Glob pattern to match files (e.g., "**/*.ts", "src/**/*.js")',
      required: true,
    },
    {
      name: 'find',
      type: 'string',
      description: 'Text to find and replace',
      required: true,
    },
    {
      name: 'replace',
      type: 'string',
      description: 'Text to replace matches with',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: 'Directory to search in. Defaults to current working directory.',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'include',
      type: 'array',
      description: 'Additional glob patterns to include (e.g., ["*.ts", "*.tsx"])',
      required: false,
    },
    {
      name: 'exclude',
      type: 'array',
      description: 'Glob patterns to exclude (e.g., ["node_modules/**", "*.min.js"])',
      required: false,
    },
    {
      name: 'maxFiles',
      type: 'number',
      description: 'Maximum number of files to process',
      required: false,
      defaultValue: 100,
    },
    {
      name: 'preview',
      type: 'boolean',
      description: 'Preview changes without applying them',
      required: false,
      defaultValue: false,
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      description: 'Whether the search should be case sensitive',
      required: false,
      defaultValue: true,
    },
    {
      name: 'wholeWord',
      type: 'boolean',
      description: 'Match whole words only',
      required: false,
      defaultValue: false,
    },
    {
      name: 'regex',
      type: 'boolean',
      description: 'Treat find pattern as regular expression',
      required: false,
      defaultValue: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        pattern,
        find,
        replace,
        path: searchPath = process.cwd(),
        include = [],
        exclude = [],
        maxFiles = 100,
        preview = false,
        caseSensitive = true,
        wholeWord = false,
        regex = false,
      } = params;

      // Validate required parameters
      if (!pattern || typeof pattern !== 'string' || pattern.trim().length === 0) {
        throw new Error('Pattern parameter is required and must be a non-empty string');
      }

      if (!find || typeof find !== 'string') {
        throw new Error('Find parameter is required and must be a string');
      }

      if (typeof replace !== 'string') {
        throw new Error('Replace parameter must be a string');
      }

      // Validate search path
      const validatedPath = await securityManager.validateDirectoryOperation(searchPath);

      // Find files matching the pattern
      const globTool = new GlobTool();
      const globResult = await globTool.execute({
        pattern,
        path: validatedPath,
        ignore: exclude,
        maxResults: maxFiles,
      });

      if (!globResult.success) {
        return globResult;
      }

      const matchedFiles = globResult.data?.matches || [];
      if (matchedFiles.length === 0) {
        return {
          success: true,
          data: {
            message: 'No files matched the specified pattern',
            pattern,
            searchPath: validatedPath,
            matchedFiles: 0,
            processedFiles: 0,
            changes: [],
          },
        };
      }

      // Filter by include patterns if specified
      let filesToProcess = matchedFiles;
      if (include.length > 0) {
        filesToProcess = [];
        for (const file of matchedFiles) {
          const filePath = path.resolve(validatedPath, file.path);
          let shouldInclude = false;

          for (const includePattern of include) {
            try {
              const globTool = new GlobTool();
              const result = await globTool.execute({
                pattern: includePattern,
                path: validatedPath,
              });

              if (
                result.data?.matches?.some(
                  (match: any) => path.resolve(validatedPath, match.path) === filePath
                )
              ) {
                shouldInclude = true;
                break;
              }
            } catch (error) {
              // Skip this pattern if it fails
              continue;
            }
          }

          if (shouldInclude) {
            filesToProcess.push(file);
          }
        }
      }

      // Process files
      const changes: Array<{
        file: string;
        matches: number;
        replacements: number;
        preview?: string;
      }> = [];

      let totalMatches = 0;
      let totalReplacements = 0;

      for (const file of filesToProcess.slice(0, maxFiles) as Array<{
        path: string;
        type: string;
        size?: number;
        modified?: Date;
      }>) {
        try {
          const filePath = path.resolve(validatedPath, file.path);
          const content = await fs.promises.readFile(filePath, 'utf-8');

          // Create search pattern
          let searchPattern: RegExp;
          if (regex) {
            searchPattern = new RegExp(find, caseSensitive ? 'g' : 'gi');
          } else {
            let escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (wholeWord) {
              escapedFind = `\\b${escapedFind}\\b`;
            }
            searchPattern = new RegExp(escapedFind, caseSensitive ? 'g' : 'gi');
          }

          // Count matches
          const matches = content.match(searchPattern);
          const matchCount = matches ? matches.length : 0;

          if (matchCount === 0) {
            continue;
          }

          totalMatches += matchCount;

          // Generate preview or apply changes
          const newContent = content.replace(searchPattern, replace);
          const replacementCount = matchCount; // Assuming each match is replaced once

          if (preview) {
            // Generate diff-like preview
            const previewLines = this.generatePreview(content, newContent, file.path);
            changes.push({
              file: file.path,
              matches: matchCount,
              replacements: replacementCount,
              preview: previewLines,
            });
          } else {
            // Apply changes
            await fs.promises.writeFile(filePath, newContent, 'utf-8');
            changes.push({
              file: file.path,
              matches: matchCount,
              replacements: replacementCount,
            });
            totalReplacements += replacementCount;
          }
        } catch (error) {
          // Skip files we can't process
          console.warn(`Skipping file ${file.path}: ${error}`);
          continue;
        }
      }

      return {
        success: true,
        data: {
          pattern,
          find,
          replace,
          searchPath: validatedPath,
          matchedFiles: matchedFiles.length,
          processedFiles: changes.length,
          totalMatches,
          totalReplacements,
          changes,
          preview,
        },
        metadata: {
          operationTime: Date.now(),
          mode: preview ? 'preview' : 'apply',
          regex,
          caseSensitive,
          wholeWord,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during multi-edit operation',
      };
    }
  }

  /**
   * Generate a preview of changes in diff-like format
   */
  private generatePreview(originalContent: string, newContent: string, filePath: string): string {
    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');

    const preview: string[] = [];
    preview.push(`--- ${filePath} (original)`);
    preview.push(`+++ ${filePath} (modified)`);

    // Simple diff generation - show first few changed lines
    const maxLines = Math.min(10, Math.max(originalLines.length, newLines.length));

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const newLine = newLines[i] || '';

      if (origLine !== newLine) {
        if (origLine) preview.push(`- ${origLine}`);
        if (newLine) preview.push(`+ ${newLine}`);
      } else if (origLine) {
        preview.push(`  ${origLine}`);
      }
    }

    if (originalLines.length > maxLines || newLines.length > maxLines) {
      preview.push('  ... (truncated)');
    }

    return preview.join('\n');
  }
}
