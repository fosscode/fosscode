import { Message, ProviderType } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class ChatLogger {
  private _sessionId: string | null = null;
  private _sessionProvider: ProviderType | null = null;
  private _sessionModel: string | null = null;
  private _logFilePath: string | null = null;
  private _logsDir: string;
  private _originalConsoleLog: typeof console.log;
  private _originalConsoleError: typeof console.error;
  private _originalConsoleWarn: typeof console.warn;
  private _originalConsoleInfo: typeof console.info;
  private _originalConsoleDebug: typeof console.debug;
  private _originalConsoleTrace: typeof console.trace;
  private _originalConsoleTable: typeof console.table;
  private _intercepting: boolean = false;

  constructor() {
    this._logsDir = path.join(os.homedir(), '.config', 'fosscode', 'chat_logs');
    this._originalConsoleLog = console.log;
    this._originalConsoleError = console.error;
    this._originalConsoleWarn = console.warn;
    this._originalConsoleInfo = console.info;
    this._originalConsoleDebug = console.debug;
    this._originalConsoleTrace = console.trace;
    this._originalConsoleTable = console.table;
  }

  async initialize(): Promise<void> {
    // Create logs directory if it doesn't exist
    try {
      await fs.mkdir(this._logsDir, { recursive: true });
      // Clean up old log files on initialization
      await this._cleanupOldLogs();
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  async startSession(provider: ProviderType, model: string): Promise<void> {
    this._sessionId = `session_${Date.now()}`;
    this._sessionProvider = provider;
    this._sessionModel = model;

    // Create timestamped log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chat_${timestamp}_${provider}_${model.replace(/[^a-zA-Z0-9]/g, '_')}.log`;
    this._logFilePath = path.join(this._logsDir, filename);

    // Start intercepting console output
    this._startConsoleInterception();

    // Log session start to both console and file
    const sessionStart = `[${new Date().toISOString()}] Session started: ${this._sessionId} [${provider}/${model}]\n`;
    console.log(`📝 Chat log: ${this._logFilePath}`);
    await this._writeToFile(sessionStart);
  }

  async logMessageSent(message: Message): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} SENT: ${message.content}\n`;

    console.log(`[${timestamp}]${sessionInfo} Sent: ${message.content.substring(0, 100)}...`);
    await this._writeToFile(logEntry);
  }

  async logMessageReceived(response: any, responseTime?: number): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const timeInfo = responseTime ? ` (${responseTime}ms)` : '';
    const content = response.content ?? response.text ?? JSON.stringify(response);
    const logEntry = `[${timestamp}]${sessionInfo} RECEIVED${timeInfo}: ${content}\n`;

    console.log(
      `[${timestamp}]${sessionInfo} Received${timeInfo}: ${content.substring(0, 100)}...`
    );
    await this._writeToFile(logEntry);
  }

  async logToolCall(toolName: string, parameters: any, result?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const paramsStr = JSON.stringify(parameters, null, 2);
    const resultStr = result ? `\nResult: ${JSON.stringify(result, null, 2)}` : '';
    const logEntry = `[${timestamp}]${sessionInfo} TOOL_CALL: ${toolName}\nParameters: ${paramsStr}${resultStr}\n`;

    console.log(`[${timestamp}]${sessionInfo} Tool: ${toolName}`);
    await this._writeToFile(logEntry);
  }

  async logThinkingTokens(tokens: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} THINKING: ${tokens}\n`;

    console.log(`[${timestamp}]${sessionInfo} Thinking: ${tokens.substring(0, 100)}...`);
    await this._writeToFile(logEntry);
  }

  async logBackendMessage(
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    metadata?: any
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    const logEntry = `[${timestamp}]${sessionInfo} ${level}: ${message}${metadataStr}\n`;

    if (level === 'ERROR') {
      console.error(`[${timestamp}]${sessionInfo} ${level}: ${message}`);
    } else {
      console.log(`[${timestamp}]${sessionInfo} ${level}: ${message}`);
    }
    await this._writeToFile(logEntry);
  }

  async endSession(reason: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} Session ended: ${reason}\n`;

    // Stop intercepting console output before logging
    this._stopConsoleInterception();

    console.log(`Session ended: ${reason}`);
    if (this._logFilePath) {
      console.log(`📝 Chat log saved to: ${this._logFilePath}`);
    }
    await this._writeToFile(logEntry);

    this._sessionId = null;
    this._sessionProvider = null;
    this._sessionModel = null;
    this._logFilePath = null;
  }

  async logError(error: Error): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} ERROR: ${error.message}\nStack: ${error.stack}\n`;

    console.error(`[${timestamp}]${sessionInfo} Error: ${error.message}`);
    await this._writeToFile(logEntry);
  }

  async logSessionHeader(provider: string, model: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} SESSION_HEADER: fosscode - ${provider} (${model})\n`;

    console.log(`🤖 fosscode - ${provider} (${model})`);
    await this._writeToFile(logEntry);
  }

  async logUserMessageDisplay(message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} USER_DISPLAY: ${message}\n`;

    console.log(`👤 ${message}`);
    await this._writeToFile(logEntry);
  }

  async logThinkingStatus(message: string, isStreaming?: boolean): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const streamingInfo = isStreaming ? ' (streaming enabled)' : '';
    const logEntry = `[${timestamp}]${sessionInfo} THINKING_STATUS: ${message}${streamingInfo}\n`;

    console.log(`🤔 ${message}${isStreaming ? ' (streaming enabled)' : ''}`);
    await this._writeToFile(logEntry);
  }

  async logResponseDisplay(content: string, hasToolExecution: boolean): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const toolInfo = hasToolExecution ? ' (with tool execution)' : '';
    const logEntry = `[${timestamp}]${sessionInfo} RESPONSE_DISPLAY${toolInfo}: ${content}\n`;

    console.log(`🤖 ${content}`);
    await this._writeToFile(logEntry);
  }

  async logUsageStats(usage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} USAGE_STATS: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)\n`;

    console.log(
      `📊 Usage: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)`
    );
    await this._writeToFile(logEntry);
  }

  async logContextInfo(contextDisplay: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} CONTEXT_INFO: ${contextDisplay}\n`;

    console.log(`💭 Context: ${contextDisplay}`);
    await this._writeToFile(logEntry);
  }

  async logContextWarning(warningMessage: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} CONTEXT_WARNING: ${warningMessage}\n`;

    console.log(`⚠️  ${warningMessage}`);
    await this._writeToFile(logEntry);
  }

  async logMessagingHeader(provider: string, model: string, platform: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} MESSAGING_HEADER: fosscode - ${provider} (${model}) via ${platform}\n`;

    console.log(`🤖 fosscode - ${provider} (${model}) via ${platform}`);
    await this._writeToFile(logEntry);
  }

  async logListeningStatus(platform: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} LISTENING_STATUS: Listening for messages on ${platform}\n`;

    console.log(`📱 Listening for messages on ${platform}...`);
    await this._writeToFile(logEntry);
  }

  async logPlatformInit(platform: string, success: boolean, error?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const status = success ? 'SUCCESS' : 'FAILED';
    const errorInfo = error ? ` - ${error}` : '';
    const logEntry = `[${timestamp}]${sessionInfo} PLATFORM_INIT: ${platform} ${status}${errorInfo}\n`;

    if (success) {
      console.log(`✅ ${platform} platform initialized successfully`);
    } else {
      console.log(`❌ Failed to initialize ${platform} platform: ${error}`);
    }
    await this._writeToFile(logEntry);
  }

  async logIncomingMessage(
    userName: string,
    content: string,
    messageId: string,
    chatId: string,
    platform: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} INCOMING_MESSAGE: ${userName}: ${content} (ID: ${messageId}, Chat: ${chatId}, Platform: ${platform})\n`;

    console.log(`👤 ${userName}: ${content}`);
    console.log(`   Message ID: ${messageId}, Chat ID: ${chatId}, Platform: ${platform}`);
    await this._writeToFile(logEntry);
  }

  async logResponseSent(userName: string, success: boolean, error?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const status = success ? 'SUCCESS' : 'FAILED';
    const errorInfo = error ? ` - ${error}` : '';
    const logEntry = `[${timestamp}]${sessionInfo} RESPONSE_SENT: to ${userName} ${status}${errorInfo}\n`;

    if (success) {
      console.log(`🤖 Response sent to ${userName}`);
    } else {
      console.log(`❌ Failed to send response: ${error}`);
    }
    await this._writeToFile(logEntry);
  }

  async logProcessingMessage(content: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} PROCESSING_MESSAGE: ${content}\n`;

    console.log(`⏳ ${content}`);
    await this._writeToFile(logEntry);
  }

  async logShutdown(reason: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const sessionInfo = this._sessionId ? ` [${this._sessionProvider}/${this._sessionModel}]` : '';
    const logEntry = `[${timestamp}]${sessionInfo} SHUTDOWN: ${reason}\n`;

    console.log(`🛑 ${reason}`);
    await this._writeToFile(logEntry);
  }

  private _startConsoleInterception(): void {
    if (this._intercepting) return;

    this._intercepting = true;

    // Intercept console.log
    console.log = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} STDOUT: ${message}\n`;

      // Write to original console
      this._originalConsoleLog(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} STDERR: ${message}\n`;

      // Write to original console
      this._originalConsoleError(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} WARN: ${message}\n`;

      // Write to original console
      this._originalConsoleWarn(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} INFO: ${message}\n`;

      // Write to original console
      this._originalConsoleInfo(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };

    // Intercept console.debug
    console.debug = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} DEBUG: ${message}\n`;

      // Write to original console
      this._originalConsoleDebug(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };

    // Intercept console.trace
    console.trace = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} TRACE: ${message}\n`;

      // Write to original console
      this._originalConsoleTrace(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };

    // Intercept console.table
    console.table = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const sessionInfo = this._sessionId
        ? ` [${this._sessionProvider}/${this._sessionModel}]`
        : '';
      const message = args
        .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');
      const logEntry = `[${timestamp}]${sessionInfo} TABLE: ${message}\n`;

      // Write to original console
      this._originalConsoleTable(...args);
      // Write to log file
      this._writeToFile(logEntry);
    };
  }

  private _stopConsoleInterception(): void {
    if (!this._intercepting) return;

    this._intercepting = false;

    // Restore original console methods
    console.log = this._originalConsoleLog;
    console.error = this._originalConsoleError;
    console.warn = this._originalConsoleWarn;
    console.info = this._originalConsoleInfo;
    console.debug = this._originalConsoleDebug;
    console.trace = this._originalConsoleTrace;
    console.table = this._originalConsoleTable;
  }

  private async _cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this._logsDir);
      const now = Date.now();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds

      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const filePath = path.join(this._logsDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtime.getTime();

        if (age > tenDaysMs) {
          await fs.unlink(filePath);
          console.log(`🗑️  Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  private async _writeToFile(content: string): Promise<void> {
    if (!this._logFilePath) return;

    try {
      await fs.appendFile(this._logFilePath, content, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  getCurrentLogPath(): string | null {
    return this._logFilePath;
  }
}
