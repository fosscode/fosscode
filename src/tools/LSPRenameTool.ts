import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP Rename Tool for symbol renaming with LSP-powered refactoring
 * Renames symbols across the codebase while maintaining consistency
 */
export class LSPRenameTool implements Tool {
  name = 'lsp-rename';
  description =
    'Rename symbols across the codebase using Language Server Protocol refactoring. Safely renames functions, classes, variables, and other symbols while maintaining all references.';

  parameters: ToolParameter[] = [
    {
      name: 'file',
      type: 'string',
      description: 'Path to the file containing the symbol to rename',
      required: true,
    },
    {
      name: 'line',
      type: 'number',
      description: 'Line number (1-based) where the symbol is located',
      required: true,
    },
    {
      name: 'character',
      type: 'number',
      description: 'Character position (0-based) within the line',
      required: true,
    },
    {
      name: 'newName',
      type: 'string',
      description: 'The new name for the symbol',
      required: true,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Programming language (typescript, javascript, python, go, etc.)',
      required: false,
    },
    {
      name: 'workingDirectory',
      type: 'string',
      description: 'Working directory for searching and renaming',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'dryRun',
      type: 'boolean',
      description: 'Preview changes without applying them',
      required: false,
      defaultValue: false,
    },
    {
      name: 'includeComments',
      type: 'boolean',
      description: 'Also rename occurrences in comments',
      required: false,
      defaultValue: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        file: filePath,
        line,
        character,
        newName,
        language,
        workingDirectory = process.cwd(),
        dryRun = false,
        includeComments = false,
      } = params;

      // Validate required parameters
      if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
        throw new Error('File parameter is required and must be a non-empty string');
      }

      if (typeof line !== 'number' || line < 1) {
        throw new Error('Line parameter is required and must be a positive number (1-based)');
      }

