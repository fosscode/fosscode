import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Message, ProviderType, ProviderResponse } from '../types/index.js';

export interface ChatLogEntry {
  id: string;
  timestamp: Date;
  operation:
    | 'session_started'
    | 'session_ended'
    | 'message_sent'
    | 'message_received'
    | 'error'
    | 'command_executed'
    | 'file_attached'
    | 'mode_changed'
    | 'streaming_token'
    | 'backend_operation'
    | 'tool_execution'
    | 'api_call';
  data: any;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  provider: ProviderType;
  model: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  operations: ChatLogEntry[];
  status: 'active' | 'completed' | 'error';
}

export class ChatLogger {
  private configDir: string;
  private logsDir: string;
  private currentSession: ChatSession | null = null;

  constructor() {
    // Use XDG config directory: ~/.config/fosscode/
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.configDir = path.join(xdgConfigDir, 'fosscode');
    this.logsDir = path.join(this.configDir, 'chat_logs');
  }

  /**
   * Initialize the logging system
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      await this.cleanupOldLogs();
    } catch (error) {
      console.warn('Failed to initialize chat logging:', error);
    }
  }

  /**
   * Start a new chat session
   */
  async startSession(provider: ProviderType, model: string): Promise<string> {
    const sessionId = this.generateSessionId();
    this.currentSession = {
      id: sessionId,
      provider,
      model,
      startTime: new Date(),
      messageCount: 0,
      operations: [],
      status: 'active',
    };

    // Log session start
    await this.logOperation('session_started', {
      provider,
      model,
      sessionId,
    });

    return sessionId;
  }

  /**
   * End the current chat session
   */
  async endSession(status: 'completed' | 'error' = 'completed'): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.status = status;

    // Log session end
    await this.logOperation('session_ended', {
      status,
      duration: this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime(),
      messageCount: this.currentSession.messageCount,
    });

    // Save the session to file
    await this.saveSession();

