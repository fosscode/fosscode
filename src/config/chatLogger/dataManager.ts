import { promises as fs } from 'fs';
import * as path from 'path';
import { ChatSession, ChatLogEntry } from './types.js';

export class ChatDataManager {
  constructor(private logsDir: string) {}

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
}
