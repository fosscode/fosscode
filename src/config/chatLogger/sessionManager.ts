import { ProviderType } from '../../types/index.js';
import { ChatSession } from './types.js';

export class ChatSessionManager {
  private currentSession: ChatSession | null = null;

  get currentSessionData(): ChatSession | null {
    return this.currentSession;
  }

  set currentSessionData(session: ChatSession | null) {
    this.currentSession = session;
  }

  async startSession(provider: ProviderType, model: string, sessionId: string): Promise<string> {
    this.currentSession = {
      id: sessionId,
      provider,
      model,
      startTime: new Date(),
      messageCount: 0,
      operations: [],
      status: 'active',
    };

    return sessionId;
  }

  async endSession(status: 'completed' | 'error' = 'completed'): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date();
    this.currentSession.status = status;

    // Clear current session
    this.currentSession = null;
  }

  incrementMessageCount(): void {
    if (this.currentSession) {
      this.currentSession.messageCount++;
    }
  }

  addOperation(operation: any): void {
    if (this.currentSession) {
      this.currentSession.operations.push(operation);
    }
  }

  getMessageCount(): number {
    return this.currentSession?.messageCount || 0;
  }
}
