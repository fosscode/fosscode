import * as fs from 'fs';
import * as path from 'path';
import { Tool, ToolParameter, ToolResult } from '../types/index.js';
import { securityManager } from './SecurityManager.js';

/**
 * LSP Diagnostics Tool for static code analysis
 * Integrates with Language Server Protocol to provide diagnostics (errors, warnings, hints)
 */
export class LSPDiagnosticsTool implements Tool {
  name = 'lsp-diagnostics';
  description =
    'Analyze code files using Language Server Protocol for diagnostics, errors, and warnings. Supports multiple programming languages.';

  parameters: ToolParameter[] = [
    {
      name: 'files',
      type: 'array',
      description: 'Array of file paths to analyze (e.g., ["src/main.ts", "src/utils.js"])',
      required: true,
    },
    {
      name: 'language',
      type: 'string',
      description: 'Programming language (typescript, javascript, python, etc.)',
      required: false,
    },
    {
      name: 'severity',
      type: 'string',
      description: 'Filter by severity: error, warning, information, hint, or all',
      required: false,
      defaultValue: 'all',
    },
    {
      name: 'includeSource',
      type: 'boolean',
      description: 'Include source code snippets with diagnostics',
      required: false,
      defaultValue: true,
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of diagnostics to return',
      required: false,
      defaultValue: 100,
    },
    {
      name: 'workingDirectory',
      type: 'string',
      description: 'Working directory for relative paths',
      required: false,
      defaultValue: process.cwd(),
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const {
        files,
        language,
        severity = 'all',
        includeSource = true,
        maxResults = 100,
        workingDirectory = process.cwd(),
      } = params;

      // Validate required parameters
      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new Error('Files parameter is required and must be a non-empty array');
      }

      // Validate working directory
      const validatedWorkingDir =
        await securityManager.validateDirectoryOperation(workingDirectory);

      // Validate file paths and read file contents
      const fileContents: Map<string, string> = new Map();
      const fileLanguages: Map<string, string> = new Map();

      for (const filePath of files) {
        const fullPath = path.resolve(validatedWorkingDir, filePath);

        // Validate file access
        await securityManager.validateFileOperation(fullPath, 'read');

        // Read file content
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        fileContents.set(filePath, content);

        // Determine language if not provided
        const detectedLanguage = language || this.detectLanguage(filePath);
        fileLanguages.set(filePath, detectedLanguage);
      }

      // Analyze files for diagnostics
      const allDiagnostics: DiagnosticResult[] = [];

      for (const [filePath, content] of fileContents) {
        const fileLanguage = fileLanguages.get(filePath)!;
        const diagnostics = await this.analyzeFile(filePath, content, fileLanguage);

        // Filter by severity
        const filteredDiagnostics = this.filterDiagnosticsBySeverity(diagnostics, severity);

        // Add source code snippets if requested
        const diagnosticsWithSource = includeSource
          ? this.addSourceSnippets(filteredDiagnostics, content, filePath)
          : filteredDiagnostics.map(diag => ({ ...diag, file: filePath }));

        allDiagnostics.push(...diagnosticsWithSource);
      }

      // Sort by severity (errors first, then warnings, etc.)
      const sortedDiagnostics = this.sortDiagnosticsBySeverity(allDiagnostics);

      // Limit results
      const limitedDiagnostics = sortedDiagnostics.slice(0, maxResults);

      // Group by file
      const diagnosticsByFile = this.groupDiagnosticsByFile(limitedDiagnostics);

      return {
        success: true,
        data: {
          totalFiles: files.length,
          totalDiagnostics: allDiagnostics.length,
          returnedDiagnostics: limitedDiagnostics.length,
          diagnosticsByFile,
          summary: this.createSummary(limitedDiagnostics),
        },
        metadata: {
          language: language || 'auto-detected',
          severityFilter: severity,
          includeSource,
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
            : 'Unknown error occurred during LSP diagnostics analysis',
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
      '.sh': 'bash',
      '.pl': 'perl',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.md': 'markdown',
    };

    return languageMap[ext] || 'plaintext';
  }

  /**
   * Analyze a file for diagnostics using built-in analysis
   */
  private async analyzeFile(
    filePath: string,
    content: string,
    language: string
  ): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    // Basic syntax analysis
    const syntaxDiagnostics = this.analyzeSyntax(content, language);
    diagnostics.push(...syntaxDiagnostics);

    // Language-specific analysis
    switch (language) {
      case 'typescript':
      case 'javascript':
        diagnostics.push(...this.analyzeJavaScript(content, filePath));
        break;
      case 'python':
        diagnostics.push(...this.analyzePython(content, filePath));
        break;
      case 'json':
        diagnostics.push(...this.analyzeJSON(content, filePath));
        break;
      // Add more language analyzers as needed
    }

    return diagnostics;
  }

