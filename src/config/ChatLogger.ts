import * as path from 'path';
import * as os from 'os';
import { Message, ProviderType, ProviderResponse } from '../types/index.js';
import { ChatSession } from './chatLogger/types.js';
import { ChatSessionManager } from './chatLogger/sessionManager.js';
import { ChatOperationLogger } from './chatLogger/operationLogger.js';
import { ChatDataManager } from './chatLogger/dataManager.js';
import { ChatFileManager } from './chatLogger/fileManager.js';
import { ChatLoggerUtils } from './chatLogger/utils.js';

export class ChatLogger {
  private configDir: string;
  private logsDir: string;
  private sessionManager: ChatSessionManager;
  private operationLogger: ChatOperationLogger;
  private dataManager: ChatDataManager;
  private fileManager: ChatFileManager;

  constructor() {
    // Use XDG config directory: ~/.config/fosscode/
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.configDir = path.join(xdgConfigDir, 'fosscode');
    this.logsDir = path.join(this.configDir, 'chat_logs');

    this.sessionManager = new ChatSessionManager();
    this.operationLogger = new ChatOperationLogger(this.sessionManager);
    this.dataManager = new ChatDataManager(this.logsDir);
    this.fileManager = new ChatFileManager(this.logsDir);
  }

  /**
   * Initialize the logging system
   */
  async initialize(): Promise<void> {
    await this.fileManager.initialize();
  }

  /**
   * Start a new chat session
   */
  async startSession(provider: ProviderType, model: string): Promise<string> {
    const sessionId = ChatLoggerUtils.generateSessionId();
    await this.sessionManager.startSession(provider, model, sessionId);

    // Log session start
    await this.operationLogger.logSessionStarted(provider, model, sessionId);

    // Show the new chat file name for debugging
    const fileName = `chat_${sessionId}.json`;
    console.log(`Started new chat session: ${fileName}`);

    return sessionId;
  }

  /**
   * End the current chat session
   */
  async endSession(status: 'completed' | 'error' = 'completed'): Promise<void> {
    const currentSession = this.sessionManager.currentSessionData;
    if (!currentSession) return;

    const duration = Date.now() - currentSession.startTime.getTime();
    const messageCount = currentSession.messageCount;

    await this.sessionManager.endSession(status);

    // Log session end
    await this.operationLogger.logSessionEnded(status, duration, messageCount);

    // Save the session to file
    await this.fileManager.saveSession(currentSession);
  }

  /**
   * Log a message being sent
   */
  async logMessageSent(
    message: Message,
    attachedFiles?: { path: string; content: string }[]
  ): Promise<void> {
    await this.operationLogger.logMessageSent(message, attachedFiles);
  }

  /**
   * Log a message being received
   */
  async logMessageReceived(response: ProviderResponse, responseTime?: number): Promise<void> {
    await this.operationLogger.logMessageReceived(response, responseTime);
  }

  /**
   * Log an error that occurred
   */
  async logError(error: Error, context?: string): Promise<void> {
    await this.operationLogger.logError(error, context);
  }

  /**
   * Log a command being executed
   */
  async logCommand(command: string, result?: any): Promise<void> {
    await this.operationLogger.logCommand(command, result);
  }

  /**
   * Log a file being attached
   */
  async logFileAttached(filePath: string, fileSize?: number): Promise<void> {
    await this.operationLogger.logFileAttached(filePath, fileSize);
  }

  /**
   * Log a mode change
   */
  async logModeChanged(fromMode: string, toMode: string): Promise<void> {
    await this.operationLogger.logModeChanged(fromMode, toMode);
  }

  /**
   * Log a streaming token from LLM
   */
  async logStreamingToken(token: string, isThinking?: boolean): Promise<void> {
    await this.operationLogger.logStreamingToken(token, isThinking);
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
    await this.operationLogger.logBackendOperation(operation, details, duration, success);
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
    await this.operationLogger.logApiCall(
      provider,
      endpoint,
      method,
      requestData,
      responseData,
      duration,
      statusCode,
      error
    );
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
    await this.operationLogger.logToolExecution(toolName, parameters, result, duration, success);
  }

  /**
   * Get all chat sessions
   */
  async getAllSessions(): Promise<ChatSession[]> {
    return this.dataManager.getAllSessions();
  }

  /**
   * Get a specific chat session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.dataManager.getSession(sessionId);
  }

  /**
   * Delete a specific chat session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    return this.dataManager.deleteSession(sessionId);
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
    return this.dataManager.getStats();
  }
}
