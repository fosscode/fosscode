import { Message, ProviderType } from '../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class ChatLogger {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _sessionId: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _sessionProvider: ProviderType | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _sessionModel: string | null = null;

  async initialize(): Promise<void> {
    // Initialize logging
  }

  async startSession(provider: ProviderType, model: string): Promise<void> {
    this._sessionId = `session_${Date.now()}`;
    this._sessionProvider = provider;
    this._sessionModel = model;
  }

  async logMessageSent(message: Message): Promise<void> {
    // Log sent message
    console.log(`[${new Date().toISOString()}] Sent: ${message.content.substring(0, 100)}...`);
  }

  async logMessageReceived(response: any, responseTime?: number): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // Log received message
    console.log(
      `[${new Date().toISOString()}] Received: ${response.content?.substring(0, 100)}...`
    );
  }

  async endSession(reason: string): Promise<void> {
    console.log(`Session ended: ${reason}`);
    this._sessionId = null;
    this._sessionProvider = null;
    this._sessionModel = null;
  }

  async logError(error: Error): Promise<void> {
    console.error(`[${new Date().toISOString()}] Error: ${error.message}`);
  }
}