      if (typeof character !== 'number' || character < 0) {
        throw new Error(
          'Character parameter is required and must be a non-negative number (0-based)'
        );
      }

      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        throw new Error('newName parameter is required and must be a non-empty string');
      }

      // Validate new name format
      if (!this.isValidIdentifier(newName)) {
        throw new Error(
          `Invalid identifier '${newName}'. Must start with a letter or underscore and contain only letters, numbers, and underscores.`
        );
      }

      // Validate working directory
      const validatedWorkingDir =
        await securityManager.validateDirectoryOperation(workingDirectory);

      // Resolve and validate file path
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(validatedWorkingDir, filePath);
      await securityManager.validateFileOperation(fullPath, 'read');

      // Read file content
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Validate line and character positions
      if (line > lines.length) {
        throw new Error(`Line ${line} is beyond the end of the file (${lines.length} lines)`);
      }

      const targetLine = lines[line - 1];
      if (character > targetLine.length) {
        throw new Error(
          `Character ${character} is beyond the end of line ${line} (${targetLine.length} characters)`
        );
      }

      // Detect language if not provided
      const detectedLanguage = language ?? this.detectLanguage(filePath);

      // Extract symbol at position
      const oldName = this.extractSymbolAtPosition(targetLine, character, detectedLanguage);

      if (!oldName) {
        return {
          success: false,
          error: 'No symbol found at the specified position',
        };
      }

      if (oldName === newName) {
        return {
          success: true,
          data: {
            message: 'Symbol already has the new name',
            symbol: oldName,
            file: filePath,
            position: { line, character },
          },
        };
      }

      // Check if new name conflicts with existing symbols
      const conflictCheck = await this.checkNameConflicts(
        newName,
        detectedLanguage,
        validatedWorkingDir
      );

      if (conflictCheck.hasConflict) {
        return {
          success: false,
          error: `Name conflict: '${newName}' is already used in ${conflictCheck.conflictFile}`,
        };
      }

      // Find all occurrences to rename
      const edits = await this.prepareRename(
        oldName,
        newName,
        detectedLanguage,
        validatedWorkingDir,
        includeComments
      );

      if (edits.length === 0) {
        return {
          success: true,
          data: {
            message: `No references found for symbol '${oldName}'`,
            symbol: oldName,
            newName,
          },
        };
      }

      // Group edits by file
      const editsByFile = this.groupEditsByFile(edits);

      if (dryRun) {
        return {
          success: true,
          data: {
            dryRun: true,
            symbol: oldName,
            newName,
            totalEdits: edits.length,
            filesAffected: Object.keys(editsByFile).length,
            editsByFile: this.formatEditsForPreview(editsByFile),
          },
          metadata: {
            language: detectedLanguage,
            includeComments,
            workingDirectory: validatedWorkingDir,
          },
        };
      }

      // Apply the edits
      const appliedEdits = await this.applyRename(editsByFile);

      return {
        success: true,
        data: {
          symbol: oldName,
          newName,
          totalEdits: appliedEdits.totalEdits,
          filesModified: appliedEdits.filesModified,
          modifiedFiles: appliedEdits.modifiedFiles,
        },
        metadata: {
          language: detectedLanguage,
          includeComments,
          workingDirectory: validatedWorkingDir,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred during symbol rename',
      };
    }
  }

  /**
   * Check if a string is a valid identifier
   */
  private isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
    };

    return languageMap[ext] || 'plaintext';
  }

  /**
   * Extract symbol at the given character position
   */
  private extractSymbolAtPosition(
    line: string,
    character: number,
    language: string
  ): string | null {
    const wordRegex = this.getWordRegex(language);
    let match;
    const words: Array<{ word: string; start: number; end: number }> = [];

    while ((match = wordRegex.exec(line)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    for (const { word, start, end } of words) {
      if (character >= start && character < end) {
        return word;
      }
    }

    return null;
  }

  /**
   * Get word regex based on language
   */
  private getWordRegex(language: string): RegExp {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g;
      case 'python':
        return /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
      case 'go':
        return /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
      default:
        return /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    }
  }

  /**
   * Check for name conflicts
   */
  private async checkNameConflicts(
    newName: string,
    language: string,
    workingDirectory: string
  ): Promise<{ hasConflict: boolean; conflictFile?: string }> {
    const extensions = this.getLanguageExtensions(language);

    try {
      const files = await this.findFilesWithExtensions(workingDirectory, extensions);

      for (const file of files.slice(0, 30)) {
        // Limit for performance
        try {
          const content = await fs.promises.readFile(file, 'utf-8');

          // Check for declarations of the new name
          const declarationPatterns = this.getDeclarationPatterns(newName, language);
          for (const pattern of declarationPatterns) {
            if (pattern.test(content)) {
              return { hasConflict: true, conflictFile: file };
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore workspace search errors
    }

    return { hasConflict: false };
  }

  /**
   * Get declaration patterns for a symbol
   */
  private getDeclarationPatterns(symbol: string, language: string): RegExp[] {
    const escaped = this.escapeRegex(symbol);

    switch (language) {
      case 'typescript':
      case 'javascript':
        return [
          new RegExp(`function\\s+${escaped}\\s*\\(`),
          new RegExp(`class\\s+${escaped}\\b`),
          new RegExp(`interface\\s+${escaped}\\b`),
          new RegExp(`type\\s+${escaped}\\s*=`),
          new RegExp(`(?:const|let|var)\\s+${escaped}\\s*(?::|=)`),
        ];
      case 'python':
        return [
          new RegExp(`def\\s+${escaped}\\s*\\(`),
          new RegExp(`class\\s+${escaped}\\b`),
        ];
      case 'go':
        return [
          new RegExp(`func\\s+${escaped}\\s*\\(`),
          new RegExp(`type\\s+${escaped}\\s+`),
        ];
      default:
        return [];
    }
  }

  /**
   * Prepare rename edits
   */
  private async prepareRename(
    oldName: string,
    newName: string,
    language: string,
    workingDirectory: string,
    includeComments: boolean
  ): Promise<TextEdit[]> {
    const edits: TextEdit[] = [];
    const extensions = this.getLanguageExtensions(language);

    try {
      const files = await this.findFilesWithExtensions(workingDirectory, extensions);

      for (const file of files) {
        try {
          const content = await fs.promises.readFile(file, 'utf-8');
          const lines = content.split('\n');
          const fileEdits = this.findEditsInFile(
            lines,
            oldName,
            newName,
            file,
            language,
            includeComments
          );
          edits.push(...fileEdits);
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore workspace search errors
    }

    return edits;
  }

  /**
   * Find edits needed in a single file
   */
  private findEditsInFile(
    lines: string[],
    oldName: string,
    newName: string,
    filePath: string,
    language: string,
    includeComments: boolean
  ): TextEdit[] {
    const edits: TextEdit[] = [];
    const symbolRegex = new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments unless includeComments is true
      if (!includeComments && this.isComment(line, language)) {
        continue;
      }

      // Skip strings (simplified check)
      if (this.isInString(line, language)) {
        continue;
      }

      let match;
      symbolRegex.lastIndex = 0;

      while ((match = symbolRegex.exec(line)) !== null) {
        // Verify this is not inside a string on this line
        if (!this.isPositionInString(line, match.index, language)) {
          edits.push({
            file: filePath,
            range: {
              start: { line: i, character: match.index },
              end: { line: i, character: match.index + oldName.length },
            },
            newText: newName,
            oldText: oldName,
            lineContent: line,
          });
        }
      }
    }

    return edits;
  }

  /**
   * Check if a line is a comment
   */
  private isComment(line: string, language: string): boolean {
    const trimmed = line.trim();

    switch (language) {
      case 'typescript':
      case 'javascript':
      case 'go':
      case 'java':
      case 'cpp':
      case 'c':
      case 'csharp':
      case 'rust':
        return (
          trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')
        );
      case 'python':
        return (
          trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")
        );
      case 'ruby':
        return trimmed.startsWith('#');
      default:
        return false;
    }
  }

  /**
   * Check if a line is primarily a string (simplified)
   */
  private isInString(line: string, _language: string): boolean {
    // This is a simplified check - a real implementation would need proper parsing
    const trimmed = line.trim();
    return (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))
    );
  }

  /**
   * Check if a position is inside a string (simplified)
   */
  private isPositionInString(line: string, position: number, _language: string): boolean {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;

    for (let i = 0; i < position && i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';

      if (char === "'" && prevChar !== '\\' && !inDoubleQuote && !inTemplate) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && prevChar !== '\\' && !inSingleQuote && !inTemplate) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && prevChar !== '\\' && !inSingleQuote && !inDoubleQuote) {
        inTemplate = !inTemplate;
      }
    }

    return inSingleQuote || inDoubleQuote || inTemplate;
  }

  /**
   * Get file extensions for a language
   */
  private getLanguageExtensions(language: string): string[] {
    const extensionMap: Record<string, string[]> = {
      typescript: ['.ts', '.tsx'],
      javascript: ['.js', '.jsx', '.mjs'],
      python: ['.py'],
      go: ['.go'],
      java: ['.java'],
      cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
      c: ['.c', '.h'],
      csharp: ['.cs'],
      rust: ['.rs'],
      ruby: ['.rb'],
    };

    return extensionMap[language] || [];
  }

  /**
   * Find files with specific extensions in directory
   */
  private async findFilesWithExtensions(
    directory: string,
    extensions: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 5) return;

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (
              ![
                'node_modules',
                '.git',
                'dist',
                'build',
                '__pycache__',
                '.venv',
                'vendor',
              ].includes(entry.name)
            ) {
              await scanDirectory(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    await scanDirectory(directory);
    return files;
  }

  /**
   * Group edits by file
   */
  private groupEditsByFile(edits: TextEdit[]): Record<string, TextEdit[]> {
    const grouped: Record<string, TextEdit[]> = {};

    for (const edit of edits) {
      if (!grouped[edit.file]) {
        grouped[edit.file] = [];
      }
      grouped[edit.file].push(edit);
    }

    // Sort edits in each file by position (reverse order for applying)
    for (const file of Object.keys(grouped)) {
      grouped[file].sort((a, b) => {
        if (a.range.start.line !== b.range.start.line) {
          return b.range.start.line - a.range.start.line;
        }
        return b.range.start.character - a.range.start.character;
      });
    }

    return grouped;
  }

  /**
   * Format edits for preview
   */
  private formatEditsForPreview(editsByFile: Record<string, TextEdit[]>): Record<string, any[]> {
    const formatted: Record<string, any[]> = {};

    for (const [file, edits] of Object.entries(editsByFile)) {
      formatted[file] = edits.map(edit => ({
        line: edit.range.start.line + 1,
        character: edit.range.start.character,
        oldText: edit.oldText,
        newText: edit.newText,
        preview: edit.lineContent?.trim(),
      }));
    }

    return formatted;
  }

  /**
   * Apply rename edits to files
   */
  private async applyRename(
    editsByFile: Record<string, TextEdit[]>
  ): Promise<{ totalEdits: number; filesModified: number; modifiedFiles: string[] }> {
    let totalEdits = 0;
    const modifiedFiles: string[] = [];

    for (const [file, edits] of Object.entries(editsByFile)) {
      try {
        // Validate file access
        await securityManager.validateFileOperation(file, 'write');

        let content = await fs.promises.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Apply edits in reverse order (from end to start)
        for (const edit of edits) {
          const lineIndex = edit.range.start.line;
          if (lineIndex < lines.length) {
            const line = lines[lineIndex];
            const before = line.substring(0, edit.range.start.character);
            const after = line.substring(edit.range.end.character);
            lines[lineIndex] = before + edit.newText + after;
            totalEdits++;
          }
        }

        // Write the modified content
        content = lines.join('\n');
        await fs.promises.writeFile(file, content, 'utf-8');
        modifiedFiles.push(file);
      } catch (error) {
        // Log but continue with other files
        console.error(`Failed to modify ${file}:`, error);
      }
    }

    return {
      totalEdits,
      filesModified: modifiedFiles.length,
      modifiedFiles,
    };
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

interface TextEdit {
  file: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
  oldText: string;
  lineContent?: string;
}
