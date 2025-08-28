import { promises as fs } from 'fs';
import * as path from 'path';
import { ChatSession } from './types.js';

export class ChatFileManager {
  constructor(private logsDir: string) {}

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      await this.cleanupOldLogs();
    } catch (error) {
      console.warn('Failed to initialize chat logging:', error);
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    try {
      // Format timestamp as YYYY-MM-DD_HH-MM-SS
      const timestamp = session.startTime
        .toISOString()
        .replace('T', '_')
        .replace(/:\d{2}\.\d{3}Z$/, '')
        .replace(/:/g, '-');
      const fileName = `chat_${timestamp}_${session.id}.json`;
      const filePath = path.join(this.logsDir, fileName);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.warn('Failed to save chat session:', error);
    }
  }

  async cleanupOldLogs(): Promise<void> {
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
}
