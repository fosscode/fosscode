import { execSync } from 'child_process';
import pc from 'picocolors';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ProviderType, Message } from '../types/index.js';

/**
 * Severity levels for code review findings
 */
export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A single code review finding
 */
export interface ReviewFinding {
  severity: ReviewSeverity;
  category: string;
  file: string;
  line?: number;
  title: string;
  description: string;
  suggestion?: string;
}

/**
 * Code review result containing all findings
 */
export interface ReviewResult {
  success: boolean;
  mode: ReviewMode;
  findings: ReviewFinding[];
  summary: string;
  reviewedFiles: string[];
  totalChanges: number;
  error?: string;
}

/**
 * Available review modes/presets
 */
export type ReviewMode = 'general' | 'security' | 'performance' | 'style';

/**
 * Options for the review command
 */
export interface ReviewOptions {
  mode?: ReviewMode;
  baseBranch?: string;
  staged?: boolean;
  commit?: string;
  verbose?: boolean;
  provider?: string;
  model?: string;
}

/**
 * Review prompts for different modes
 */
const REVIEW_PROMPTS: Record<ReviewMode, string> = {
  general: `You are an expert code reviewer. Analyze the following code changes and identify potential issues.

Focus on:
- Logic errors and bugs
- Code quality and maintainability
- Best practices violations
- Error handling issues
- Potential edge cases
- Documentation issues

For each issue found, provide:
1. Severity (critical, high, medium, low)
2. Category (bug, logic, quality, best-practice, error-handling, edge-case, documentation)
3. File and line number (if identifiable)
4. Clear title
5. Detailed description
6. Suggested fix (if applicable)

Format your response as JSON array of findings:
[
  {
    "severity": "high",
    "category": "bug",
    "file": "path/to/file.ts",
    "line": 42,
    "title": "Brief issue title",
    "description": "Detailed explanation of the issue",
    "suggestion": "How to fix it"
  }
]

If no issues are found, return an empty array: []`,

  security: `You are a security-focused code reviewer. Analyze the following code changes for security vulnerabilities.

Focus on:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) vulnerabilities
- Command injection risks
- Path traversal vulnerabilities
- Sensitive data exposure
- Authentication/authorization issues
- Insecure cryptographic practices
- Dependency vulnerabilities (if visible in package changes)
- Hardcoded secrets or credentials
- CSRF vulnerabilities
- Insecure deserialization
- Race conditions
- Input validation issues

For each vulnerability found, provide:
1. Severity (critical for exploitable vulns, high for likely exploitable, medium for potential issues, low for minor concerns)
2. Category (injection, xss, auth, crypto, secrets, validation, etc.)
3. File and line number (if identifiable)
4. Clear title (e.g., "SQL Injection in user query")
5. Detailed description of the vulnerability and its impact
6. Suggested remediation

Format your response as JSON array of findings:
[
  {
    "severity": "critical",
    "category": "injection",
    "file": "path/to/file.ts",
    "line": 42,
    "title": "SQL Injection vulnerability",
    "description": "User input is directly concatenated into SQL query without sanitization",
    "suggestion": "Use parameterized queries or prepared statements"
  }
]

If no security issues are found, return an empty array: []`,

  performance: `You are a performance-focused code reviewer. Analyze the following code changes for performance issues.

Focus on:
- Algorithmic complexity (O(n^2) or worse operations)
- Memory leaks
- Unnecessary re-renders (React/UI components)
- N+1 query problems
- Unoptimized database queries
- Missing indexes (if schema changes visible)
- Blocking operations on main thread
- Large bundle size impacts
- Missing caching opportunities
- Inefficient data structures
- Unnecessary computations in loops
- Missing lazy loading/code splitting
- Resource-intensive operations

For each issue found, provide:
1. Severity (critical for severe bottlenecks, high for noticeable impact, medium for potential issues, low for minor optimizations)
2. Category (complexity, memory, rendering, query, blocking, bundle, caching, etc.)
3. File and line number (if identifiable)
4. Clear title
5. Detailed description with complexity/impact analysis
6. Optimization suggestion

Format your response as JSON array of findings:
[
  {
    "severity": "high",
    "category": "complexity",
    "file": "path/to/file.ts",
    "line": 42,
    "title": "O(n^2) loop in large dataset processing",
    "description": "Nested loop iterates over full array for each element, causing quadratic time complexity",
    "suggestion": "Use a Set or Map for O(1) lookups instead of array.includes()"
  }
]

If no performance issues are found, return an empty array: []`,

  style: `You are a code style reviewer. Analyze the following code changes for style and consistency issues.

Focus on:
- Naming conventions (variables, functions, classes)
- Code formatting issues
- Inconsistent patterns
- Missing or inconsistent type annotations (TypeScript)
- Import organization
- Dead code or unused variables
- Comment quality and placement
- File/module organization
- Magic numbers/strings
- Code duplication
- Overly complex expressions
- Missing error messages/logging
- Inconsistent API patterns

For each issue found, provide:
1. Severity (high for major inconsistencies, medium for notable issues, low for minor style issues)
2. Category (naming, formatting, types, imports, dead-code, comments, organization, duplication, etc.)
3. File and line number (if identifiable)
4. Clear title
5. Description of the style issue
6. Suggested improvement

Format your response as JSON array of findings:
[
  {
    "severity": "low",
    "category": "naming",
    "file": "path/to/file.ts",
    "line": 42,
    "title": "Inconsistent naming convention",
    "description": "Variable 'userData' uses camelCase while similar variables use snake_case",
    "suggestion": "Use consistent camelCase naming: 'userData' throughout"
  }
]

If no style issues are found, return an empty array: []`,
};

