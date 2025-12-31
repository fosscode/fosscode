import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP Definition Tool for go-to-definition functionality
 * Navigates to symbol definitions using Language Server Protocol
 */
export class LSPDefinitionTool implements Tool {
  name = 'lsp-definition';
  description =
    'Navigate to symbol definitions using Language Server Protocol. Find where functions, classes, variables, and other symbols are defined.';

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
      description: 'Working directory for resolving relative paths and searching for definitions',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'includeContext',
      type: 'boolean',
      description: 'Include source code context around the definition',
      required: false,
      defaultValue: true,
    },
    {
      name: 'contextLines',
      type: 'number',
      description: 'Number of context lines to include around the definition',
      required: false,
      defaultValue: 3,
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
        includeContext = true,
        contextLines = 3,
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

      // Find definition within current file first
      let definition = await this.findDefinitionInFile(
        content,
        lines,
        symbol,
        detectedLanguage,
        fullPath
      );

      // If not found in current file, search in workspace
      if (!definition) {
        definition = await this.findDefinitionInWorkspace(
          symbol,
          detectedLanguage,
          validatedWorkingDir,
          fullPath
        );
      }

      if (!definition) {
        return {
          success: true,
          data: {
            message: `No definition found for symbol '${symbol}'`,
            symbol,
            file: filePath,
            position: { line, character },
            language: detectedLanguage,
          },
        };
      }

      // Add context if requested
      if (includeContext && definition.file) {
        try {
          const defContent = await fs.promises.readFile(definition.file, 'utf-8');
          const defLines = defContent.split('\n');
          definition.context = this.getContextSnippet(
            defLines,
            definition.range.start.line,
            contextLines
          );
        } catch {
          // Ignore errors reading definition file
        }
      }

      return {
        success: true,
        data: {
          symbol,
          definition,
          sourceFile: filePath,
          sourcePosition: { line, character },
        },
        metadata: {
          language: detectedLanguage,
          includeContext,
          contextLines,
          workingDirectory: validatedWorkingDir,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during definition lookup',
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
        // Return only the base identifier (before any dots)
        return word.split('.')[0];
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
        return /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*/g;
      case 'python':
        return /\b[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g;
      case 'go':
        return /\b[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g;
      default:
        return /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    }
  }

  /**
   * Find definition within the current file
   */
  private async findDefinitionInFile(
    content: string,
    lines: string[],
    symbol: string,
    language: string,
    filePath: string
  ): Promise<DefinitionResult | null> {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.findJSDefinition(content, lines, symbol, filePath);
      case 'python':
        return this.findPythonDefinition(content, lines, symbol, filePath);
      case 'go':
        return this.findGoDefinition(content, lines, symbol, filePath);
      default:
        return this.findGenericDefinition(content, lines, symbol, filePath);
    }
  }

  /**
   * Find JavaScript/TypeScript definition
   */
  private findJSDefinition(
    _content: string,
    lines: string[],
    symbol: string,
    filePath: string
  ): DefinitionResult | null {
    const patterns = [
      // Function declaration: function name(...) {
      new RegExp(`function\\s+${this.escapeRegex(symbol)}\\s*\\(`),
      // Class declaration: class Name {
      new RegExp(`class\\s+${this.escapeRegex(symbol)}\\b`),
      // Interface declaration: interface Name {
      new RegExp(`interface\\s+${this.escapeRegex(symbol)}\\b`),
      // Type declaration: type Name =
      new RegExp(`type\\s+${this.escapeRegex(symbol)}\\s*=`),
      // Const/let/var declaration: const name =
      new RegExp(`(?:const|let|var)\\s+${this.escapeRegex(symbol)}\\s*(?::|=)`),
      // Arrow function: const name = (...) =>
      new RegExp(`(?:const|let|var)\\s+${this.escapeRegex(symbol)}\\s*=\\s*(?:async\\s*)?\\(`),
      // Method definition: name(...) {
      new RegExp(`^\\s*(?:async\\s+)?${this.escapeRegex(symbol)}\\s*\\(`),
      // Export declaration
      new RegExp(`export\\s+(?:const|let|var|function|class|interface|type)\\s+${this.escapeRegex(symbol)}\\b`),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const match = line.match(pattern);
          if (match) {
            const charIndex = line.indexOf(symbol);
            return {
              file: filePath,
              range: {
                start: { line: i, character: charIndex >= 0 ? charIndex : 0 },
                end: { line: i, character: charIndex >= 0 ? charIndex + symbol.length : line.length },
              },
              kind: this.getDefinitionKind(line, 'javascript'),
              preview: line.trim(),
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find Python definition
   */
  private findPythonDefinition(
    _content: string,
    lines: string[],
    symbol: string,
    filePath: string
  ): DefinitionResult | null {
    const patterns = [
      // Function definition: def name(
      new RegExp(`^\\s*def\\s+${this.escapeRegex(symbol)}\\s*\\(`),
      // Class definition: class Name:
      new RegExp(`^\\s*class\\s+${this.escapeRegex(symbol)}\\b`),
      // Variable assignment: name =
      new RegExp(`^\\s*${this.escapeRegex(symbol)}\\s*=`),
      // Async function: async def name(
      new RegExp(`^\\s*async\\s+def\\s+${this.escapeRegex(symbol)}\\s*\\(`),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const charIndex = line.indexOf(symbol);
          return {
            file: filePath,
            range: {
              start: { line: i, character: charIndex >= 0 ? charIndex : 0 },
              end: { line: i, character: charIndex >= 0 ? charIndex + symbol.length : line.length },
            },
            kind: this.getDefinitionKind(line, 'python'),
            preview: line.trim(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Find Go definition
   */
  private findGoDefinition(
    _content: string,
    lines: string[],
    symbol: string,
    filePath: string
  ): DefinitionResult | null {
    const patterns = [
      // Function definition: func name(
      new RegExp(`^\\s*func\\s+${this.escapeRegex(symbol)}\\s*\\(`),
      // Method definition: func (r Receiver) name(
      new RegExp(`^\\s*func\\s+\\([^)]+\\)\\s+${this.escapeRegex(symbol)}\\s*\\(`),
      // Type definition: type Name struct/interface
      new RegExp(`^\\s*type\\s+${this.escapeRegex(symbol)}\\s+(?:struct|interface)`),
      // Const/var declaration
      new RegExp(`^\\s*(?:const|var)\\s+${this.escapeRegex(symbol)}\\b`),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const charIndex = line.indexOf(symbol);
          return {
            file: filePath,
            range: {
              start: { line: i, character: charIndex >= 0 ? charIndex : 0 },
              end: { line: i, character: charIndex >= 0 ? charIndex + symbol.length : line.length },
            },
            kind: this.getDefinitionKind(line, 'go'),
            preview: line.trim(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Find generic definition (fallback for unsupported languages)
   */
  private findGenericDefinition(
    _content: string,
    lines: string[],
    symbol: string,
    filePath: string
  ): DefinitionResult | null {
    // Look for common definition patterns
    const patterns = [
      new RegExp(`^\\s*(?:function|def|func|sub|procedure)\\s+${this.escapeRegex(symbol)}\\b`),
      new RegExp(`^\\s*(?:class|struct|interface|type)\\s+${this.escapeRegex(symbol)}\\b`),
      new RegExp(`^\\s*(?:const|let|var|my|local)\\s+${this.escapeRegex(symbol)}\\b`),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          const charIndex = line.indexOf(symbol);
          return {
            file: filePath,
            range: {
              start: { line: i, character: charIndex >= 0 ? charIndex : 0 },
              end: { line: i, character: charIndex >= 0 ? charIndex + symbol.length : line.length },
            },
            kind: 'definition',
            preview: line.trim(),
          };
        }
      }
    }

    return null;
  }

  /**
   * Find definition in workspace (searches related files)
   */
  private async findDefinitionInWorkspace(
    symbol: string,
    language: string,
    workingDirectory: string,
    currentFile: string
  ): Promise<DefinitionResult | null> {
    const extensions = this.getLanguageExtensions(language);

    try {
      // Search for files with matching extensions
      const files = await this.findFilesWithExtensions(workingDirectory, extensions, currentFile);

      for (const file of files.slice(0, 50)) { // Limit to 50 files for performance
        try {
          const content = await fs.promises.readFile(file, 'utf-8');
          const lines = content.split('\n');
          const definition = await this.findDefinitionInFile(content, lines, symbol, language, file);

          if (definition) {
            return definition;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore workspace search errors
    }

    return null;
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
    extensions: string[],
    excludeFile: string
  ): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 5) return; // Limit recursion depth

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip common non-source directories
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'vendor'].includes(entry.name)) {
              await scanDirectory(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext) && fullPath !== excludeFile) {
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
   * Get definition kind from line content
   */
  private getDefinitionKind(line: string, language: string): string {
    const trimmed = line.trim().toLowerCase();

    if (language === 'javascript' || language === 'typescript') {
      if (trimmed.startsWith('function') || trimmed.includes('=>')) return 'function';
      if (trimmed.startsWith('class')) return 'class';
      if (trimmed.startsWith('interface')) return 'interface';
      if (trimmed.startsWith('type')) return 'type';
      if (trimmed.startsWith('const') || trimmed.startsWith('let') || trimmed.startsWith('var')) return 'variable';
    } else if (language === 'python') {
      if (trimmed.startsWith('def') || trimmed.startsWith('async def')) return 'function';
      if (trimmed.startsWith('class')) return 'class';
    } else if (language === 'go') {
      if (trimmed.startsWith('func')) return 'function';
      if (trimmed.includes('struct')) return 'struct';
      if (trimmed.includes('interface')) return 'interface';
      if (trimmed.startsWith('type')) return 'type';
      if (trimmed.startsWith('const') || trimmed.startsWith('var')) return 'variable';
    }

    return 'definition';
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
        line: i + 1, // 1-based line numbers
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
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

interface DefinitionResult {
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
