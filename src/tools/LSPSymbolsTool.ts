import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP Workspace Symbols Tool for searching symbols across the entire workspace
 * Enables quick navigation to any symbol in the codebase
 */
export class LSPSymbolsTool implements Tool {
  name = 'lsp-symbols';
  description =
    'Search for symbols across the entire workspace using Language Server Protocol. Find functions, classes, interfaces, variables, and other symbols by name or pattern.';

  parameters: ToolParameter[] = [
    {
      name: 'query',
      type: 'string',
      description:
        'Search query for symbols (supports partial matching and regex patterns)',
      required: true,
    },
    {
      name: 'workingDirectory',
      type: 'string',
      description: 'Working directory to search in',
      required: false,
      defaultValue: process.cwd(),
    },
    {
      name: 'language',
      type: 'string',
      description:
        'Filter by programming language (typescript, javascript, python, go, etc.)',
      required: false,
    },
    {
      name: 'symbolKind',
      type: 'string',
      description:
        'Filter by symbol kind: function, class, interface, variable, type, method, property, all',
      required: false,
      defaultValue: 'all',
    },
    {
      name: 'includeContext',
      type: 'boolean',
      description: 'Include source code context for each symbol',
      required: false,
      defaultValue: true,
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      defaultValue: 50,
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      description: 'Use case-sensitive matching',
      required: false,
      defaultValue: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        query,
        workingDirectory = process.cwd(),
        language,
        symbolKind = 'all',
        includeContext = true,
        maxResults = 50,
        caseSensitive = false,
      } = params;

      // Validate required parameters
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Query parameter is required and must be a non-empty string');
      }

      // Validate working directory
      const validatedWorkingDir =
        await securityManager.validateDirectoryOperation(workingDirectory);

      // Get file extensions to search
      const extensions = language
        ? this.getLanguageExtensions(language)
        : this.getAllSupportedExtensions();

      // Find all relevant files
      const files = await this.findFilesWithExtensions(validatedWorkingDir, extensions);

      // Search for symbols
      const symbols = await this.searchSymbols(
        files,
        query,
        symbolKind,
        includeContext,
        caseSensitive,
        language
      );

      // Sort by relevance
      const sortedSymbols = this.sortByRelevance(symbols, query, caseSensitive);

      // Limit results
      const limitedSymbols = sortedSymbols.slice(0, maxResults);

      // Group by file and kind
      const symbolsByFile = this.groupSymbolsByFile(limitedSymbols);
      const symbolsByKind = this.groupSymbolsByKind(limitedSymbols);

