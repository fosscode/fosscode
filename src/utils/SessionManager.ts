import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Message, ProviderType } from '../types/index.js';

/**
 * Session state representing a saved fosscode session
 */
export interface SessionState {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  provider: ProviderType;
  model: string;
  messages: Message[];
  fileContext: FileContext[];
  toolState: ToolState;
  metadata: SessionMetadata;
}

/**
 * File context for a session
 */
export interface FileContext {
  path: string;
  content?: string;
  lastModified?: string;
  attached: boolean;
}

/**
 * Tool state for a session
 */
export interface ToolState {
  commandsRun: CommandRecord[];
  filesModified: string[];
  lastWorkingDirectory: string;
}

/**
 * Record of commands executed during a session
 */
export interface CommandRecord {
  command: string;
  timestamp: string;
  exitCode?: number;
  output?: string;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  version: string;
  workingDirectory: string;
  totalTokensUsed?: number;
  tags?: string[];
}

/**
 * Session template for creating new sessions
 */
export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  initialFiles: string[];
  initialInstructions?: string;
  defaultProvider?: ProviderType;
  defaultModel?: string;
  tags?: string[];
}

/**
 * Session summary for listing sessions
 */
export interface SessionSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  provider: ProviderType;
  model: string;
  messageCount: number;
  tags?: string[];
}

const SESSION_VERSION = '1.0.0';

/**
 * Manages session persistence, templates, and state
 */
export class SessionManager {
  private sessionsDir: string;
  private templatesDir: string;
  private currentSession: SessionState | null = null;

  constructor() {
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.sessionsDir = path.join(xdgConfigDir, 'fosscode', 'sessions');
    this.templatesDir = path.join(xdgConfigDir, 'fosscode', 'session-templates');
  }

  /**
   * Initialize the session manager and ensure directories exist
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.templatesDir, { recursive: true });
  }

  /**
   * Create a new session
   */
  createSession(
    name: string,
    provider: ProviderType,
    model: string,
    options?: {
      description?: string;
      template?: SessionTemplate;
    }
  ): SessionState {
    const now = new Date().toISOString();
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const session: SessionState = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      provider: options?.template?.defaultProvider ?? provider,
      model: options?.template?.defaultModel ?? model,
      messages: [],
      fileContext: [],
      toolState: {
        commandsRun: [],
        filesModified: [],
        lastWorkingDirectory: process.cwd(),
      },
      metadata: {
        version: SESSION_VERSION,
        workingDirectory: process.cwd(),
        ...(options?.template?.tags && { tags: options.template.tags }),
      },
      ...(options?.description && { description: options.description }),
    };

    // Apply template if provided
    if (options?.template) {
      if (options.template.systemPrompt) {
        session.messages.push({
          role: 'system',
          content: options.template.systemPrompt,
          timestamp: new Date(),
        });
      }

      if (options.template.initialInstructions) {
        session.messages.push({
          role: 'user',
          content: options.template.initialInstructions,
          timestamp: new Date(),
        });
      }

      session.fileContext = options.template.initialFiles.map(filePath => ({
        path: filePath,
        attached: true,
      }));
    }

