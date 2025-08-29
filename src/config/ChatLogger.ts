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

  constructor() {
    this._logsDir = path.join(os.homedir(), '.config', 'fosscode', 'chat_logs');
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
    const content = response.content || response.text || JSON.stringify(response);
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

    console.log(`Session ended: ${reason}`);
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