      return {
        success: true,
        data: {
          query,
          totalFound: symbols.length,
          returned: limitedSymbols.length,
          symbols: limitedSymbols,
          symbolsByFile,
          symbolsByKind,
        },
        metadata: {
          workingDirectory: validatedWorkingDir,
          language: language ?? 'all',
          symbolKind,
          caseSensitive,
          maxResults,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during symbol search',
      };
    }
  }

  /**
   * Search for symbols in files
   */
  private async searchSymbols(
    files: string[],
    query: string,
    symbolKind: string,
    includeContext: boolean,
    caseSensitive: boolean,
    languageFilter?: string
  ): Promise<WorkspaceSymbol[]> {
    const symbols: WorkspaceSymbol[] = [];
    const searchPattern = caseSensitive
      ? new RegExp(this.escapeRegex(query))
      : new RegExp(this.escapeRegex(query), 'i');

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const language = languageFilter ?? this.detectLanguage(file);

        const fileSymbols = this.extractSymbolsFromFile(
          lines,
          file,
          language,
          searchPattern,
          symbolKind,
          includeContext
        );

        symbols.push(...fileSymbols);
      } catch {
        // Skip files that can't be read
      }
    }

    return symbols;
  }

  /**
   * Extract symbols from a file
   */
  private extractSymbolsFromFile(
    lines: string[],
    filePath: string,
    language: string,
    searchPattern: RegExp,
    symbolKindFilter: string,
    includeContext: boolean
  ): WorkspaceSymbol[] {
    const symbols: WorkspaceSymbol[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const extractedSymbols = this.extractSymbolsFromLine(line, i, language);

      for (const symbol of extractedSymbols) {
        // Check if symbol matches the search pattern
        if (searchPattern.test(symbol.name)) {
          // Check if symbol matches the kind filter
          if (symbolKindFilter === 'all' || symbol.kind === symbolKindFilter) {
            const workspaceSymbol: WorkspaceSymbol = {
              name: symbol.name,
              kind: symbol.kind,
              file: filePath,
              range: {
                start: { line: i, character: symbol.startChar },
                end: { line: i, character: symbol.endChar },
              },
              preview: line.trim(),
              ...(symbol.containerName && { containerName: symbol.containerName }),
            };

            if (includeContext) {
              workspaceSymbol.context = this.getContextSnippet(lines, i, 1);
            }

            symbols.push(workspaceSymbol);
          }
        }
      }
    }

    return symbols;
  }

  /**
   * Extract symbols from a single line
   */
  private extractSymbolsFromLine(
    line: string,
    _lineIndex: number,
    language: string
  ): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    const trimmed = line.trim();

    switch (language) {
      case 'typescript':
      case 'javascript':
        symbols.push(...this.extractJSSymbols(line, trimmed));
        break;
      case 'python':
        symbols.push(...this.extractPythonSymbols(line, trimmed));
        break;
      case 'go':
        symbols.push(...this.extractGoSymbols(line, trimmed));
        break;
      case 'java':
        symbols.push(...this.extractJavaSymbols(line, trimmed));
        break;
      case 'rust':
        symbols.push(...this.extractRustSymbols(line, trimmed));
        break;
      default:
        symbols.push(...this.extractGenericSymbols(line, trimmed));
    }

    return symbols;
  }

  /**
   * Extract JavaScript/TypeScript symbols
   */
  private extractJSSymbols(line: string, trimmed: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Function declarations
    const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      const name = funcMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'function',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Arrow functions (const/let/var)
    const arrowMatch = trimmed.match(
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/
    );
    if (arrowMatch) {
      const name = arrowMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'function',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Class declarations
    const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      const name = classMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'class',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Interface declarations
    const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      const name = interfaceMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'interface',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Type declarations
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+(\w+)\s*=/);
    if (typeMatch) {
      const name = typeMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'type',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Enum declarations
    const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      const name = enumMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'enum',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Const/let/var declarations (non-function)
    const varMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::|=)/);
    if (varMatch && !arrowMatch) {
      const name = varMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'variable',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Method definitions (inside classes)
    const methodMatch = trimmed.match(
      /^(?:public|private|protected|static|async|get|set|\*)*\s*(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/
    );
    if (methodMatch && !funcMatch && !classMatch) {
      const name = methodMatch[1];
      if (!['if', 'while', 'for', 'switch', 'catch'].includes(name)) {
        const startChar = line.indexOf(name);
        symbols.push({
          name,
          kind: 'method',
          startChar,
          endChar: startChar + name.length,
        });
      }
    }

    return symbols;
  }

  /**
   * Extract Python symbols
   */
  private extractPythonSymbols(line: string, trimmed: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Function definitions
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
    if (funcMatch) {
      const name = funcMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'function',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Class definitions
    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch) {
      const name = classMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'class',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Variable assignments (top-level, with type hints)
    const varMatch = trimmed.match(/^(\w+)\s*(?::\s*\w+)?\s*=/);
    if (varMatch && !funcMatch && !classMatch) {
      const name = varMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'variable',
        startChar,
        endChar: startChar + name.length,
      });
    }

    return symbols;
  }

  /**
   * Extract Go symbols
   */
  private extractGoSymbols(line: string, trimmed: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Function definitions
    const funcMatch = trimmed.match(/^func\s+(\w+)\s*\(/);
    if (funcMatch) {
      const name = funcMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'function',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Method definitions
    const methodMatch = trimmed.match(/^func\s+\([^)]+\)\s+(\w+)\s*\(/);
    if (methodMatch) {
      const name = methodMatch[1];
      const startChar = line.lastIndexOf(name);
      symbols.push({
        name,
        kind: 'method',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Type definitions (struct/interface)
    const typeMatch = trimmed.match(/^type\s+(\w+)\s+(?:struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      const startChar = line.indexOf(name);
      const kind = trimmed.includes('struct') ? 'struct' : 'interface';
      symbols.push({
        name,
        kind,
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Type aliases
    const aliasMatch = trimmed.match(/^type\s+(\w+)\s*=/);
    if (aliasMatch) {
      const name = aliasMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'type',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Const/var declarations
    const varMatch = trimmed.match(/^(?:const|var)\s+(\w+)/);
    if (varMatch) {
      const name = varMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'variable',
        startChar,
        endChar: startChar + name.length,
      });
    }

    return symbols;
  }

  /**
   * Extract Java symbols
   */
  private extractJavaSymbols(line: string, trimmed: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Class definitions
    const classMatch = trimmed.match(
      /^(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)/
    );
    if (classMatch) {
      const name = classMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'class',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Interface definitions
    const interfaceMatch = trimmed.match(
      /^(?:public|private|protected)?\s*interface\s+(\w+)/
    );
    if (interfaceMatch) {
      const name = interfaceMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'interface',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Method definitions
    const methodMatch = trimmed.match(
      /^(?:public|private|protected)?\s*(?:static|final|abstract|synchronized)?\s*\w+\s+(\w+)\s*\(/
    );
    if (methodMatch && !classMatch && !interfaceMatch) {
      const name = methodMatch[1];
      if (name !== 'if' && name !== 'while' && name !== 'for') {
        const startChar = line.indexOf(name);
        symbols.push({
          name,
          kind: 'method',
          startChar,
          endChar: startChar + name.length,
        });
      }
    }

    return symbols;
  }

  /**
   * Extract Rust symbols
   */
  private extractRustSymbols(line: string, trimmed: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Function definitions
    const funcMatch = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
    if (funcMatch) {
      const name = funcMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'function',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Struct definitions
    const structMatch = trimmed.match(/^(?:pub\s+)?struct\s+(\w+)/);
    if (structMatch) {
      const name = structMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'struct',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Enum definitions
    const enumMatch = trimmed.match(/^(?:pub\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      const name = enumMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'enum',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Trait definitions
    const traitMatch = trimmed.match(/^(?:pub\s+)?trait\s+(\w+)/);
    if (traitMatch) {
      const name = traitMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'trait',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Impl blocks
    const implMatch = trimmed.match(/^impl(?:<[^>]+>)?\s+(\w+)/);
    if (implMatch) {
      const name = implMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'impl',
        startChar,
        endChar: startChar + name.length,
      });
    }

    return symbols;
  }

  /**
   * Extract generic symbols (fallback)
   */
  private extractGenericSymbols(line: string, trimmed: string): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    // Generic function pattern
    const funcMatch = trimmed.match(
      /^(?:function|def|func|sub|procedure)\s+(\w+)/
    );
    if (funcMatch) {
      const name = funcMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'function',
        startChar,
        endChar: startChar + name.length,
      });
    }

    // Generic class pattern
    const classMatch = trimmed.match(/^(?:class|struct|interface|type)\s+(\w+)/);
    if (classMatch) {
      const name = classMatch[1];
      const startChar = line.indexOf(name);
      symbols.push({
        name,
        kind: 'class',
        startChar,
        endChar: startChar + name.length,
      });
    }

    return symbols;
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
      kotlin: ['.kt', '.kts'],
      scala: ['.scala'],
      swift: ['.swift'],
    };

    return extensionMap[language] || [];
  }

  /**
   * Get all supported file extensions
   */
  private getAllSupportedExtensions(): string[] {
    return [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.py',
      '.go',
      '.java',
      '.cpp',
      '.cc',
      '.cxx',
      '.hpp',
      '.h',
      '.c',
      '.cs',
      '.rs',
      '.rb',
      '.kt',
      '.kts',
      '.scala',
      '.swift',
    ];
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
                'target',
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
   * Sort symbols by relevance to query
   */
  private sortByRelevance(
    symbols: WorkspaceSymbol[],
    query: string,
    caseSensitive: boolean
  ): WorkspaceSymbol[] {
    const queryLower = caseSensitive ? query : query.toLowerCase();

    return symbols.sort((a, b) => {
      const aName = caseSensitive ? a.name : a.name.toLowerCase();
      const bName = caseSensitive ? b.name : b.name.toLowerCase();

      // Exact match first
      if (aName === queryLower && bName !== queryLower) return -1;
      if (bName === queryLower && aName !== queryLower) return 1;

      // Starts with query
      if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
      if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

      // By kind priority (functions and classes first)
      const kindPriority: Record<string, number> = {
        class: 0,
        interface: 1,
        function: 2,
        method: 3,
        type: 4,
        variable: 5,
      };
      const aPriority = kindPriority[a.kind] ?? 10;
      const bPriority = kindPriority[b.kind] ?? 10;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Alphabetically
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Group symbols by file
   */
  private groupSymbolsByFile(symbols: WorkspaceSymbol[]): Record<string, WorkspaceSymbol[]> {
    const grouped: Record<string, WorkspaceSymbol[]> = {};

    for (const symbol of symbols) {
      if (!grouped[symbol.file]) {
        grouped[symbol.file] = [];
      }
      grouped[symbol.file].push(symbol);
    }

    return grouped;
  }

  /**
   * Group symbols by kind
   */
  private groupSymbolsByKind(symbols: WorkspaceSymbol[]): Record<string, WorkspaceSymbol[]> {
    const grouped: Record<string, WorkspaceSymbol[]> = {};

    for (const symbol of symbols) {
      if (!grouped[symbol.kind]) {
        grouped[symbol.kind] = [];
      }
      grouped[symbol.kind].push(symbol);
    }

    return grouped;
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
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

interface ExtractedSymbol {
  name: string;
  kind: string;
  startChar: number;
  endChar: number;
  containerName?: string;
}

interface WorkspaceSymbol {
  name: string;
  kind: string;
  file: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  containerName?: string;
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