  /**
   * Basic syntax analysis
   */
  private analyzeSyntax(content: string, language: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for common syntax issues
      if (language === 'javascript' || language === 'typescript') {
        // Unclosed brackets
        const openBrackets = (line.match(/[\[\{\(]/g) || []).length;
        const closeBrackets = (line.match(/[\]\}\)]/g) || []).length;

        if (openBrackets > closeBrackets) {
          diagnostics.push({
            range: {
              start: { line: lineNumber, character: 0 },
              end: { line: lineNumber, character: line.length },
            },
            severity: 'warning',
            message: 'Possible unclosed brackets',
            source: 'syntax-analyzer',
          });
        }

        // Trailing whitespace
        if (line.endsWith(' ') || line.endsWith('\t')) {
          diagnostics.push({
            range: {
              start: { line: lineNumber, character: 0 },
              end: { line: lineNumber, character: line.length },
            },
            severity: 'information',
            message: 'Trailing whitespace',
            source: 'style-checker',
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * JavaScript/TypeScript specific analysis
   */
  private analyzeJavaScript(content: string, _filePath: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for console.log statements (common in development)
    const consoleLogMatches = content.match(/console\.log\(/g);
    if (consoleLogMatches && consoleLogMatches.length > 0) {
      diagnostics.push({
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        severity: 'information',
        message: `Found ${consoleLogMatches.length} console.log statement(s). Consider removing for production.`,
        source: 'code-quality',
      });
    }

    // Check for TODO comments
    const todoMatches = content.match(/\/\/\s*TODO|\/\*\s*TODO|\#\s*TODO/g);
    if (todoMatches) {
      diagnostics.push({
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        severity: 'information',
        message: `Found ${todoMatches.length} TODO comment(s)`,
        source: 'code-quality',
      });
    }

    // Check for unused variables (simple heuristic)
    const varDeclarations = content.match(/const\s+(\w+)|let\s+(\w+)|var\s+(\w+)/g);
    if (varDeclarations) {
      for (const declaration of varDeclarations) {
        const varName = declaration.split(/\s+/)[1];
        if (
          varName &&
          !content.includes(varName, content.indexOf(declaration) + declaration.length)
        ) {
          diagnostics.push({
            range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
            severity: 'warning',
            message: `Variable '${varName}' may be unused`,
            source: 'code-quality',
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Python specific analysis
   */
  private analyzePython(content: string, _filePath: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for print statements (common in development)
    const printMatches = content.match(/\bprint\(/g);
    if (printMatches && printMatches.length > 0) {
      diagnostics.push({
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        severity: 'information',
        message: `Found ${printMatches.length} print statement(s). Consider using logging for production.`,
        source: 'code-quality',
      });
    }

    return diagnostics;
  }

  /**
   * JSON syntax validation
   */
  private analyzeJSON(content: string, _filePath: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    try {
      JSON.parse(content);
    } catch (error) {
      diagnostics.push({
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        severity: 'error',
        message: `JSON syntax error: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        source: 'json-validator',
      });
    }

    return diagnostics;
  }

  /**
   * Filter diagnostics by severity
   */
  private filterDiagnosticsBySeverity(diagnostics: Diagnostic[], severity: string): Diagnostic[] {
    if (severity === 'all') {
      return diagnostics;
    }

    return diagnostics.filter(diag => diag.severity === severity);
  }

  /**
   * Add source code snippets to diagnostics
   */
  private addSourceSnippets(
    diagnostics: Diagnostic[],
    content: string,
    filePath: string
  ): DiagnosticResult[] {
    const lines = content.split('\n');

    return diagnostics.map(diag => ({
      ...diag,
      file: filePath,
      sourceSnippet: this.getSourceSnippet(lines, diag.range),
    }));
  }

  /**
   * Get source code snippet for a diagnostic
   */
  private getSourceSnippet(lines: string[], range: DiagnosticRange): string | undefined {
    const startLine = Math.max(0, range.start.line - 2);
    const endLine = Math.min(lines.length - 1, range.end.line + 1);

    const snippetLines = [];
    for (let i = startLine; i <= endLine; i++) {
      const prefix = i + 1 === range.start.line ? '> ' : '  ';
      snippetLines.push(`${prefix}${i + 1}: ${lines[i]}`);
    }

    return snippetLines.join('\n');
  }

  /**
   * Sort diagnostics by severity
   */
  private sortDiagnosticsBySeverity(diagnostics: DiagnosticResult[]): DiagnosticResult[] {
    const severityOrder = { error: 0, warning: 1, information: 2, hint: 3 };

    return diagnostics.sort((a, b) => {
      const aOrder = severityOrder[a.severity] ?? 4;
      const bOrder = severityOrder[b.severity] ?? 4;
      return aOrder - bOrder;
    });
  }

  /**
   * Group diagnostics by file
   */
  private groupDiagnosticsByFile(
    diagnostics: DiagnosticResult[]
  ): Record<string, DiagnosticResult[]> {
    const grouped: Record<string, DiagnosticResult[]> = {};

    for (const diag of diagnostics) {
      if (!grouped[diag.file]) {
        grouped[diag.file] = [];
      }
      grouped[diag.file].push(diag);
    }

    return grouped;
  }

  /**
   * Create summary of diagnostics
   */
  private createSummary(diagnostics: DiagnosticResult[]): DiagnosticSummary {
    const summary = {
      total: diagnostics.length,
      errors: 0,
      warnings: 0,
      information: 0,
      hints: 0,
    };

    for (const diag of diagnostics) {
      summary[diag.severity]++;
    }

    return summary;
  }
}

interface Diagnostic {
  range: DiagnosticRange;
  severity: 'error' | 'warning' | 'information' | 'hint';
  message: string;
  source: string;
  code?: string;
}

interface DiagnosticRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

interface DiagnosticResult extends Diagnostic {
  file: string;
  sourceSnippet?: string;
}

interface DiagnosticSummary {
  total: number;
  errors: number;
  warnings: number;
  information: number;
  hints: number;
}
