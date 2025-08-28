import { randomUUID } from 'crypto';

export class ChatLoggerUtils {
  static generateSessionId(): string {
    return randomUUID();
  }

  static generateEntryId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomUUID().substring(0, 7);
    return `${timestamp}_${random}`;
  }
}
