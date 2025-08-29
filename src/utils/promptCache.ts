import { Message, ProviderType } from '../types/index.js';

interface CacheEntry {
  response: string;
  timestamp: Date;
  tokensUsed: number;
}

export class PromptCacheManager {
  private static instance: PromptCacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxCacheSize = 1000;
  private readonly cacheExpiryMs = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  static getInstance(): PromptCacheManager {
    if (!PromptCacheManager.instance) {
      PromptCacheManager.instance = new PromptCacheManager();
    }
    return PromptCacheManager.instance;
  }

  private generateCacheKey(messages: Message[], provider: ProviderType, model: string): string {
    const messagesString = messages.map(msg => `${msg.role}:${msg.content}`).join('|');
    const hash = this.simpleHash(messagesString);
    return `${hash}:${provider}:${model}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  cacheResponse(
    messages: Message[],
    response: string,
    provider: ProviderType,
    model: string,
    tokensUsed: number
  ): void {
    const key = this.generateCacheKey(messages, provider, model);
    const entry: CacheEntry = {
      response,
      timestamp: new Date(),
      tokensUsed,
    };

    // Clean up expired entries if cache is getting full
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanupExpiredEntries();
    }

    // If still at max capacity, remove oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, entry);
  }

  getCachedResponse(messages: Message[], provider: ProviderType, model: string): string | null {
    const key = this.generateCacheKey(messages, provider, model);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = new Date();
    const age = now.getTime() - entry.timestamp.getTime();
    if (age > this.cacheExpiryMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      if (age > this.cacheExpiryMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number; totalRequests: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track total requests vs hits
      totalRequests: 0,
    };
  }
}