    this.currentSession = session;
    return session;
  }

  /**
   * Save the current session state
   */
  async saveSession(session?: SessionState): Promise<string> {
    const sessionToSave = session ?? this.currentSession;
    if (!sessionToSave) {
      throw new Error('No session to save');
    }

    await this.initialize();

    sessionToSave.updatedAt = new Date().toISOString();
    const sessionPath = path.join(this.sessionsDir, `${sessionToSave.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(sessionToSave, null, 2));

    return sessionToSave.id;
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<SessionState> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      const data = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(data) as SessionState;

      // Convert message timestamps back to Date objects
      session.messages = session.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      this.currentSession = session;
      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Session not found: ${sessionId}`);
      }
      throw error;
    }
  }

  /**
   * Resume a session (alias for loadSession with additional context restoration)
   */
  async resumeSession(sessionId: string): Promise<SessionState> {
    const session = await this.loadSession(sessionId);

    // Optionally restore file context
    for (const file of session.fileContext) {
      if (file.attached && file.path) {
        try {
          const content = await fs.readFile(file.path, 'utf-8');
          file.content = content;
          file.lastModified = (await fs.stat(file.path)).mtime.toISOString();
        } catch {
          // File may no longer exist, that's okay
          file.attached = false;
        }
      }
    }

    return session;
  }

  /**
   * Delete a session by ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
    await fs.unlink(sessionPath);

    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }
  }

  /**
   * List all saved sessions
   */
  async listSessions(): Promise<SessionSummary[]> {
    await this.initialize();

    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: SessionSummary[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const sessionPath = path.join(this.sessionsDir, file);
          const data = await fs.readFile(sessionPath, 'utf-8');
          const session = JSON.parse(data) as SessionState;

          const summary: SessionSummary = {
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            provider: session.provider,
            model: session.model,
            messageCount: session.messages.length,
          };
          if (session.description) {
            summary.description = session.description;
          }
          if (session.metadata.tags) {
            summary.tags = session.metadata.tags;
          }
          sessions.push(summary);
        } catch {
          // Skip invalid session files
        }
      }

      // Sort by updatedAt (most recent first)
      sessions.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return sessions;
    } catch {
      return [];
    }
  }

  /**
   * Update session messages
   */
  updateMessages(messages: Message[]): void {
    if (this.currentSession) {
      this.currentSession.messages = messages;
      this.currentSession.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Add a command to the session's tool state
   */
  addCommand(command: string, exitCode?: number, output?: string): void {
    if (this.currentSession) {
      const record: CommandRecord = {
        command,
        timestamp: new Date().toISOString(),
      };
      if (exitCode !== undefined) {
        record.exitCode = exitCode;
      }
      if (output !== undefined) {
        record.output = output.substring(0, 1000); // Truncate output to save space
      }
      this.currentSession.toolState.commandsRun.push(record);
    }
  }

  /**
   * Add a modified file to the session's tool state
   */
  addModifiedFile(filePath: string): void {
    if (this.currentSession) {
      if (!this.currentSession.toolState.filesModified.includes(filePath)) {
        this.currentSession.toolState.filesModified.push(filePath);
      }
    }
  }

  /**
   * Attach a file to the current session context
   */
  async attachFile(filePath: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);

      const existingIndex = this.currentSession.fileContext.findIndex(
        f => f.path === filePath
      );

      const fileContext: FileContext = {
        path: filePath,
        content,
        lastModified: stat.mtime.toISOString(),
        attached: true,
      };

      if (existingIndex >= 0) {
        this.currentSession.fileContext[existingIndex] = fileContext;
      } else {
        this.currentSession.fileContext.push(fileContext);
      }
    } catch (error) {
      throw new Error(`Failed to attach file: ${(error as Error).message}`);
    }
  }

  /**
   * Detach a file from the current session context
   */
  detachFile(filePath: string): void {
    if (this.currentSession) {
      const index = this.currentSession.fileContext.findIndex(f => f.path === filePath);
      if (index >= 0) {
        this.currentSession.fileContext[index].attached = false;
        delete this.currentSession.fileContext[index].content;
      }
    }
  }

  /**
   * Get the current session
   */
  getCurrentSession(): SessionState | null {
    return this.currentSession;
  }

  /**
   * Set the current session
   */
  setCurrentSession(session: SessionState): void {
    this.currentSession = session;
  }

  /**
   * Clear the current session
   */
  clearCurrentSession(): void {
    this.currentSession = null;
  }

  // ==================== Template Management ====================

  /**
   * Save a session template
   */
  async saveTemplate(template: SessionTemplate): Promise<void> {
    await this.initialize();
    const templatePath = path.join(this.templatesDir, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
  }

  /**
   * Load a session template by ID
   */
  async loadTemplate(templateId: string): Promise<SessionTemplate> {
    const templatePath = path.join(this.templatesDir, `${templateId}.json`);

    try {
      const data = await fs.readFile(templatePath, 'utf-8');
      return JSON.parse(data) as SessionTemplate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Template not found: ${templateId}`);
      }
      throw error;
    }
  }

  /**
   * Delete a session template by ID
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const templatePath = path.join(this.templatesDir, `${templateId}.json`);
    await fs.unlink(templatePath);
  }

  /**
   * List all available session templates
   */
  async listTemplates(): Promise<SessionTemplate[]> {
    await this.initialize();

    try {
      const files = await fs.readdir(this.templatesDir);
      const templates: SessionTemplate[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const templatePath = path.join(this.templatesDir, file);
          const data = await fs.readFile(templatePath, 'utf-8');
          templates.push(JSON.parse(data) as SessionTemplate);
        } catch {
          // Skip invalid template files
        }
      }

      return templates;
    } catch {
      return [];
    }
  }

  /**
   * Create a template from the current session
   */
  async createTemplateFromSession(
    name: string,
    description: string
  ): Promise<SessionTemplate> {
    if (!this.currentSession) {
      throw new Error('No active session to create template from');
    }

    const systemPrompt = this.currentSession.messages.find(m => m.role === 'system')?.content;
    const template: SessionTemplate = {
      id: `template_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name,
      description,
      initialFiles: this.currentSession.fileContext
        .filter(f => f.attached)
        .map(f => f.path),
      defaultProvider: this.currentSession.provider,
      defaultModel: this.currentSession.model,
    };
    if (systemPrompt) {
      template.systemPrompt = systemPrompt;
    }
    if (this.currentSession.metadata.tags) {
      template.tags = this.currentSession.metadata.tags;
    }

    await this.saveTemplate(template);
    return template;
  }

  /**
   * Get sessions directory path
   */
  getSessionsDir(): string {
    return this.sessionsDir;
  }

  /**
   * Get templates directory path
   */
  getTemplatesDir(): string {
    return this.templatesDir;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