/**
 * Severity ordering for sorting
 */
const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Severity colors for output
 */
const SEVERITY_COLORS: Record<ReviewSeverity, (text: string) => string> = {
  critical: pc.red,
  high: pc.yellow,
  medium: pc.cyan,
  low: pc.gray,
};

/**
 * ReviewCommand handles the /review command for code review functionality
 */
export class ReviewCommand {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;

  constructor(configManager?: ConfigManager, providerManager?: ProviderManager) {
    this.configManager = configManager ?? new ConfigManager();
    this.providerManager = providerManager ?? new ProviderManager(this.configManager);
  }

  /**
   * Execute the review command
   */
  async execute(options: ReviewOptions = {}): Promise<ReviewResult> {
    const mode = options.mode ?? 'general';
    const verbose = options.verbose ?? false;

    if (verbose) {
      console.log(pc.cyan(`Starting ${mode} code review...`));
    }

    try {
      // Get the diff content
      const diff = await this.getDiff(options);

      if (!diff.content || diff.content.trim() === '') {
        return {
          success: true,
          mode,
          findings: [],
          summary: 'No changes to review.',
          reviewedFiles: [],
          totalChanges: 0,
        };
      }

      if (verbose) {
        console.log(pc.gray(`Reviewing ${diff.files.length} file(s)...`));
        console.log(pc.gray(`Total changes: ${diff.additions} additions, ${diff.deletions} deletions`));
      }

      // Initialize provider
      const provider = (options.provider ??
        this.configManager.getConfig().lastSelectedProvider ??
        'sonicfree') as ProviderType;
      const model =
        options.model ??
        this.configManager.getConfig().lastSelectedModel ??
        this.getDefaultModelForProvider(provider);

      await this.providerManager.initializeProvider(provider);

      // Build the review prompt
      const systemPrompt = REVIEW_PROMPTS[mode];
      const userMessage = `Here are the code changes to review:\n\n\`\`\`diff\n${diff.content}\n\`\`\``;

      const messages: Message[] = [
        { role: 'system', content: systemPrompt, timestamp: new Date() },
        { role: 'user', content: userMessage, timestamp: new Date() },
      ];

      if (verbose) {
        console.log(pc.gray(`Using ${provider}/${model} for analysis...`));
      }

      // Send to LLM for analysis
      const response = await this.providerManager.sendMessage(provider, messages, model, verbose);

      // Parse the findings from the response
      const findings = this.parseFindings(response.content, mode);

      // Sort findings by severity
      findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

      // Generate summary
      const summary = this.generateSummary(findings, mode, diff.files);

      return {
        success: true,
        mode,
        findings,
        summary,
        reviewedFiles: diff.files,
        totalChanges: diff.additions + diff.deletions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        mode,
        findings: [],
        summary: `Review failed: ${errorMessage}`,
        reviewedFiles: [],
        totalChanges: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the diff content based on options
   */
  private async getDiff(options: ReviewOptions): Promise<{
    content: string;
    files: string[];
    additions: number;
    deletions: number;
  }> {
    let diffCommand: string;
    let filesCommand: string;

    if (options.staged) {
      // Review staged changes
      diffCommand = 'git diff --cached';
      filesCommand = 'git diff --cached --name-only';
    } else if (options.commit) {
      // Review specific commit
      diffCommand = `git show ${options.commit} --format=""`;
      filesCommand = `git show ${options.commit} --name-only --format=""`;
    } else {
      // Review against base branch
      const baseBranch = options.baseBranch ?? this.getDefaultBaseBranch();
      diffCommand = `git diff ${baseBranch}...HEAD`;
      filesCommand = `git diff ${baseBranch}...HEAD --name-only`;
    }

    try {
      const content = execSync(diffCommand, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
      });

      const filesOutput = execSync(filesCommand, {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });

      const files = filesOutput.split('\n').filter(f => f.trim() !== '');

      // Get stats
      const statsCommand = options.commit
        ? `git show ${options.commit} --stat --format=""`
        : options.staged
          ? 'git diff --cached --stat'
          : `git diff ${options.baseBranch ?? this.getDefaultBaseBranch()}...HEAD --stat`;

      let additions = 0;
      let deletions = 0;

      try {
        const stats = execSync(statsCommand, {
          cwd: process.cwd(),
          encoding: 'utf-8',
        });

        const match = stats.match(/(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/);
        if (match) {
          additions = parseInt(match[1], 10) || 0;
          deletions = parseInt(match[2], 10) || 0;
        }
      } catch {
        // Stats are optional, continue without them
      }

      return { content, files, additions, deletions };
    } catch (error) {
      throw new Error(`Failed to get diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the default base branch (main or master)
   */
  private getDefaultBaseBranch(): string {
    try {
      // Check if main exists
      execSync('git rev-parse --verify main', {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      return 'main';
    } catch {
      try {
        // Fall back to master
        execSync('git rev-parse --verify master', {
          cwd: process.cwd(),
          stdio: 'pipe',
        });
        return 'master';
      } catch {
        return 'main'; // Default to main even if neither exists
      }
    }
  }

  /**
   * Get the default model for a provider
   */
  private getDefaultModelForProvider(provider: ProviderType): string {
    const defaults: Record<string, string> = {
      openai: 'gpt-4',
      anthropic: 'claude-3-opus-20240229',
      sonicfree: 'claude-sonnet-4-20250514',
      grok: 'grok-2',
      openrouter: 'openai/gpt-4-turbo',
      lmstudio: 'default',
      mock: 'mock-model',
    };
    return defaults[provider] ?? 'default';
  }

  /**
   * Parse findings from LLM response
   */
  private parseFindings(response: string, mode: ReviewMode): ReviewFinding[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // If no JSON array found, return empty findings
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return [];
      }

      // Validate and normalize each finding
      return parsed
        .filter((f: any) => f && typeof f === 'object')
        .map((f: any): ReviewFinding => {
          const finding: ReviewFinding = {
            severity: this.normalizeSeverity(f.severity),
            category: String(f.category ?? 'general'),
            file: String(f.file ?? 'unknown'),
            title: String(f.title ?? 'Issue found'),
            description: String(f.description ?? ''),
          };
          if (typeof f.line === 'number') {
            finding.line = f.line;
          }
          if (f.suggestion) {
            finding.suggestion = String(f.suggestion);
          }
          return finding;
        });
    } catch (error) {
      // If JSON parsing fails, try to extract information from text
      console.warn(pc.yellow('Warning: Could not parse JSON response, attempting text extraction'));
      return this.extractFindingsFromText(response, mode);
    }
  }

  /**
   * Normalize severity string
   */
  private normalizeSeverity(severity: any): ReviewSeverity {
    const normalized = String(severity).toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
      return normalized as ReviewSeverity;
    }
    return 'medium';
  }

  /**
   * Extract findings from text when JSON parsing fails
   */
  private extractFindingsFromText(text: string, mode: ReviewMode): ReviewFinding[] {
    const findings: ReviewFinding[] = [];

    // Look for patterns like "- Critical:" or "1. High:" or "## Critical"
    const patterns = [
      /(?:^|\n)[-*#\d.)\s]*(critical|high|medium|low)[\s:]+(.+?)(?=(?:\n[-*#\d.)\s]*(?:critical|high|medium|low)|$))/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        findings.push({
          severity: this.normalizeSeverity(match[1]),
          category: mode,
          file: 'unknown',
          title: match[2].split('\n')[0].trim(),
          description: match[2].trim(),
        });
      }
    }

    return findings;
  }

  /**
   * Generate a summary of findings
   */
  private generateSummary(findings: ReviewFinding[], mode: ReviewMode, files: string[]): string {
    if (findings.length === 0) {
      return `No ${mode} issues found in ${files.length} file(s). Code review passed!`;
    }

    const counts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    };

    const parts: string[] = [];
    if (counts.critical > 0) parts.push(`${counts.critical} critical`);
    if (counts.high > 0) parts.push(`${counts.high} high`);
    if (counts.medium > 0) parts.push(`${counts.medium} medium`);
    if (counts.low > 0) parts.push(`${counts.low} low`);

    return `Found ${findings.length} ${mode} issue(s) in ${files.length} file(s): ${parts.join(', ')}`;
  }

  /**
   * Format findings for display
   */
  formatFindings(result: ReviewResult): string {
    if (!result.success) {
      return pc.red(`Review failed: ${result.error}`);
    }

    const lines: string[] = [];

    // Header
    lines.push(pc.bold(`\n${'='.repeat(60)}`));
    lines.push(pc.bold(`Code Review Results (${result.mode} mode)`));
    lines.push(pc.bold(`${'='.repeat(60)}\n`));

    // Summary
    lines.push(result.summary);
    lines.push('');

    if (result.findings.length === 0) {
      lines.push(pc.green('All checks passed!'));
      return lines.join('\n');
    }

    // Findings by severity
    for (const severity of ['critical', 'high', 'medium', 'low'] as ReviewSeverity[]) {
      const severityFindings = result.findings.filter(f => f.severity === severity);
      if (severityFindings.length === 0) continue;

      const color = SEVERITY_COLORS[severity];
      lines.push(color(`\n--- ${severity.toUpperCase()} (${severityFindings.length}) ---\n`));

      for (let i = 0; i < severityFindings.length; i++) {
        const finding = severityFindings[i];
        lines.push(color(`${i + 1}. [${finding.category}] ${finding.title}`));
        lines.push(`   File: ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
        lines.push(`   ${finding.description}`);
        if (finding.suggestion) {
          lines.push(pc.green(`   Suggestion: ${finding.suggestion}`));
        }
        lines.push('');
      }
    }

    // Footer
    lines.push(pc.gray(`\nReviewed ${result.reviewedFiles.length} file(s), ${result.totalChanges} total changes`));

    return lines.join('\n');
  }

  /**
   * Print review results to console
   */
  printResults(result: ReviewResult): void {
    console.log(this.formatFindings(result));
  }
}
