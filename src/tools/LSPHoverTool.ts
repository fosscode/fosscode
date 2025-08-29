import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP Hover Tool for code documentation and type information
 * Provides contextual information about code symbols (functions, variables, classes, etc.)
 */
export class LSPHoverTool implements Tool {
  name = 'lsp-hover';
  description =
    'Get documentation and type information for code symbols using Language Server Protocol hover functionality.';

  parameters: ToolParameter[] = [
    {
      name: 'file',
      type: 'string',
      description: 'Path to the file to analyze',
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
      description: 'Programming language (typescript, javascript, python, etc.)',
      required: false,
    },
    {
      name: 'includeRange',
      type: 'boolean',
      description: 'Include the range of the symbol in the response',
      required: false,
      defaultValue: true,
    },
    {
      name: 'includeDefinition',
      type: 'boolean',
      description: 'Include definition location if available',
      required: false,
      defaultValue: true,
    },
    {
      name: 'contextLines',
      type: 'number',
      description: 'Number of context lines to include around the symbol',
      required: false,
      defaultValue: 2,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        file: filePath,
        line,
        character,
        language,
        includeRange = true,
        includeDefinition = true,
        contextLines = 2,
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

      // Validate file access
      const validatedPath = await securityManager.validateFileOperation(filePath, 'read');

      // Read file content
      const content = await fs.promises.readFile(validatedPath, 'utf-8');
      const lines = content.split('\n');

      // Validate line and character positions
      if (line > lines.length) {
        throw new Error(`Line ${line} is beyond the end of the file (${lines.length} lines)`);
      }

      const targetLine = lines[line - 1]; // Convert to 0-based indexing
      if (character > targetLine.length) {
        throw new Error(
          `Character ${character} is beyond the end of line ${line} (${targetLine.length} characters)`
        );
      }

      // Detect language if not provided
      const detectedLanguage = language || this.detectLanguage(filePath);

      // Analyze the symbol at the given position
      const hoverInfo = await this.analyzeSymbol(
        content,
        lines,
        line - 1, // Convert to 0-based
        character,
        detectedLanguage
      );

      if (!hoverInfo) {
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

      // Build response with optional components
      const response: any = {
        file: filePath,
        position: { line, character },
        language: detectedLanguage,
        symbol: hoverInfo.symbol,
        type: hoverInfo.type,
        documentation: hoverInfo.documentation,
      };

      if (includeRange && hoverInfo.range) {
        response.range = hoverInfo.range;
      }

      if (includeDefinition && hoverInfo.definition) {
        response.definition = hoverInfo.definition;
      }

      if (contextLines > 0) {
        response.context = this.getContextSnippet(lines, line - 1, contextLines);
      }

      return {
        success: true,
        data: response,
        metadata: {
          analysisTime: Date.now(),
          language: detectedLanguage,
          includeRange,
          includeDefinition,
          contextLines,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred during hover analysis',
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
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.dart': 'dart',
      '.lua': 'lua',
      '.r': 'r',
    };

    return languageMap[ext] || 'plaintext';
  }

  /**
   * Analyze the symbol at the given position
   */
  private async analyzeSymbol(
    content: string,
    lines: string[],
    lineIndex: number,
    character: number,
    language: string
  ): Promise<HoverInfo | null> {
    const line = lines[lineIndex];

    // Find the symbol at the character position
    const symbol = this.extractSymbolAtPosition(line, character, language);

    if (!symbol) {
      return null;
    }

    // Analyze the symbol based on language
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.analyzeJavaScriptSymbol(content, lines, symbol, lineIndex, character);
      case 'python':
        return this.analyzePythonSymbol(content, lines, symbol, lineIndex, character);
      default:
        return this.analyzeGenericSymbol(symbol, language);
    }
  }

  /**
   * Extract symbol at the given character position
   */
  private extractSymbolAtPosition(
    line: string,
    character: number,
    language: string
  ): string | null {
    // Find word boundaries based on language
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

    if (words.length === 0) {
      return null;
    }

    // Find which word contains the character position
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
        // Match identifiers, including those with dots and brackets
        return /\b\w+(?:\.\w+)*(?:\[[^\]]*\])*\b/g;
      case 'python':
        // Match Python identifiers, including those with underscores and dots
        return /\b[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\b/g;
      default:
        return /\b[a-zA-Z_]\w*\b/g;
    }
  }

  /**
   * Analyze JavaScript/TypeScript symbol
   */
  private analyzeJavaScriptSymbol(
    content: string,
    _lines: string[],
    symbol: string,
    _lineIndex: number,
    _character: number
  ): HoverInfo {
    const hoverInfo: HoverInfo = {
      symbol,
      type: 'unknown',
      documentation: `Symbol: ${symbol}`,
    };

    // Check if it's a function declaration
    const functionMatch = this.findFunctionDeclaration(content, symbol);
    if (functionMatch) {
      hoverInfo.type = 'function';
      hoverInfo.documentation = `function ${symbol}${functionMatch.signature}`;
      if (functionMatch.documentation) {
        hoverInfo.documentation += `\n\n${functionMatch.documentation}`;
      }
      hoverInfo.range = functionMatch.range;
      hoverInfo.definition = functionMatch.definition;
      return hoverInfo;
    }

    // Check if it's a class declaration
    const classMatch = this.findClassDeclaration(content, symbol);
    if (classMatch) {
      hoverInfo.type = 'class';
      hoverInfo.documentation = `class ${symbol}`;
      if (classMatch.documentation) {
        hoverInfo.documentation += `\n\n${classMatch.documentation}`;
      }
      hoverInfo.range = classMatch.range;
      hoverInfo.definition = classMatch.definition;
      return hoverInfo;
    }

    // Check if it's a variable/constant declaration
    const variableMatch = this.findVariableDeclaration(content, symbol);
    if (variableMatch) {
      hoverInfo.type = variableMatch.kind;
      hoverInfo.documentation = `${variableMatch.kind} ${symbol}: ${variableMatch.type ?? 'any'}`;
      if (variableMatch.documentation) {
        hoverInfo.documentation += `\n\n${variableMatch.documentation}`;
      }
      hoverInfo.range = variableMatch.range;
      return hoverInfo;
    }

    // Check if it's an import
    const importMatch = this.findImport(content, symbol);
    if (importMatch) {
      hoverInfo.type = 'import';
      hoverInfo.documentation = `Imported from: ${importMatch.from}`;
      hoverInfo.range = importMatch.range;
      return hoverInfo;
    }

    // Generic symbol info
    hoverInfo.type = 'identifier';
    hoverInfo.documentation = `Identifier: ${symbol}`;

    return hoverInfo;
  }

  /**
   * Analyze Python symbol
   */
  private analyzePythonSymbol(
    content: string,
    _lines: string[],
    symbol: string,
    _lineIndex: number,
    _character: number
  ): HoverInfo {
    const hoverInfo: HoverInfo = {
      symbol,
      type: 'unknown',
      documentation: `Symbol: ${symbol}`,
    };

    // Check if it's a function definition
    const functionMatch = this.findPythonFunction(content, symbol);
    if (functionMatch) {
      hoverInfo.type = 'function';
      hoverInfo.documentation = `def ${symbol}${functionMatch.signature}`;
      if (functionMatch.documentation) {
        hoverInfo.documentation += `\n\n${functionMatch.documentation}`;
      }
      hoverInfo.range = functionMatch.range;
      hoverInfo.definition = functionMatch.definition;
      return hoverInfo;
    }

    // Check if it's a class definition
    const classMatch = this.findPythonClass(content, symbol);
    if (classMatch) {
      hoverInfo.type = 'class';
      hoverInfo.documentation = `class ${symbol}`;
      if (classMatch.documentation) {
        hoverInfo.documentation += `\n\n${classMatch.documentation}`;
      }
      hoverInfo.range = classMatch.range;
      hoverInfo.definition = classMatch.definition;
      return hoverInfo;
    }

    // Check if it's a variable assignment
    const variableMatch = this.findPythonVariable(content, symbol);
    if (variableMatch) {
      hoverInfo.type = 'variable';
      hoverInfo.documentation = `Variable: ${symbol}`;
      if (variableMatch.type) {
        hoverInfo.documentation += ` (${variableMatch.type})`;
      }
      hoverInfo.range = variableMatch.range;
      return hoverInfo;
    }

    return hoverInfo;
  }

  /**
   * Analyze generic symbol
   */
  private analyzeGenericSymbol(symbol: string, language: string): HoverInfo {
    return {
      symbol,
      type: 'identifier',
      documentation: `Symbol: ${symbol} (${language})`,
    };
  }

  /**
   * Find function declaration in JavaScript/TypeScript
   */
  private findFunctionDeclaration(content: string, symbol: string): FunctionMatch | null {
    // Match function declarations, arrow functions, and method definitions
    const patterns = [
      // Function declaration: function name(...) {
      new RegExp(`function\\s+${symbol}\\s*\\(([^)]*)\\)`, 'g'),
      // Arrow function: const name = (...) => {
      new RegExp(`(?:const|let|var)\\s+${symbol}\\s*=\\s*\\(([^)]*)\\)\\s*=>`, 'g'),
      // Method: name(...) {
      new RegExp(`${symbol}\\s*\\(([^)]*)\\)\\s*\\{`, 'g'),
      // Class method: name(...) {
      new RegExp(`\\b${symbol}\\s*\\(([^)]*)\\)\\s*\\{`, 'g'),
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const signature = `(${match[1] || ''})`;
        const startPos = match.index;
        const endPos = startPos + match[0].length;

        // Extract JSDoc comments
        const documentation = this.extractJSDocComment(content, startPos);

        return {
          signature,
          documentation,
          range: {
            start: this.getPositionFromOffset(content, startPos),
            end: this.getPositionFromOffset(content, endPos),
          },
          definition: {
            file: '', // Current file
            range: {
              start: this.getPositionFromOffset(content, startPos),
              end: this.getPositionFromOffset(content, endPos),
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * Find class declaration in JavaScript/TypeScript
   */
  private findClassDeclaration(content: string, symbol: string): ClassMatch | null {
    const pattern = new RegExp(`class\\s+${symbol}\\b`, 'g');
    const match = pattern.exec(content);

    if (match) {
      const startPos = match.index;
      const endPos = startPos + match[0].length;

      // Extract JSDoc comments
      const documentation = this.extractJSDocComment(content, startPos);

      return {
        documentation,
        range: {
          start: this.getPositionFromOffset(content, startPos),
          end: this.getPositionFromOffset(content, endPos),
        },
        definition: {
          file: '', // Current file
          range: {
            start: this.getPositionFromOffset(content, startPos),
            end: this.getPositionFromOffset(content, endPos),
          },
        },
      };
    }

    return null;
  }

  /**
   * Find variable declaration in JavaScript/TypeScript
   */
  private findVariableDeclaration(content: string, symbol: string): VariableMatch | null {
    const patterns = [
      // const/let/var declaration with optional type
      new RegExp(`(?:const|let|var)\\s+${symbol}\\s*(?::\\s*([^;=]+))?\\s*=`, 'g'),
      // Type-only declaration (TypeScript)
      new RegExp(`${symbol}\\s*:\\s*([^;=]+)`, 'g'),
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        const startPos = match.index;
        const endPos = startPos + symbol.length;

        return {
          kind: match[0].includes('const')
            ? 'const'
            : match[0].includes('let')
              ? 'let'
              : 'variable',
          type: match[1]?.trim(),
          range: {
            start: this.getPositionFromOffset(content, startPos),
            end: this.getPositionFromOffset(content, endPos),
          },
        };
      }
    }

    return null;
  }

  /**
   * Find import in JavaScript/TypeScript
   */
  private findImport(content: string, symbol: string): ImportMatch | null {
    const patterns = [
      // import { symbol } from 'module'
      new RegExp(`import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`, 'g'),
      // import symbol from 'module'
      new RegExp(`import\\s+${symbol}\\s+from\\s*['"]([^'"]+)['"]`, 'g'),
      // import * as symbol from 'module'
      new RegExp(`import\\s*\\*\\s+as\\s+${symbol}\\s+from\\s*['"]([^'"]+)['"]`, 'g'),
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        const startPos = match.index;
        const endPos = startPos + match[0].length;

        return {
          from: match[1],
          range: {
            start: this.getPositionFromOffset(content, startPos),
            end: this.getPositionFromOffset(content, endPos),
          },
        };
      }
    }

    return null;
  }

  /**
   * Find Python function definition
   */
  private findPythonFunction(content: string, symbol: string): FunctionMatch | null {
    const pattern = new RegExp(`def\\s+${symbol}\\s*\\(([^)]*)\\)`, 'g');
    const match = pattern.exec(content);

    if (match) {
      const signature = `(${match[1] || ''})`;
      const startPos = match.index;
      const endPos = startPos + match[0].length;

      // Extract docstring
      const documentation = this.extractPythonDocstring(content, startPos);

      return {
        signature,
        documentation,
        range: {
          start: this.getPositionFromOffset(content, startPos),
          end: this.getPositionFromOffset(content, endPos),
        },
        definition: {
          file: '', // Current file
          range: {
            start: this.getPositionFromOffset(content, startPos),
            end: this.getPositionFromOffset(content, endPos),
          },
        },
      };
    }

    return null;
  }

  /**
   * Find Python class definition
   */
  private findPythonClass(content: string, symbol: string): ClassMatch | null {
    const pattern = new RegExp(`class\\s+${symbol}\\b`, 'g');
    const match = pattern.exec(content);

    if (match) {
      const startPos = match.index;
      const endPos = startPos + match[0].length;

      // Extract docstring
      const documentation = this.extractPythonDocstring(content, startPos);

      return {
        documentation,
        range: {
          start: this.getPositionFromOffset(content, startPos),
          end: this.getPositionFromOffset(content, endPos),
        },
        definition: {
          file: '', // Current file
          range: {
            start: this.getPositionFromOffset(content, startPos),
            end: this.getPositionFromOffset(content, endPos),
          },
        },
      };
    }

    return null;
  }

  /**
   * Find Python variable assignment
   */
  private findPythonVariable(content: string, symbol: string): VariableMatch | null {
    const pattern = new RegExp(`${symbol}\\s*=`, 'g');
    const match = pattern.exec(content);

    if (match) {
      const startPos = match.index;
      const endPos = startPos + symbol.length;

      return {
        kind: 'variable',
        range: {
          start: this.getPositionFromOffset(content, startPos),
          end: this.getPositionFromOffset(content, endPos),
        },
      };
    }

    return null;
  }

  /**
   * Extract JSDoc comment
   */
  private extractJSDocComment(content: string, position: number): string | undefined {
    // Look backwards for /** */ comments
    const beforeContent = content.substring(0, position);
    const lines = beforeContent.split('\n');
    const commentLines: string[] = [];

    // Look for JSDoc comment ending just before the position
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();

      if (line === '*/' && i > 0 && lines[i - 1].trim().startsWith('/**')) {
        // Found the start of JSDoc comment
        for (let j = i - 1; j < lines.length && !lines[j].trim().startsWith('*/'); j++) {
          const commentLine = lines[j].trim();
          if (commentLine.startsWith('/**') || commentLine.startsWith('*')) {
            const cleanLine = commentLine
              .replace(/\/\*\*/, '')
              .replace(/\*\//, '')
              .replace(/^\*\s*/, '')
              .trim();
            if (cleanLine) {
              commentLines.unshift(cleanLine);
            }
          }
        }
        break;
      }
    }

    return commentLines.length > 0 ? commentLines.join('\n') : undefined;
  }

  /**
   * Extract Python docstring
   */
  private extractPythonDocstring(content: string, position: number): string | undefined {
    // Look for triple-quoted strings after the definition
    const afterContent = content.substring(position);
    const docstringMatch = afterContent.match(/""".*?"""/s) ?? afterContent.match(/'''.*?'''/s);

    if (docstringMatch) {
      return docstringMatch[0].slice(3, -3).trim();
    }

    return undefined;
  }

  /**
   * Get position from character offset
   */
  private getPositionFromOffset(
    content: string,
    offset: number
  ): { line: number; character: number } {
    const beforeOffset = content.substring(0, offset);
    const lines = beforeOffset.split('\n');
    const line = lines.length - 1;
    const character = lines[line].length;

    return { line, character };
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
}

interface HoverInfo {
  symbol: string;
  type: string;
  documentation: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  definition?: {
    file: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
}

interface FunctionMatch {
  signature: string;
  documentation?: string | undefined;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  definition: {
    file: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
}

interface ClassMatch {
  documentation?: string | undefined;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  definition: {
    file: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
}

interface VariableMatch {
  kind: string;
  type?: string;
  documentation?: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface ImportMatch {
  from: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
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
