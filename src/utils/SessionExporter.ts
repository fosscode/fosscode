import { promises as fs } from 'fs';
import * as path from 'path';
import { SessionState, CommandRecord } from './SessionManager.js';
import { Message } from '../types/index.js';

/**
 * Export format options
 */
export type ExportFormat = 'markdown' | 'json' | 'html';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  includeFileContext?: boolean;
  includeCommands?: boolean;
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  content: string;
  filename: string;
  format: ExportFormat;
}

/**
 * Handles exporting sessions to various formats
 */
export class SessionExporter {
  /**
   * Export a session to the specified format
   */
  export(session: SessionState, options: ExportOptions): ExportResult {
    const { format } = options;

    let content: string;
    let extension: string;

    switch (format) {
      case 'markdown':
        content = this.exportToMarkdown(session, options);
        extension = 'md';
        break;
      case 'json':
        content = this.exportToJSON(session, options);
        extension = 'json';
        break;
      case 'html':
        content = this.exportToHTML(session, options);
        extension = 'html';
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `session_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${extension}`;

    return { content, filename, format };
  }

  /**
   * Export session and save to file
   */
  async exportToFile(
    session: SessionState,
    options: ExportOptions,
    outputDir?: string
  ): Promise<string> {
    const result = this.export(session, options);
    const dir = outputDir ?? process.cwd();
    const filePath = path.join(dir, result.filename);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, result.content, 'utf-8');

    return filePath;
  }

