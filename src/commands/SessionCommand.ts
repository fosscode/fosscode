import pc from 'picocolors';
import {
  SessionManager,
  SessionTemplate,
  sessionManager,
} from '../utils/SessionManager.js';
import {
  SessionExporter,
  ExportFormat,
  sessionExporter,
} from '../utils/SessionExporter.js';
import { SessionServer, createSessionServer } from '../utils/SessionServer.js';
import { ProviderType, Message } from '../types/index.js';

/**
 * Session command result
 */
export interface SessionCommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Session command options
 */
export interface SessionCommandOptions {
  provider?: ProviderType;
  model?: string;
  template?: string;
  format?: ExportFormat;
  output?: string;
  port?: number;
  name?: string;
  description?: string;
  includeFiles?: boolean;
  includeCommands?: boolean;
  includeTimestamps?: boolean;
}

/**
 * Handles session-related commands
 */
export class SessionCommand {
  private sessionManager: SessionManager;
  private sessionExporter: SessionExporter;
  private server: SessionServer | null = null;

  constructor(
    manager: SessionManager = sessionManager,
    exporter: SessionExporter = sessionExporter
  ) {
    this.sessionManager = manager;
    this.sessionExporter = exporter;
  }

  /**
   * Execute a session command
   */
  async execute(
    subcommand: string,
    args: string[],
    options: SessionCommandOptions = {},
    messages: Message[] = []
  ): Promise<SessionCommandResult> {
    try {
      switch (subcommand.toLowerCase()) {
        case 'save':
          return await this.handleSave(args, options, messages);

        case 'resume':
        case 'load':
          return await this.handleResume(args);

        case 'list':
        case 'ls':
          return await this.handleList();

        case 'delete':
        case 'rm':
          return await this.handleDelete(args);

        case 'export':
          return await this.handleExport(args, options);

        case 'new':
          return await this.handleNew(args, options);

        case 'template':
          return await this.handleTemplate(args, options);

        case 'templates':
          return await this.handleListTemplates();

        case 'serve':
          return await this.handleServe(options);

        case 'stop':
          return await this.handleStopServer();

        case 'info':
        case 'status':
          return await this.handleInfo();

        case 'help':
        default:
          return this.handleHelp();
      }
    } catch (error) {
      return {
        success: false,
        message: `Session command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Handle /session save [name]
   */
  private async handleSave(
    args: string[],
    options: SessionCommandOptions,
    messages: Message[]
  ): Promise<SessionCommandResult> {
    await this.sessionManager.initialize();

    let session = this.sessionManager.getCurrentSession();

    if (!session) {
      // Create a new session if one doesn't exist
      const name = args[0] ?? options.name ?? `Session ${new Date().toLocaleDateString()}`;
      const createOptions: { description?: string } = {};
      if (options.description) {
        createOptions.description = options.description;
      }
      session = this.sessionManager.createSession(
        name,
        (options.provider ?? 'openai') as ProviderType,
        options.model ?? 'gpt-4',
        createOptions
      );
    } else if (args[0]) {
      // Update session name if provided
      session.name = args[0];
    }

    // Update messages
    session.messages = messages;

    const sessionId = await this.sessionManager.saveSession(session);

    return {
      success: true,
      message: `Session saved: ${session.name} (ID: ${sessionId})`,
      data: { sessionId, name: session.name },
    };
  }

  /**
   * Handle /session resume <id>
   */
  private async handleResume(args: string[]): Promise<SessionCommandResult> {
    if (!args[0]) {
      return {
        success: false,
        message: 'Session ID is required. Use `/session list` to see available sessions.',
      };
    }

    await this.sessionManager.initialize();
    const session = await this.sessionManager.resumeSession(args[0]);

    return {
      success: true,
      message: `Session resumed: ${session.name}\n` +
        `Provider: ${session.provider} | Model: ${session.model}\n` +
        `Messages: ${session.messages.length} | Files: ${session.fileContext.length}`,
      data: session,
    };
  }

  /**
   * Handle /session list
   */
  private async handleList(): Promise<SessionCommandResult> {
    await this.sessionManager.initialize();
    const sessions = await this.sessionManager.listSessions();

    if (sessions.length === 0) {
      return {
        success: true,
        message: 'No saved sessions found.\n\nUse `/session save [name]` to save the current session.',
      };
    }

    let content = 'Saved Sessions:\n\n';
    for (const session of sessions) {
      const updated = new Date(session.updatedAt).toLocaleString();
      content += `${pc.bold(session.name)} (${session.id})\n`;
      content += `  Provider: ${session.provider} | Model: ${session.model}\n`;
      content += `  Messages: ${session.messageCount} | Updated: ${updated}\n`;
      if (session.description) {
        content += `  ${pc.gray(session.description)}\n`;
      }
      content += '\n';
    }

    return {
      success: true,
      message: content,
      data: sessions,
    };
  }

  /**
   * Handle /session delete <id>
   */
  private async handleDelete(args: string[]): Promise<SessionCommandResult> {
    if (!args[0]) {
      return {
        success: false,
        message: 'Session ID is required. Use `/session list` to see available sessions.',
      };
    }

    await this.sessionManager.initialize();
    await this.sessionManager.deleteSession(args[0]);

    return {
      success: true,
      message: `Session deleted: ${args[0]}`,
    };
  }

  /**
   * Handle /session export [format]
   */
  private async handleExport(
    args: string[],
    options: SessionCommandOptions
  ): Promise<SessionCommandResult> {
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      return {
        success: false,
        message: 'No active session to export. Load a session first with `/session resume <id>`.',
      };
    }

    const format = (args[0] ?? options.format ?? 'markdown') as ExportFormat;
    if (!['markdown', 'json', 'html'].includes(format)) {
      return {
        success: false,
        message: `Invalid format: ${format}. Supported formats: markdown, json, html`,
      };
    }

    const filePath = await this.sessionExporter.exportToFile(session, {
      format,
      includeFileContext: options.includeFiles ?? true,
      includeCommands: options.includeCommands ?? true,
      includeTimestamps: options.includeTimestamps ?? true,
    }, options.output);

    return {
      success: true,
      message: `Session exported to: ${filePath}`,
      data: { filePath, format },
    };
  }

  /**
   * Handle /session new [--template <name>]
   */
  private async handleNew(
    args: string[],
    options: SessionCommandOptions
  ): Promise<SessionCommandResult> {
    await this.sessionManager.initialize();

    let template: SessionTemplate | undefined;
    if (options.template) {
      try {
        template = await this.sessionManager.loadTemplate(options.template);
      } catch {
        return {
          success: false,
          message: `Template not found: ${options.template}. Use \`/session templates\` to see available templates.`,
        };
      }
    }

