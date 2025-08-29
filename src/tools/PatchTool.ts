import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * Patch application tool for applying diff patches to files
 * Supports unified diff format and provides validation before applying changes
 */
export class PatchTool implements Tool {
  name = 'patch';
  description =
    'Apply diff patches to files with validation and rollback capability. Supports unified diff format for code review integration and automated fixes.';

  parameters: ToolParameter[] = [
    {
      name: 'patch',
      type: 'string',
      description: 'The diff patch content to apply (unified diff format)',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: 'Base directory path for the patch. Defaults to current working directory.',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'validateOnly',
      type: 'boolean',
      description: 'Only validate the patch without applying it',
      required: false,
      defaultValue: false,
    },
    {
      name: 'createBackup',
      type: 'boolean',
      description: 'Create backup files before applying changes',
      required: false,
      defaultValue: true,
    },
    {
      name: 'strip',
      type: 'number',
      description: 'Number of leading path components to strip from patch paths',
      required: false,
      defaultValue: 0,
    },
    {
      name: 'reverse',
      type: 'boolean',
      description: 'Apply the patch in reverse (undo changes)',
      required: false,
      defaultValue: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        patch,
        path: basePath = process.cwd(),
        validateOnly = false,
        createBackup = true,
        strip = 0,
        reverse = false,
      } = params;

      // Validate required parameters
      if (!patch || typeof patch !== 'string' || patch.trim().length === 0) {
        throw new Error('Patch parameter is required and must be a non-empty string');
      }

      // Validate base path
      const validatedPath = await securityManager.validateDirectoryOperation(basePath);

      // Parse the patch
      const patchData = this.parseUnifiedDiff(patch, strip);

      if (patchData.length === 0) {
        return {
          success: false,
          error: 'No valid hunks found in patch',
        };
      }

      // Validate patch can be applied
      const validationResult = await this.validatePatch(patchData, validatedPath, reverse);

      if (!validationResult.valid) {
        return {
          success: false,
          error: `Patch validation failed: ${validationResult.error}`,
          data: {
            validationErrors: validationResult.errors,
          },
        };
      }

      if (validateOnly) {
        return {
          success: true,
          data: {
            message: 'Patch validation successful',
            files: patchData.map(p => p.filename),
            hunks: patchData.reduce((sum, p) => sum + p.hunks.length, 0),
            validated: true,
            applied: false,
          },
        };
      }

      // Apply the patch
      const applyResult = await this.applyPatch(patchData, validatedPath, createBackup, reverse);

      return {
        success: true,
        data: {
          message: reverse ? 'Patch reversed successfully' : 'Patch applied successfully',
          files: applyResult.files,
          hunks: applyResult.hunks,
          backups: applyResult.backups,
          applied: true,
          reversed: reverse,
        },
        metadata: {
          operationTime: Date.now(),
          basePath: validatedPath,
          validateOnly,
          createBackup,
          strip,
          reverse,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during patch application',
      };
    }
  }