  /**
   * Export session to Markdown format
   */
  private exportToMarkdown(session: SessionState, options: ExportOptions): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${session.name}`);
    lines.push('');

    if (session.description) {
      lines.push(`> ${session.description}`);
      lines.push('');
    }

    // Metadata
    if (options.includeMetadata !== false) {
      lines.push('## Session Info');
      lines.push('');
      lines.push(`- **Provider:** ${session.provider}`);
      lines.push(`- **Model:** ${session.model}`);
      lines.push(`- **Created:** ${this.formatDate(session.createdAt)}`);
      lines.push(`- **Updated:** ${this.formatDate(session.updatedAt)}`);
      lines.push(`- **Working Directory:** ${session.metadata.workingDirectory}`);
      if (session.metadata.totalTokensUsed) {
        lines.push(`- **Tokens Used:** ${session.metadata.totalTokensUsed.toLocaleString()}`);
      }
      if (session.metadata.tags?.length) {
        lines.push(`- **Tags:** ${session.metadata.tags.join(', ')}`);
      }
      lines.push('');
    }

    // Conversation
    lines.push('## Conversation');
    lines.push('');

    for (const message of session.messages) {
      const role = this.formatRole(message.role);
      const timestamp =
        options.includeTimestamps !== false
          ? ` *(${this.formatDate(message.timestamp.toString())})*`
          : '';

      lines.push(`### ${role}${timestamp}`);
      lines.push('');
      lines.push(message.content);
      lines.push('');
    }

    // File Context
    if (options.includeFileContext !== false && session.fileContext.length > 0) {
      lines.push('## Files');
      lines.push('');

      for (const file of session.fileContext) {
        lines.push(`### ${file.path}`);
        lines.push('');
        lines.push(`- **Attached:** ${file.attached ? 'Yes' : 'No'}`);
        if (file.lastModified) {
          lines.push(`- **Last Modified:** ${this.formatDate(file.lastModified)}`);
        }
        if (file.content) {
          lines.push('');
          lines.push('```');
          lines.push(file.content);
          lines.push('```');
        }
        lines.push('');
      }
    }

    // Commands
    if (options.includeCommands !== false && session.toolState.commandsRun.length > 0) {
      lines.push('## Commands Executed');
      lines.push('');

      for (const cmd of session.toolState.commandsRun) {
        lines.push(this.formatCommand(cmd, options));
        lines.push('');
      }

      if (session.toolState.filesModified.length > 0) {
        lines.push('### Modified Files');
        lines.push('');
        for (const file of session.toolState.filesModified) {
          lines.push(`- ${file}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Export session to JSON format
   */
  private exportToJSON(session: SessionState, options: ExportOptions): string {
    const exportData: Record<string, unknown> = {
      id: session.id,
      name: session.name,
      description: session.description,
      provider: session.provider,
      model: session.model,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: options.includeTimestamps !== false ? msg.timestamp : undefined,
        usage: msg.usage,
      })),
    };

    if (options.includeFileContext !== false) {
      exportData.fileContext = session.fileContext;
    }

    if (options.includeCommands !== false) {
      exportData.toolState = session.toolState;
    }

    if (options.includeMetadata !== false) {
      exportData.metadata = session.metadata;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export session to HTML format
   */
  private exportToHTML(session: SessionState, options: ExportOptions): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    lines.push(`  <title>${this.escapeHtml(session.name)} - fosscode Session</title>`);
    lines.push('  <style>');
    lines.push(this.getHTMLStyles());
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');
    lines.push('  <div class="container">');

    // Header
    lines.push(`    <h1>${this.escapeHtml(session.name)}</h1>`);
    if (session.description) {
      lines.push(`    <p class="description">${this.escapeHtml(session.description)}</p>`);
    }

    // Metadata
    if (options.includeMetadata !== false) {
      lines.push('    <div class="metadata">');
      lines.push('      <h2>Session Info</h2>');
      lines.push('      <dl>');
      lines.push(
        `        <dt>Provider</dt><dd>${this.escapeHtml(session.provider)}</dd>`
      );
      lines.push(`        <dt>Model</dt><dd>${this.escapeHtml(session.model)}</dd>`);
      lines.push(
        `        <dt>Created</dt><dd>${this.formatDate(session.createdAt)}</dd>`
      );
      lines.push(
        `        <dt>Updated</dt><dd>${this.formatDate(session.updatedAt)}</dd>`
      );
      lines.push(
        `        <dt>Working Directory</dt><dd>${this.escapeHtml(session.metadata.workingDirectory)}</dd>`
      );
      if (session.metadata.totalTokensUsed) {
        lines.push(
          `        <dt>Tokens Used</dt><dd>${session.metadata.totalTokensUsed.toLocaleString()}</dd>`
        );
      }
      if (session.metadata.tags?.length) {
        lines.push(
          `        <dt>Tags</dt><dd>${session.metadata.tags.map(t => this.escapeHtml(t)).join(', ')}</dd>`
        );
      }
      lines.push('      </dl>');
      lines.push('    </div>');
    }

    // Conversation
    lines.push('    <div class="conversation">');
    lines.push('      <h2>Conversation</h2>');

    for (const message of session.messages) {
      const roleClass = message.role.toLowerCase();
      const timestamp =
        options.includeTimestamps !== false
          ? `<span class="timestamp">${this.formatDate(message.timestamp.toString())}</span>`
          : '';

      lines.push(`      <div class="message ${roleClass}">`);
      lines.push(
        `        <div class="message-header">${this.formatRole(message.role)}${timestamp}</div>`
      );
      lines.push(
        `        <div class="message-content">${this.formatContentForHTML(message.content)}</div>`
      );
      lines.push('      </div>');
    }

    lines.push('    </div>');

    // File Context
    if (options.includeFileContext !== false && session.fileContext.length > 0) {
      lines.push('    <div class="files">');
      lines.push('      <h2>Files</h2>');

      for (const file of session.fileContext) {
        lines.push('      <div class="file">');
        lines.push(`        <h3>${this.escapeHtml(file.path)}</h3>`);
        lines.push(
          `        <p><strong>Attached:</strong> ${file.attached ? 'Yes' : 'No'}</p>`
        );
        if (file.lastModified) {
          lines.push(
            `        <p><strong>Last Modified:</strong> ${this.formatDate(file.lastModified)}</p>`
          );
        }
        if (file.content) {
          lines.push(
            `        <pre><code>${this.escapeHtml(file.content)}</code></pre>`
          );
        }
        lines.push('      </div>');
      }

      lines.push('    </div>');
    }

    // Commands
    if (options.includeCommands !== false && session.toolState.commandsRun.length > 0) {
      lines.push('    <div class="commands">');
      lines.push('      <h2>Commands Executed</h2>');

      for (const cmd of session.toolState.commandsRun) {
        lines.push('      <div class="command">');
        lines.push(`        <code>${this.escapeHtml(cmd.command)}</code>`);
        if (options.includeTimestamps !== false) {
          lines.push(
            `        <span class="timestamp">${this.formatDate(cmd.timestamp)}</span>`
          );
        }
        if (cmd.exitCode !== undefined) {
          const statusClass = cmd.exitCode === 0 ? 'success' : 'error';
          lines.push(
            `        <span class="exit-code ${statusClass}">Exit: ${cmd.exitCode}</span>`
          );
        }
        if (cmd.output) {
          lines.push(`        <pre class="output">${this.escapeHtml(cmd.output)}</pre>`);
        }
        lines.push('      </div>');
      }

      if (session.toolState.filesModified.length > 0) {
        lines.push('      <h3>Modified Files</h3>');
        lines.push('      <ul>');
        for (const file of session.toolState.filesModified) {
          lines.push(`        <li>${this.escapeHtml(file)}</li>`);
        }
        lines.push('      </ul>');
      }

      lines.push('    </div>');
    }

    lines.push('  </div>');
    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Get HTML styles
   */
  private getHTMLStyles(): string {
    return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: white;
      min-height: 100vh;
    }
    h1 { margin-bottom: 0.5rem; color: #1a1a1a; }
    h2 { margin: 2rem 0 1rem; color: #333; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    h3 { margin: 1.5rem 0 0.5rem; color: #444; }
    .description { color: #666; font-style: italic; margin-bottom: 1rem; }
    .metadata dl { display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem; }
    .metadata dt { font-weight: 600; color: #555; }
    .metadata dd { color: #333; }
    .conversation { margin-top: 2rem; }
    .message {
      margin: 1rem 0;
      padding: 1rem;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .message.user {
      background: #e3f2fd;
      border-color: #2196f3;
    }
    .message.assistant {
      background: #f3e5f5;
      border-color: #9c27b0;
    }
    .message.system {
      background: #fff3e0;
      border-color: #ff9800;
    }
    .message.summary {
      background: #e8f5e9;
      border-color: #4caf50;
    }
    .message-header {
      font-weight: 600;
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .message-content {
      white-space: pre-wrap;
      word-break: break-word;
    }
    .message-content pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    .message-content code {
      background: #eee;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Fira Code', monospace;
    }
    .timestamp {
      font-size: 0.8rem;
      color: #888;
    }
    .file {
      margin: 1rem 0;
      padding: 1rem;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .file pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      max-height: 400px;
    }
    .command {
      margin: 0.5rem 0;
      padding: 0.75rem;
      background: #263238;
      color: #aed581;
      border-radius: 4px;
      font-family: 'Fira Code', monospace;
    }
    .command .timestamp { color: #78909c; margin-left: 1rem; }
    .command .exit-code { margin-left: 1rem; }
    .command .exit-code.success { color: #81c784; }
    .command .exit-code.error { color: #e57373; }
    .command .output {
      background: #1e1e1e;
      margin-top: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      font-size: 0.9rem;
      max-height: 200px;
      overflow-y: auto;
    }
    .commands ul { list-style: none; margin-top: 0.5rem; }
    .commands li { padding: 0.25rem 0; color: #555; }
    .commands li::before { content: ''; margin-right: 0.5rem; color: #888; }`;
  }

  /**
   * Format role for display
   */
  private formatRole(role: Message['role']): string {
    switch (role) {
      case 'user':
        return 'User';
      case 'assistant':
        return 'Assistant';
      case 'system':
        return 'System';
      case 'summary':
        return 'Summary';
      default:
        return role;
    }
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  }

  /**
   * Format command for markdown
   */
  private formatCommand(cmd: CommandRecord, options: ExportOptions): string {
    const lines: string[] = [];
    const timestamp =
      options.includeTimestamps !== false ? ` *(${this.formatDate(cmd.timestamp)})*` : '';

    lines.push(`\`\`\`bash`);
    lines.push(cmd.command);
    lines.push(`\`\`\``);

    if (cmd.exitCode !== undefined) {
      lines.push(`Exit code: ${cmd.exitCode}${timestamp}`);
    }

    if (cmd.output) {
      lines.push('');
      lines.push('Output:');
      lines.push('```');
      lines.push(cmd.output);
      lines.push('```');
    }

    return lines.join('\n');
  }

  /**
   * Format content for HTML (handle code blocks)
   */
  private formatContentForHTML(content: string): string {
    // Escape HTML first
    let escaped = this.escapeHtml(content);

    // Convert code blocks
    escaped = escaped.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>'
    );

    // Convert inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert line breaks
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, char => htmlEntities[char] ?? char);
  }
}

// Export singleton instance
export const sessionExporter = new SessionExporter();
