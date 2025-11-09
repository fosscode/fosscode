import * as fs from 'fs';
/// <reference types="node" />
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
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
    {
      name: 'runLint',
      type: 'boolean',
      description: 'Run linting after editing (defaults to false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'fixLint',
      type: 'boolean',
      description: 'Auto-fix linting issues if runLint is true (defaults to false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'runTests',
      type: 'boolean',
      description: 'Run tests after editing (defaults to false)',
      required: false,
      defaultValue: false,
    },
    {
      name: 'runCommit',
      type: 'boolean',
      description: 'Auto-commit changes after successful edit (defaults to false)',
      required: false,
      defaultValue: false,
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
        runLint = false,
        fixLint = false,
        runTests = false,
        runCommit = false,
      } = params;

      // Validate inputs
      if (!oldString) {
        throw new Error('oldString cannot be empty');
      }

      // Validate file path and permissions
      const validatedPath = await securityManager.validateFileOperation(filePath, 'write');

      // Read current content (this is the original content before editing)
      const originalContent = await fs.promises.readFile(validatedPath, {
        encoding: encoding as BufferEncoding,
      });

      // Check if oldString exists in content
      const occurrences = this.countOccurrences(originalContent, oldString);
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
        newContent = originalContent.replaceAll(oldString, newString);
        replacementsMade = occurrences;
      } else {
        newContent = originalContent.replace(oldString, newString);
        replacementsMade = 1;
      }

      // Write the modified content atomically
      const tempPath = `${validatedPath}.tmp.${Date.now()}`;
      try {
        await fs.promises.writeFile(tempPath, newContent, { encoding: encoding as BufferEncoding });
        await fs.promises.rename(tempPath, validatedPath);
      } catch (_error) {
        // Clean up temp file if write failed
        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw _error;
      }

      // Generate and save diff information for VSCode extension
      await this.generateDiffInfo(validatedPath, originalContent, newContent);

      // Get file stats
      const stats = await fs.promises.stat(validatedPath);

      // Run linting and testing if requested
      let lintResult: string | null = null;
      let testResult: string | null = null;
      let commitResult: string | null = null;
      let lintErrors = 0;
      let testFailures = 0;

      if (runLint || runTests) {
        try {
          if (runLint) {
            const lintCommand = fixLint ? 'npm run lint -- --fix' : 'npm run lint';
            const lintOutput = execSync(lintCommand, {
              cwd: process.cwd(),
              encoding: 'utf-8',
              stdio: 'pipe',
            });
            lintResult = lintOutput;
            // Count errors (rough count)
            const errorMatches = lintOutput.match(/✖ (\d+) problems?/);
            if (errorMatches) {
              lintErrors = parseInt(errorMatches[1], 10);
            }
          }

          if (runTests) {
            const testOutput = execSync('npm run test', {
              cwd: process.cwd(),
              encoding: 'utf-8',
              stdio: 'pipe',
            });
            testResult = testOutput;
            // Count failures
            const failureMatches = testOutput.match(/(\d+) failed/);
            if (failureMatches) {
              testFailures = parseInt(failureMatches[1], 10);
            }
          }
        } catch (error) {
          // If lint/test fails, capture the error output
          if (runLint && !lintResult) {
            lintResult = error instanceof Error ? error.message : 'Lint failed';
            const errorMatches = lintResult.match(/✖ (\d+) problems?/);
            if (errorMatches) {
              lintErrors = parseInt(errorMatches[1], 10);
            }
          }
          if (runTests && !testResult) {
            testResult = error instanceof Error ? error.message : 'Test failed';
            const failureMatches = testResult.match(/(\d+) failed/);
            if (failureMatches) {
              testFailures = parseInt(failureMatches[1], 10);
            }
          }
        }
      }

      // Run git commit if requested
      if (runCommit) {
        try {
          // Check if git repo
          execSync('git status --porcelain', { cwd: process.cwd(), stdio: 'pipe' });
          // Add the file
          execSync(`git add "${validatedPath}"`, { cwd: process.cwd(), stdio: 'pipe' });
          // Generate commit message
          const commitMessage = `Update ${path.basename(validatedPath)}`;
          execSync(`git commit -S -m "${commitMessage}"`, { cwd: process.cwd(), stdio: 'pipe' });
          commitResult = `Committed with message: ${commitMessage}`;
        } catch (error) {
          commitResult = error instanceof Error ? error.message : 'Commit failed';
        }
      }

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
          lintResult,
          testResult,
          commitResult,
          lintErrors,
          testFailures,
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

  /**
   * Generate and save diff information for VSCode extension
   * @param filePath The file that was edited
   * @param originalContent The original file content
   * @param newContent The new file content
   */
  private async generateDiffInfo(
    filePath: string,
    originalContent: string,
    newContent: string
  ): Promise<void> {
    try {
      const tempDir = path.join(os.tmpdir(), 'vscode-fosscode-diff');

      // Ensure temp directory exists
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Generate diff data
      const diffData = {
        type: 'file_change',
        filePath: path.resolve(filePath),
        originalContent,
        newContent,
        timestamp: new Date().toISOString(),
        tool: 'edit',
      };

      // Write diff file
      const timestamp = Date.now();
      const diffFileName = `fosscode-${timestamp}.json`;
      const diffFilePath = path.join(tempDir, diffFileName);

      await fs.promises.writeFile(diffFilePath, JSON.stringify(diffData, null, 2), 'utf8');

      console.log(`Diff information saved to: ${diffFilePath}`);
    } catch (error) {
      // Don't fail the edit operation if diff generation fails
      console.warn('Failed to generate diff information:', error);
    }
  }
}
