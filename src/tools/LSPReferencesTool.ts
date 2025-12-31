import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP References Tool for finding all references to a symbol
 * Searches across the codebase for all occurrences of a symbol
 */
export class LSPReferencesTool implements Tool {
  name = 'lsp-references';
  description =
    'Find all references to a symbol across the codebase using Language Server Protocol. Locates all usages of functions, classes, variables, and other symbols.';

  parameters: ToolParameter[] = [
    {
      name: 'file',
      type: 'string',
      description: 'Path to the file containing the symbol',
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
      name: 'language',
      type: 'string',
      description: 'Programming language (typescript, javascript, python, go, etc.)',
      required: false,
    },
    {
      name: 'workingDirectory',
      type: 'string',
      description: 'Working directory for searching references',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'includeDeclaration',
      type: 'boolean',
      description: 'Include the declaration/definition in the references list',
      required: false,
      defaultValue: true,
    },
    {
      name: 'includeContext',
      type: 'boolean',
      description: 'Include source code context for each reference',
      required: false,
      defaultValue: true,
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of references to return',
      required: false,
      defaultValue: 100,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        file: filePath,
        line,
        character,
        language,
        workingDirectory = process.cwd(),
        includeDeclaration = true,
        includeContext = true,
        maxResults = 100,
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
      const symbol = this.extractSymbolAtPosition(targetLine, character, detectedLanguage);

      if (!symbol) {
        return {
          success: true,
          data: {
            message: 'No symbol found at the specified position',
            file: filePath,
            position: { line, character },
            language: detectedLanguage,
          },
        };
      }

      // Find all references
      const references = await this.findReferences(
        symbol,
        detectedLanguage,
        validatedWorkingDir,
        fullPath,
        includeDeclaration,
        includeContext
      );

      // Limit results
      const limitedReferences = references.slice(0, maxResults);

      // Group references by file
      const referencesByFile = this.groupReferencesByFile(limitedReferences);

      return {
        success: true,
        data: {
          symbol,
          totalReferences: references.length,
          returnedReferences: limitedReferences.length,
          references: limitedReferences,
          referencesByFile,
          sourceFile: filePath,
          sourcePosition: { line, character },
        },
        metadata: {
          language: detectedLanguage,
          includeDeclaration,
          includeContext,
          maxResults,
          workingDirectory: validatedWorkingDir,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during references search',
      };
    }
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
   * Find all references to a symbol
   */
  private async findReferences(
    symbol: string,
    language: string,
    workingDirectory: string,
    sourceFile: string,
    includeDeclaration: boolean,
    includeContext: boolean
  ): Promise<Reference[]> {
    const references: Reference[] = [];
    const extensions = this.getLanguageExtensions(language);

    try {
      // Find all relevant files
      const files = await this.findFilesWithExtensions(workingDirectory, extensions);

      // Search each file for references
      for (const file of files) {
        try {
          const content = await fs.promises.readFile(file, 'utf-8');
          const lines = content.split('\n');
          const fileRefs = this.findReferencesInFile(
            lines,
            symbol,
            file,
            language,
            includeContext
          );

          // Filter out declaration if not included
          if (!includeDeclaration) {
            const declarationPatterns = this.getDeclarationPatterns(symbol, language);
            for (const ref of fileRefs) {
              const isDeclaration = declarationPatterns.some(pattern =>
                pattern.test(lines[ref.range.start.line])
              );
              if (!isDeclaration) {
                references.push(ref);
              }
            }
          } else {
            references.push(...fileRefs);
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore workspace search errors
    }

    // Sort references: current file first, then by file path
    references.sort((a, b) => {
      if (a.file === sourceFile && b.file !== sourceFile) return -1;
      if (a.file !== sourceFile && b.file === sourceFile) return 1;
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.range.start.line - b.range.start.line;
    });

    return references;
  }

  /**
   * Find references in a single file
   */
  private findReferencesInFile(
    lines: string[],
    symbol: string,
    filePath: string,
    language: string,
    includeContext: boolean
  ): Reference[] {
    const references: Reference[] = [];
    const symbolRegex = new RegExp(`\\b${this.escapeRegex(symbol)}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      // Skip comments and strings (simplified check)
      if (this.isCommentOrString(line, language)) {
        continue;
      }

      symbolRegex.lastIndex = 0;
      while ((match = symbolRegex.exec(line)) !== null) {
        const reference: Reference = {
          file: filePath,
          range: {
            start: { line: i, character: match.index },
            end: { line: i, character: match.index + symbol.length },
          },
          kind: this.getReferenceKind(lines, i, match.index, symbol, language),
          preview: line.trim(),
        };

        if (includeContext) {
          reference.context = this.getContextSnippet(lines, i, 1);
        }

        references.push(reference);
      }
    }

    return references;
  }

  /**
   * Check if a line is predominantly a comment or string
   */
  private isCommentOrString(line: string, language: string): boolean {
    const trimmed = line.trim();

    // Check for line comments
    switch (language) {
      case 'typescript':
      case 'javascript':
      case 'go':
      case 'java':
      case 'cpp':
      case 'c':
      case 'csharp':
      case 'rust':
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return true;
        }
        break;
      case 'python':
        if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
          return true;
        }
        break;
      case 'ruby':
        if (trimmed.startsWith('#')) {
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Get declaration patterns for filtering
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
          new RegExp(`${escaped}\\s*=`),
        ];
      case 'go':
        return [
          new RegExp(`func\\s+${escaped}\\s*\\(`),
          new RegExp(`func\\s+\\([^)]+\\)\\s+${escaped}\\s*\\(`),
          new RegExp(`type\\s+${escaped}\\s+`),
        ];
      default:
        return [];
    }
  }

  /**
   * Get reference kind
   */
  private getReferenceKind(
    lines: string[],
    lineIndex: number,
    charIndex: number,
    symbol: string,
    language: string
  ): string {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // Check for imports
    if (
      (language === 'typescript' || language === 'javascript') &&
      (trimmed.startsWith('import') || trimmed.includes('require('))
    ) {
      return 'import';
    }

    if (language === 'python' && (trimmed.startsWith('import') || trimmed.startsWith('from'))) {
      return 'import';
    }

    if (language === 'go' && trimmed.startsWith('import')) {
      return 'import';
    }

    // Check for exports
    if (
      (language === 'typescript' || language === 'javascript') &&
      trimmed.startsWith('export')
    ) {
      return 'export';
    }

    // Check for declarations
    const declarationPatterns = this.getDeclarationPatterns(symbol, language);
    for (const pattern of declarationPatterns) {
      if (pattern.test(line)) {
        return 'declaration';
      }
    }

    // Check for function calls
    const afterSymbol = line.substring(charIndex + symbol.length).trim();
    if (afterSymbol.startsWith('(')) {
      return 'call';
    }

    // Check for property access
    const beforeSymbol = line.substring(0, charIndex);
    if (beforeSymbol.endsWith('.')) {
      return 'property';
    }

    // Check for type annotation
    if (
      (language === 'typescript' || language === 'go') &&
      (beforeSymbol.includes(':') || beforeSymbol.includes('->'))
    ) {
      return 'type';
    }

    return 'reference';
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
      if (depth > 5) return; // Limit recursion depth

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
   * Get context snippet around a line
   */
  private getContextSnippet(
    lines: string[],
    targetLine: number,
    contextLines: number
  ): ContextSnippet {
    const startLine = Math.max(0, targetLine - contextLines);
    const endLine = Math.min(lines.length - 1, targetLine + contextLines);

    const contextLinesArray = [];
    for (let i = startLine; i <= endLine; i++) {
      contextLinesArray.push({
        line: i + 1,
        content: lines[i],
        isTarget: i === targetLine,
      });
    }

    return {
      startLine: startLine + 1,
      endLine: endLine + 1,
      lines: contextLinesArray,
    };
  }

  /**
   * Group references by file
   */
  private groupReferencesByFile(references: Reference[]): Record<string, Reference[]> {
    const grouped: Record<string, Reference[]> = {};

    for (const ref of references) {
      if (!grouped[ref.file]) {
        grouped[ref.file] = [];
      }
      grouped[ref.file].push(ref);
    }

    return grouped;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

interface Reference {
  file: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  kind: string;
  preview: string;
  context?: ContextSnippet;
}

interface ContextSnippet {
  startLine: number;
  endLine: number;
  lines: Array<{
    line: number;
    content: string;
    isTarget: boolean;
  }>;
}
