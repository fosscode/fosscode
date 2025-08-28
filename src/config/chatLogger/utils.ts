export class ChatLoggerUtils {
  static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `${timestamp}_${random}`;
  }

  static generateEntryId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
}