    const name = args[0] ?? options.name ?? `Session ${new Date().toLocaleDateString()}`;
    const createOptions: { description?: string; template?: SessionTemplate } = {};
    if (options.description) {
      createOptions.description = options.description;
    }
    if (template) {
      createOptions.template = template;
    }
    const session = this.sessionManager.createSession(
      name,
      (options.provider ?? template?.defaultProvider ?? 'openai') as ProviderType,
      options.model ?? template?.defaultModel ?? 'gpt-4',
      createOptions
    );

    return {
      success: true,
      message: `New session created: ${session.name}` +
        (template ? `\nTemplate applied: ${template.name}` : ''),
      data: session,
    };
  }

  /**
   * Handle /session template <subcommand>
   */
  private async handleTemplate(
    args: string[],
    options: SessionCommandOptions
  ): Promise<SessionCommandResult> {
    const subcommand = args[0];

    switch (subcommand) {
      case 'create':
        return await this.handleCreateTemplate(args.slice(1), options);

      case 'delete':
        return await this.handleDeleteTemplate(args.slice(1));

      case 'show':
        return await this.handleShowTemplate(args.slice(1));

      default:
        return {
          success: false,
          message:
            'Template subcommands:\n' +
            '  `/session template create <name>` - Create template from current session\n' +
            '  `/session template delete <id>` - Delete a template\n' +
            '  `/session template show <id>` - Show template details\n' +
            '\nUse `/session templates` to list all templates.',
        };
    }
  }

  /**
   * Handle /session template create <name>
   */
  private async handleCreateTemplate(
    args: string[],
    options: SessionCommandOptions
  ): Promise<SessionCommandResult> {
    const name = args[0] ?? options.name;
    if (!name) {
      return {
        success: false,
        message: 'Template name is required.',
      };
    }

    const description = options.description ?? 'Created from session';
    const template = await this.sessionManager.createTemplateFromSession(name, description);

    return {
      success: true,
      message: `Template created: ${template.name} (ID: ${template.id})`,
      data: template,
    };
  }

  /**
   * Handle /session template delete <id>
   */
  private async handleDeleteTemplate(args: string[]): Promise<SessionCommandResult> {
    if (!args[0]) {
      return {
        success: false,
        message: 'Template ID is required.',
      };
    }

    await this.sessionManager.deleteTemplate(args[0]);

    return {
      success: true,
      message: `Template deleted: ${args[0]}`,
    };
  }

  /**
   * Handle /session template show <id>
   */
  private async handleShowTemplate(args: string[]): Promise<SessionCommandResult> {
    if (!args[0]) {
      return {
        success: false,
        message: 'Template ID is required.',
      };
    }

    const template = await this.sessionManager.loadTemplate(args[0]);

    let content = `Template: ${template.name}\n`;
    content += `ID: ${template.id}\n`;
    content += `Description: ${template.description}\n`;
    if (template.defaultProvider) {
      content += `Default Provider: ${template.defaultProvider}\n`;
    }
    if (template.defaultModel) {
      content += `Default Model: ${template.defaultModel}\n`;
    }
    if (template.initialFiles.length > 0) {
      content += `Initial Files:\n`;
      for (const file of template.initialFiles) {
        content += `  - ${file}\n`;
      }
    }
    if (template.systemPrompt) {
      content += `System Prompt:\n${template.systemPrompt.substring(0, 200)}...\n`;
    }

    return {
      success: true,
      message: content,
      data: template,
    };
  }

  /**
   * Handle /session templates
   */
  private async handleListTemplates(): Promise<SessionCommandResult> {
    await this.sessionManager.initialize();
    const templates = await this.sessionManager.listTemplates();

    if (templates.length === 0) {
      return {
        success: true,
        message:
          'No templates found.\n\nUse `/session template create <name>` to create a template from the current session.',
      };
    }

    let content = 'Available Templates:\n\n';
    for (const template of templates) {
      content += `${pc.bold(template.name)} (${template.id})\n`;
      content += `  ${template.description}\n`;
      if (template.defaultProvider || template.defaultModel) {
        content += `  Default: ${template.defaultProvider ?? ''} ${template.defaultModel ?? ''}\n`;
      }
      content += '\n';
    }

    return {
      success: true,
      message: content,
      data: templates,
    };
  }

  /**
   * Handle /session serve [--port <port>]
   */
  private async handleServe(options: SessionCommandOptions): Promise<SessionCommandResult> {
    if (this.server?.isServerRunning()) {
      return {
        success: false,
        message: `Server is already running on ${this.server.getUrl()}`,
      };
    }

    const port = options.port ?? 3847;
    this.server = createSessionServer({
      port,
      sessionManager: this.sessionManager,
    });

    await this.server.start();

    return {
      success: true,
      message:
        `Session server started on ${this.server.getUrl()}\n\n` +
        `Endpoints:\n` +
        `  GET  /health      - Server health check\n` +
        `  GET  /api/session - Current session info\n` +
        `  GET  /api/messages - Session messages\n` +
        `  POST /api/message - Send a message\n\n` +
        `Use \`/session stop\` to stop the server.`,
      data: { url: this.server.getUrl(), port },
    };
  }

  /**
   * Handle /session stop
   */
  private async handleStopServer(): Promise<SessionCommandResult> {
    if (!this.server?.isServerRunning()) {
      return {
        success: false,
        message: 'No server is running.',
      };
    }

    await this.server.stop();

    return {
      success: true,
      message: 'Session server stopped.',
    };
  }

  /**
   * Handle /session info
   */
  private async handleInfo(): Promise<SessionCommandResult> {
    const session = this.sessionManager.getCurrentSession();

    if (!session) {
      return {
        success: true,
        message:
          'No active session.\n\n' +
          'Use `/session new [name]` to create a new session or\n' +
          'Use `/session resume <id>` to load a saved session.',
      };
    }

    let content = `Current Session: ${session.name}\n`;
    content += `ID: ${session.id}\n`;
    content += `Provider: ${session.provider} | Model: ${session.model}\n`;
    content += `Messages: ${session.messages.length}\n`;
    content += `Files Attached: ${session.fileContext.filter(f => f.attached).length}\n`;
    content += `Commands Run: ${session.toolState.commandsRun.length}\n`;
    content += `Files Modified: ${session.toolState.filesModified.length}\n`;
    content += `Created: ${new Date(session.createdAt).toLocaleString()}\n`;
    content += `Updated: ${new Date(session.updatedAt).toLocaleString()}\n`;

    if (session.metadata.tags?.length) {
      content += `Tags: ${session.metadata.tags.join(', ')}\n`;
    }

    if (this.server?.isServerRunning()) {
      content += `\nServer: Running on ${this.server.getUrl()}`;
    }

    return {
      success: true,
      message: content,
      data: session,
    };
  }

  /**
   * Handle /session help
   */
  private handleHelp(): SessionCommandResult {
    const helpMessage =
      'Session Management Commands:\n\n' +
      'Save & Resume:\n' +
      '  `/session save [name]`      - Save current session\n' +
      '  `/session resume <id>`      - Resume a saved session\n' +
      '  `/session list`             - List all saved sessions\n' +
      '  `/session delete <id>`      - Delete a saved session\n' +
      '\n' +
      'Export:\n' +
      '  `/session export [format]`  - Export session (markdown|json|html)\n' +
      '\n' +
      'Templates:\n' +
      '  `/session new [name]`       - Create new session\n' +
      '  `/session new --template <name>` - Create from template\n' +
      '  `/session templates`        - List available templates\n' +
      '  `/session template create <name>` - Create template from session\n' +
      '  `/session template delete <id>`   - Delete a template\n' +
      '\n' +
      'Remote Access:\n' +
      '  `/session serve [--port <n>]` - Start session server\n' +
      '  `/session stop`              - Stop session server\n' +
      '\n' +
      'Info:\n' +
      '  `/session info`             - Show current session info\n' +
      '  `/session help`             - Show this help message';

    return {
      success: true,
      message: helpMessage,
    };
  }

  /**
   * Get the current session manager instance
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Get the current server instance
   */
  getServer(): SessionServer | null {
    return this.server;
  }
}

// Export singleton instance
export const sessionCommand = new SessionCommand();