    // Clear current session
    this.currentSession = null;
  }

  /**
   * Log a message being sent
   */
  async logMessageSent(
    message: Message,
    attachedFiles?: { path: string; content: string }[]
  ): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.messageCount++;
    await this.logOperation('message_sent', {
      message,
      attachedFiles: attachedFiles || [],
      messageNumber: this.currentSession.messageCount,
    });
  }

  /**
   * Log a message being received
   */
  async logMessageReceived(response: ProviderResponse, responseTime?: number): Promise<void> {
    if (!this.currentSession) return;

    await this.logOperation('message_received', {
      response,
      responseTime,
      messageNumber: this.currentSession.messageCount,
    });
  }

  /**
   * Log an error that occurred
   */
  async logError(error: Error, context?: string): Promise<void> {
    await this.logOperation('error', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  /**
   * Log a command being executed
   */
  async logCommand(command: string, result?: any): Promise<void> {
    await this.logOperation('command_executed', {
      command,
      result,
    });
  }

  /**
   * Log a file being attached
   */
  async logFileAttached(filePath: string, fileSize?: number): Promise<void> {
    await this.logOperation('file_attached', {
      filePath,
      fileSize,
    });
  }

  /**
   * Log a mode change
   */
  async logModeChanged(fromMode: string, toMode: string): Promise<void> {
    await this.logOperation('mode_changed', {
      fromMode,
      toMode,
    });
  }

  /**
   * Log a streaming token from LLM
   */
  async logStreamingToken(token: string, isThinking?: boolean): Promise<void> {
    if (!this.currentSession) return;

    await this.logOperation('streaming_token', {
      token,
      isThinking: isThinking || false,
      tokenLength: token.length,
    });
  }

  /**
   * Log backend operation (API call, tool execution, etc.)
   */
  async logBackendOperation(
    operation: string,
    details: any,
    duration?: number,
    success?: boolean
  ): Promise<void> {
    await this.logOperation('backend_operation', {
      operation,
      details,
      duration,
      success,
    });
  }

  /**
   * Log API call details
   */
  async logApiCall(
    provider: string,
    endpoint: string,
    method: string,
    requestData?: any,
    responseData?: any,
    duration?: number,
    statusCode?: number,
    error?: string
  ): Promise<void> {
    await this.logOperation('api_call', {
      provider,
      endpoint,
      method,
      requestData,
      responseData,
      duration,
      statusCode,
      error,
    });
  }

  /**
   * Log tool execution
   */
  async logToolExecution(
    toolName: string,
    parameters: any,
    result: any,
    duration?: number,
    success?: boolean
  ): Promise<void> {
    await this.logOperation('tool_execution', {
      toolName,
      parameters,
      result,
      duration,
      success,
    });
  }

  /**
   * Get all chat sessions
   */
  async getAllSessions(): Promise<ChatSession[]> {
    try {
      const files = await fs.readdir(this.logsDir);
      const sessionFiles = files.filter(f => f.endsWith('.json') && f.startsWith('chat_'));

      const sessions: ChatSession[] = [];
      for (const file of sessionFiles) {
        try {
          const filePath = path.join(this.logsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(content);
          // Convert date strings back to Date objects
          session.startTime = new Date(session.startTime);
          if (session.endTime) session.endTime = new Date(session.endTime);
          session.operations.forEach((op: ChatLogEntry) => {
            op.timestamp = new Date(op.timestamp);
          });
          sessions.push(session);
        } catch (error) {
          console.warn(`Failed to load session file ${file}:`, error);
        }
      }

      // Sort by start time, newest first
      return sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    } catch (error) {
      console.warn('Failed to get chat sessions:', error);
      return [];
    }
  }

  /**
   * Get a specific chat session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const filePath = path.join(this.logsDir, `chat_${sessionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content);
      // Convert date strings back to Date objects
      session.startTime = new Date(session.startTime);
      if (session.endTime) session.endTime = new Date(session.endTime);
      session.operations.forEach((op: ChatLogEntry) => {
        op.timestamp = new Date(op.timestamp);
      });
      return session;
    } catch (error) {
      console.warn(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Delete a specific chat session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.logsDir, `chat_${sessionId}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.warn(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get chat statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    averageSessionDuration: number;
    mostUsedProvider: string;
    mostUsedModel: string;
  }> {
    const sessions = await this.getAllSessions();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalMessages: 0,
        averageSessionDuration: 0,
        mostUsedProvider: '',
        mostUsedModel: '',
      };
    }

    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const totalDuration = sessions
      .filter(s => s.endTime)
      .reduce((sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()), 0);
    const averageSessionDuration = totalDuration / sessions.length;

    // Count providers and models
    const providerCount: Record<string, number> = {};
    const modelCount: Record<string, number> = {};

    sessions.forEach(session => {
      providerCount[session.provider] = (providerCount[session.provider] || 0) + 1;
      modelCount[session.model] = (modelCount[session.model] || 0) + 1;
    });

    const mostUsedProvider =
      Object.entries(providerCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '';
    const mostUsedModel = Object.entries(modelCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    return {
      totalSessions: sessions.length,
      totalMessages,
      averageSessionDuration,
      mostUsedProvider,
      mostUsedModel,
    };
  }

  /**
   * Private method to log an operation
   */
  private async logOperation(
    operation: ChatLogEntry['operation'],
    data: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.currentSession) return;

    const entry: ChatLogEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      operation,
      data,
      ...(metadata && { metadata }),
    };

    this.currentSession.operations.push(entry);
  }

  /**
   * Save the current session to file
   */
  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const fileName = `chat_${this.currentSession.id}.json`;
      const filePath = path.join(this.logsDir, fileName);
      await fs.writeFile(filePath, JSON.stringify(this.currentSession, null, 2));
    } catch (error) {
      console.warn('Failed to save chat session:', error);
    }
  }

  /**
   * Clean up old logs, keeping only the 10 most recent
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logsDir);
      const sessionFiles = files
        .filter(f => f.endsWith('.json') && f.startsWith('chat_'))
        .map(f => ({
          name: f,
          path: path.join(this.logsDir, f),
        }));

      if (sessionFiles.length <= 10) return;

      // Get file stats to sort by modification time
      const filesWithStats = await Promise.all(
        sessionFiles.map(async file => {
          const stats = await fs.stat(file.path);
          return {
            ...file,
            mtime: stats.mtime,
          };
        })
      );

      // Sort by modification time, newest first
      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete files beyond the first 10
      const filesToDelete = filesWithStats.slice(10);
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`Cleaned up old chat log: ${file.name}`);
        } catch (error) {
          console.warn(`Failed to delete old log ${file.name}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `${timestamp}_${random}`;
  }

  /**
   * Generate a unique entry ID
   */
  private generateEntryId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
}