  /**
   * Parse unified diff format
   */
  private parseUnifiedDiff(patchContent: string, strip: number): PatchFile[] {
    const lines = patchContent.split('\n');
    const files: PatchFile[] = [];
    let currentFile: PatchFile | null = null;
    let currentHunk: PatchHunk | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // File header
      if (line.startsWith('--- ')) {
        if (currentFile) {
          files.push(currentFile);
        }

        const filename = this.stripPathComponents(line.substring(4).split('\t')[0], strip);
        currentFile = {
          filename,
          hunks: [],
        };
        currentHunk = null;
      }
      // Hunk header
      else if (line.startsWith('@@ ')) {
        if (!currentFile) {
          throw new Error('Hunk found without preceding file header');
        }

        const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (!hunkMatch) {
          throw new Error(`Invalid hunk header: ${line}`);
        }

        const oldStart = parseInt(hunkMatch[1]);
        const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
        const newStart = parseInt(hunkMatch[3]);
        const newCount = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;

        currentHunk = {
          oldStart,
          oldCount,
          newStart,
          newCount,
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
      }
      // Hunk content
      else if (
        currentHunk &&
        (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-'))
      ) {
        currentHunk.lines.push(line);
      }
    }

    if (currentFile) {
      files.push(currentFile);
    }

    return files;
  }

  /**
   * Strip leading path components from filename
   */
  private stripPathComponents(filename: string, strip: number): string {
    if (strip <= 0) return filename;

    const parts = filename.split('/');
    if (parts.length <= strip) {
      return parts[parts.length - 1];
    }

    return parts.slice(strip).join('/');
  }

  /**
   * Validate that patch can be applied
   */
  private async validatePatch(
    patchData: PatchFile[],
    basePath: string,
    reverse: boolean
  ): Promise<{ valid: boolean; error?: string; errors?: string[] }> {
    const errors: string[] = [];

    for (const file of patchData) {
      const filePath = path.resolve(basePath, file.filename);

      try {
        // Check if file exists
        const exists = fs.existsSync(filePath);
        if (!exists) {
          errors.push(`File does not exist: ${file.filename}`);
          continue;
        }

        // Read file content
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const fileLines = content.split('\n');

        // Validate each hunk
        for (const hunk of file.hunks) {
          const validation = this.validateHunk(hunk, fileLines, reverse);
          if (!validation.valid) {
            errors.push(`${file.filename}: ${validation.error}`);
          }
        }
      } catch (error) {
        errors.push(
          `${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      ...(errors.length > 0 && { error: `${errors.length} validation error(s) found` }),
      errors,
    };
  }

  /**
   * Validate a single hunk
   */
  private validateHunk(
    hunk: PatchHunk,
    fileLines: string[],
    reverse: boolean
  ): { valid: boolean; error?: string } {
    const lines = reverse ? this.reverseHunkLines(hunk.lines) : hunk.lines;
    let fileIndex = reverse ? hunk.newStart - 1 : hunk.oldStart - 1;
    let hunkIndex = 0;

    while (hunkIndex < lines.length) {
      const line = lines[hunkIndex];

      if (line.startsWith(' ')) {
        // Context line - should match
        if (fileIndex >= fileLines.length || fileLines[fileIndex] !== line.substring(1)) {
          return {
            valid: false,
            error: `Context mismatch at line ${fileIndex + 1}: expected "${line.substring(1)}", found "${fileLines[fileIndex] || 'EOF'}"`,
          };
        }
        fileIndex++;
        hunkIndex++;
      } else if (line.startsWith('-')) {
        // Line to be removed - should match
        if (fileIndex >= fileLines.length || fileLines[fileIndex] !== line.substring(1)) {
          return {
            valid: false,
            error: `Removal mismatch at line ${fileIndex + 1}: expected "${line.substring(1)}", found "${fileLines[fileIndex] || 'EOF'}"`,
          };
        }
        fileIndex++;
        hunkIndex++;
      } else if (line.startsWith('+')) {
        // Line to be added - just skip hunk index
        hunkIndex++;
      } else {
        return {
          valid: false,
          error: `Invalid line in hunk: ${line}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Apply the patch to files
   */
  private async applyPatch(
    patchData: PatchFile[],
    basePath: string,
    createBackup: boolean,
    reverse: boolean
  ): Promise<{ files: string[]; hunks: number; backups: string[] }> {
    const appliedFiles: string[] = [];
    const backups: string[] = [];
    let totalHunks = 0;

    for (const file of patchData) {
      const filePath = path.resolve(basePath, file.filename);

      // Create backup if requested
      if (createBackup) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.promises.copyFile(filePath, backupPath);
        backups.push(backupPath);
      }

      // Read and modify file
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const newContent = this.applyPatchToContent(content, file.hunks, reverse);

      // Write modified content
      await fs.promises.writeFile(filePath, newContent, 'utf-8');

      appliedFiles.push(file.filename);
      totalHunks += file.hunks.length;
    }

    return {
      files: appliedFiles,
      hunks: totalHunks,
      backups,
    };
  }

  /**
   * Apply patch hunks to file content
   */
  private applyPatchToContent(content: string, hunks: PatchHunk[], reverse: boolean): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let currentLine = 0;

    for (const hunk of hunks) {
      // Copy lines before hunk
      while (currentLine < (reverse ? hunk.newStart - 1 : hunk.oldStart - 1)) {
        if (currentLine < lines.length) {
          result.push(lines[currentLine]);
        }
        currentLine++;
      }

      // Apply hunk
      const hunkLines = reverse ? this.reverseHunkLines(hunk.lines) : hunk.lines;

      for (const line of hunkLines) {
        if (line.startsWith(' ')) {
          // Context line
          result.push(line.substring(1));
          currentLine++;
        } else if (line.startsWith('-')) {
          // Remove line
          currentLine++;
        } else if (line.startsWith('+')) {
          // Add line
          result.push(line.substring(1));
        }
      }
    }

    // Copy remaining lines
    while (currentLine < lines.length) {
      result.push(lines[currentLine]);
      currentLine++;
    }

    return result.join('\n');
  }

  /**
   * Reverse hunk lines for reverse patching
   */
  private reverseHunkLines(lines: string[]): string[] {
    return lines.map(line => {
      if (line.startsWith('+')) {
        return '-' + line.substring(1);
      } else if (line.startsWith('-')) {
        return '+' + line.substring(1);
      }
      return line;
    });
  }
}

interface PatchFile {
  filename: string;
  hunks: PatchHunk[];
}

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}
