import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP Code Actions Tool for accessing code actions (quick fixes, refactors)
 * Provides suggestions for code improvements, fixes, and refactoring operations
 */
export class LSPActionsTool implements Tool {
  name = 'lsp-actions';
  description =
    'Access LSP code actions including quick fixes, refactoring suggestions, and code improvements. Get contextual suggestions for improving code quality.';

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
      description: 'Line number (1-based) to get actions for',
      required: false,
    },
    {
      name: 'character',
      type: 'number',
      description: 'Character position (0-based) within the line',
      required: false,
    },
    {
      name: 'startLine',
      type: 'number',
      description: 'Start line of range (1-based) for multi-line selection',
      required: false,
    },
    {
      name: 'endLine',
      type: 'number',
      description: 'End line of range (1-based) for multi-line selection',
      required: false,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Programming language (typescript, javascript, python, go, etc.)',
      required: false,
    },
    {
      name: 'actionKind',
      type: 'string',
      description:
        'Filter by action kind: quickfix, refactor, source, all (default: all)',
      required: false,
      defaultValue: 'all',
    },
    {
      name: 'applyAction',
      type: 'string',
      description: 'Title of the action to apply (if not set, returns available actions)',
      required: false,
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        file: filePath,
        line,
        character,
        startLine,
        endLine,
        language,
        actionKind = 'all',
        applyAction,
      } = params;

      // Validate required parameters
      if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
        throw new Error('File parameter is required and must be a non-empty string');
      }

      // Validate file access
      const validatedPath = await securityManager.validateFileOperation(filePath, 'read');

      // Read file content
      const content = await fs.promises.readFile(validatedPath, 'utf-8');
      const lines = content.split('\n');

      // Determine the range
      let range: CodeRange;
      if (startLine && endLine) {
        range = {
          start: { line: startLine - 1, character: 0 },
          end: { line: endLine - 1, character: lines[endLine - 1]?.length || 0 },
        };
      } else if (line) {
        range = {
          start: { line: line - 1, character: character || 0 },
          end: { line: line - 1, character: lines[line - 1]?.length || 0 },
        };
      } else {
        // Analyze entire file
        range = {
          start: { line: 0, character: 0 },
          end: { line: lines.length - 1, character: lines[lines.length - 1]?.length || 0 },
        };
      }

      // Validate range
      if (range.start.line >= lines.length || range.end.line >= lines.length) {
        throw new Error(
          `Line range (${range.start.line + 1}-${range.end.line + 1}) is beyond end of file (${lines.length} lines)`
        );
      }

      // Detect language if not provided
      const detectedLanguage = language ?? this.detectLanguage(filePath);

      // Get code actions for the range
      const actions = await this.getCodeActions(
        content,
        lines,
        range,
        detectedLanguage,
        validatedPath,
        actionKind
      );

      // Apply action if requested
      if (applyAction) {
        const action = actions.find(
          a => a.title.toLowerCase() === applyAction.toLowerCase()
        );

        if (!action) {
          return {
            success: false,
            error: `Action '${applyAction}' not found. Available actions: ${actions.map(a => a.title).join(', ')}`,
          };
        }

        const result = await this.applyAction(action, content, lines, validatedPath);

        return {
          success: true,
          data: {
            applied: true,
            action: action.title,
            result,
          },
          metadata: {
            language: detectedLanguage,
            file: filePath,
          },
        };
      }

      // Group actions by kind
      const actionsByKind = this.groupActionsByKind(actions);

      return {
        success: true,
        data: {
          file: filePath,
          range: {
            start: { line: range.start.line + 1, character: range.start.character },
            end: { line: range.end.line + 1, character: range.end.character },
          },
          totalActions: actions.length,
          actions,
          actionsByKind,
        },
        metadata: {
          language: detectedLanguage,
          actionKindFilter: actionKind,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while getting code actions',
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
   * Get code actions for a range
   */
  private async getCodeActions(
    content: string,
    lines: string[],
    range: CodeRange,
    language: string,
    filePath: string,
    actionKind: string
  ): Promise<CodeAction[]> {
    const actions: CodeAction[] = [];

    // Analyze the range for potential actions
    for (let i = range.start.line; i <= range.end.line; i++) {
      const line = lines[i];
      const lineActions = this.analyzeLineForActions(line, i, language, filePath, content);
      actions.push(...lineActions);
    }

    // Add file-level actions
    const fileActions = this.getFileActions(content, lines, language, filePath);
    actions.push(...fileActions);

    // Filter by action kind
    if (actionKind !== 'all') {
      return actions.filter(a => a.kind === actionKind);
    }

    return actions;
  }

  /**
   * Analyze a line for potential code actions
   */
  private analyzeLineForActions(
    line: string,
    lineIndex: number,
    language: string,
    _filePath: string,
    content: string
  ): CodeAction[] {
    const actions: CodeAction[] = [];
    const trimmed = line.trim();

    switch (language) {
      case 'typescript':
      case 'javascript':
        actions.push(...this.getJSActions(line, lineIndex, trimmed, content));
        break;
      case 'python':
        actions.push(...this.getPythonActions(line, lineIndex, trimmed, content));
        break;
      case 'go':
        actions.push(...this.getGoActions(line, lineIndex, trimmed, content));
        break;
    }

    return actions;
  }

  /**
   * Get JavaScript/TypeScript specific actions
   */
  private getJSActions(
    line: string,
    lineIndex: number,
    trimmed: string,
    _content: string
  ): CodeAction[] {
    const actions: CodeAction[] = [];

    // console.log removal
    if (trimmed.includes('console.log')) {
      actions.push({
        title: 'Remove console.log',
        kind: 'quickfix',
        description: 'Remove this console.log statement',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'delete',
          lineIndex,
        },
      });
    }

    // var to const/let
    if (trimmed.startsWith('var ')) {
      actions.push({
        title: 'Convert var to const',
        kind: 'refactor',
        description: 'Replace var with const for better scoping',
        range: {
          start: { line: lineIndex, character: line.indexOf('var') },
          end: { line: lineIndex, character: line.indexOf('var') + 3 },
        },
        edit: {
          type: 'replace',
          lineIndex,
          oldText: 'var',
          newText: 'const',
        },
      });

      actions.push({
        title: 'Convert var to let',
        kind: 'refactor',
        description: 'Replace var with let for better scoping',
        range: {
          start: { line: lineIndex, character: line.indexOf('var') },
          end: { line: lineIndex, character: line.indexOf('var') + 3 },
        },
        edit: {
          type: 'replace',
          lineIndex,
          oldText: 'var',
          newText: 'let',
        },
      });
    }

    // Function to arrow function
    const functionMatch = trimmed.match(/^function\s+(\w+)\s*\(/);
    if (functionMatch) {
      actions.push({
        title: 'Convert to arrow function',
        kind: 'refactor',
        description: 'Convert function declaration to arrow function',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'convertToArrow',
          lineIndex,
          functionName: functionMatch[1],
        },
      });
    }

    // Add missing semicolon
    if (
      trimmed.length > 0 &&
      !trimmed.endsWith(';') &&
      !trimmed.endsWith('{') &&
      !trimmed.endsWith('}') &&
      !trimmed.endsWith(',') &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('/*') &&
      !trimmed.startsWith('*')
    ) {
      actions.push({
        title: 'Add semicolon',
        kind: 'quickfix',
        description: 'Add missing semicolon at end of line',
        range: {
          start: { line: lineIndex, character: line.length },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'insert',
          lineIndex,
          position: line.length,
          text: ';',
        },
      });
    }

    // Extract to variable
    const stringLiteralMatch = line.match(/"([^"]{10,})"|'([^']{10,})'/);
    if (stringLiteralMatch) {
      actions.push({
        title: 'Extract to constant',
        kind: 'refactor',
        description: 'Extract string literal to a named constant',
        range: {
          start: { line: lineIndex, character: line.indexOf(stringLiteralMatch[0]) },
          end: {
            line: lineIndex,
            character: line.indexOf(stringLiteralMatch[0]) + stringLiteralMatch[0].length,
          },
        },
        edit: {
          type: 'extractVariable',
          lineIndex,
          text: stringLiteralMatch[0],
        },
      });
    }

    // Add TODO comment
    if (trimmed.includes('TODO') || trimmed.includes('FIXME')) {
      actions.push({
        title: 'Convert TODO to issue',
        kind: 'source',
        description: 'Convert TODO comment to a trackable issue',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'createIssue',
          lineIndex,
          content: trimmed,
        },
      });
    }

    return actions;
  }

  /**
   * Get Python specific actions
   */
  private getPythonActions(
    line: string,
    lineIndex: number,
    trimmed: string,
    _content: string
  ): CodeAction[] {
    const actions: CodeAction[] = [];

    // print statement removal
    if (trimmed.match(/^print\s*\(/)) {
      actions.push({
        title: 'Remove print statement',
        kind: 'quickfix',
        description: 'Remove this print statement',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'delete',
          lineIndex,
        },
      });

      actions.push({
        title: 'Convert print to logging',
        kind: 'refactor',
        description: 'Replace print with logging.info',
        range: {
          start: { line: lineIndex, character: line.indexOf('print') },
          end: { line: lineIndex, character: line.indexOf('print') + 5 },
        },
        edit: {
          type: 'replace',
          lineIndex,
          oldText: 'print',
          newText: 'logging.info',
        },
      });
    }

    // Add type hints
    const defMatch = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (defMatch && !defMatch[0].includes('->')) {
      actions.push({
        title: 'Add return type hint',
        kind: 'refactor',
        description: 'Add return type annotation',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'addTypeHint',
          lineIndex,
          functionName: defMatch[1],
        },
      });
    }

    // Convert string formatting
    if (trimmed.includes('%s') || trimmed.includes('%d') || trimmed.includes('%f')) {
      actions.push({
        title: 'Convert to f-string',
        kind: 'refactor',
        description: 'Convert % formatting to f-string',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'convertToFString',
          lineIndex,
        },
      });
    }

    return actions;
  }

  /**
   * Get Go specific actions
   */
  private getGoActions(
    line: string,
    lineIndex: number,
    trimmed: string,
    _content: string
  ): CodeAction[] {
    const actions: CodeAction[] = [];

    // fmt.Println removal
    if (trimmed.includes('fmt.Println') || trimmed.includes('fmt.Printf')) {
      actions.push({
        title: 'Remove fmt.Print statement',
        kind: 'quickfix',
        description: 'Remove this debug print statement',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'delete',
          lineIndex,
        },
      });
    }

    // Error handling
    if (trimmed.includes('err != nil') && !trimmed.includes('return')) {
      actions.push({
        title: 'Add error return',
        kind: 'quickfix',
        description: 'Add return statement for error',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'addErrorReturn',
          lineIndex,
        },
      });
    }

    // Named return values
    const funcMatch = trimmed.match(/^func\s+(\w+)\s*\([^)]*\)\s+(\w+)\s*\{/);
    if (funcMatch) {
      actions.push({
        title: 'Add named return',
        kind: 'refactor',
        description: 'Convert to named return value',
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        edit: {
          type: 'addNamedReturn',
          lineIndex,
          returnType: funcMatch[2],
        },
      });
    }

    return actions;
  }

  /**
   * Get file-level actions
   */
  private getFileActions(
    content: string,
    lines: string[],
    language: string,
    _filePath: string
  ): CodeAction[] {
    const actions: CodeAction[] = [];

    switch (language) {
      case 'typescript':
      case 'javascript': {
        // Organize imports
        const hasImports = lines.some(l => l.trim().startsWith('import'));
        if (hasImports) {
          actions.push({
            title: 'Organize imports',
            kind: 'source',
            description: 'Sort and organize import statements',
            range: {
              start: { line: 0, character: 0 },
              end: { line: lines.length - 1, character: lines[lines.length - 1].length },
            },
            edit: {
              type: 'organizeImports',
            },
          });
        }

        // Add missing imports
        const undefinedSymbols = this.findUndefinedSymbols(content, language);
        if (undefinedSymbols.length > 0) {
          actions.push({
            title: 'Add missing imports',
            kind: 'quickfix',
            description: `Add imports for: ${undefinedSymbols.join(', ')}`,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            edit: {
              type: 'addImports',
              symbols: undefinedSymbols,
            },
          });
        }
        break;
      }

      case 'python': {
        // Add docstring
        const hasFunctions = lines.some(l => l.trim().startsWith('def '));
        const hasDocstring = content.includes('"""') || content.includes("'''");
        if (hasFunctions && !hasDocstring) {
          actions.push({
            title: 'Add docstrings',
            kind: 'source',
            description: 'Add docstrings to functions',
            range: {
              start: { line: 0, character: 0 },
              end: { line: lines.length - 1, character: lines[lines.length - 1].length },
            },
            edit: {
              type: 'addDocstrings',
            },
          });
        }
        break;
      }
    }

    return actions;
  }

  /**
   * Find potentially undefined symbols (simplified)
   */
  private findUndefinedSymbols(content: string, _language: string): string[] {
    const symbols: string[] = [];

    // This is a simplified check - a real implementation would use proper parsing
    const commonUndefined = ['React', 'useState', 'useEffect', 'fs', 'path', 'console'];

    for (const symbol of commonUndefined) {
      const usagePattern = new RegExp(`\\b${symbol}\\b`);
      const importPattern = new RegExp(`import.*\\b${symbol}\\b`);

      if (usagePattern.test(content) && !importPattern.test(content)) {
        // Check if it's defined locally
        const defPatterns = [
          new RegExp(`(?:const|let|var|function|class)\\s+${symbol}\\b`),
        ];
        const isDefined = defPatterns.some(p => p.test(content));

        if (!isDefined && symbol !== 'console') {
          symbols.push(symbol);
        }
      }
    }

    return symbols;
  }

  /**
   * Apply a code action
   */
  private async applyAction(
    action: CodeAction,
    _content: string,
    lines: string[],
    filePath: string
  ): Promise<{ modified: boolean; description: string }> {
    if (!action.edit) {
      return { modified: false, description: 'Action has no edit' };
    }

    const edit = action.edit;
    let modified = false;
    let description = '';

    switch (edit.type) {
      case 'delete':
        if (edit.lineIndex !== undefined) {
          lines.splice(edit.lineIndex, 1);
          modified = true;
          description = `Deleted line ${edit.lineIndex + 1}`;
        }
        break;

      case 'replace':
        if (edit.lineIndex !== undefined && edit.oldText && edit.newText) {
          lines[edit.lineIndex] = lines[edit.lineIndex].replace(edit.oldText, edit.newText);
          modified = true;
          description = `Replaced '${edit.oldText}' with '${edit.newText}'`;
        }
        break;

      case 'insert':
        if (edit.lineIndex !== undefined && edit.position !== undefined && edit.text) {
          const line = lines[edit.lineIndex];
          lines[edit.lineIndex] =
            line.substring(0, edit.position) + edit.text + line.substring(edit.position);
          modified = true;
          description = `Inserted '${edit.text}'`;
        }
        break;

      default:
        description = `Action type '${edit.type}' would require additional implementation`;
        break;
    }

    if (modified) {
      await securityManager.validateFileOperation(filePath, 'write');
      await fs.promises.writeFile(filePath, lines.join('\n'), 'utf-8');
    }

    return { modified, description };
  }

  /**
   * Group actions by kind
   */
  private groupActionsByKind(actions: CodeAction[]): Record<string, CodeAction[]> {
    const grouped: Record<string, CodeAction[]> = {};

    for (const action of actions) {
      if (!grouped[action.kind]) {
        grouped[action.kind] = [];
      }
      grouped[action.kind].push(action);
    }

    return grouped;
  }
}

interface CodeRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

interface CodeAction {
  title: string;
  kind: 'quickfix' | 'refactor' | 'source';
  description: string;
  range: CodeRange;
  edit?: {
    type: string;
    lineIndex?: number;
    oldText?: string;
    newText?: string;
    position?: number;
    text?: string;
    symbols?: string[];
    functionName?: string;
    returnType?: string;
    content?: string;
  };
}
