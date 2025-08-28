import { Message, ProviderResponse } from '../../types/index.js';
import { randomUUID } from 'crypto';
import { ChatLogEntry } from './types.js';
import { ChatSessionManager } from './sessionManager.js';

export class ChatOperationLogger {
  constructor(private sessionManager: ChatSessionManager) {}

  async logMessageSent(
    message: Message,
    attachedFiles?: { path: string; content: string }[]
  ): Promise<void> {
    this.sessionManager.incrementMessageCount();
    await this.logOperation('message_sent', {
      message,
      attachedFiles: attachedFiles ?? [],
      messageNumber: this.sessionManager.getMessageCount(),
    });
  }

  async logMessageReceived(response: ProviderResponse, responseTime?: number): Promise<void> {
    await this.logOperation('message_received', {
      response,
      responseTime,
      messageNumber: this.sessionManager.getMessageCount(),
    });
  }

  async logError(error: Error, context?: string): Promise<void> {
    await this.logOperation('error', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  async logCommand(command: string, result?: any): Promise<void> {
    await this.logOperation('command_executed', {
      command,
      result,
    });
  }

  async logFileAttached(filePath: string, fileSize?: number): Promise<void> {
    await this.logOperation('file_attached', {
      filePath,
      fileSize,
    });
  }

  async logModeChanged(fromMode: string, toMode: string): Promise<void> {
    await this.logOperation('mode_changed', {
      fromMode,
      toMode,
    });
  }

  async logStreamingToken(token: string, isThinking?: boolean): Promise<void> {
    await this.logOperation('streaming_token', {
      token,
      isThinking: isThinking ?? false,
      tokenLength: token.length,
    });
  }

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

  async logSessionStarted(provider: string, model: string, sessionId: string): Promise<void> {
    await this.logOperation('session_started', {
      provider,
      model,
      sessionId,
    });
  }

  async logSessionEnded(status: string, duration: number, messageCount: number): Promise<void> {
    await this.logOperation('session_ended', {
      status,
      duration,
      messageCount,
    });
  }

  private async logOperation(
    operation: ChatLogEntry['operation'],
    data: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const entry: ChatLogEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      operation,
      data,
      ...(metadata && { metadata }),
    };

    this.sessionManager.addOperation(entry);
  }

  private generateEntryId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomUUID().substring(0, 7);
    return `${timestamp}_${random}`;
  }
}
