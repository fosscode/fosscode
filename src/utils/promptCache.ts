import { Message, ProviderType } from '../types/index.js';

export interface CachedPrompt {
  id: string;
  messages: Message[];
  response: string;
  provider: ProviderType;
  model: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  tokensUsed: number;
  expiresAt?: Date;
}

export interface PromptCacheConfig {
  enableCaching: boolean;
  maxCacheSize: number;
  cacheExpirationHours: number;
  minAccessCount: number; // Minimum accesses before considering permanent
  similarityThreshold: number; // For fuzzy matching (0-1)
}

export class PromptCacheManager {
  private static instance: PromptCacheManager;
  private cache: Map<string, CachedPrompt> = new Map();
  private config: PromptCacheConfig;

  private constructor(
    config: PromptCacheConfig = {
      enableCaching: true,
      maxCacheSize: 1000,
      cacheExpirationHours: 24,
      minAccessCount: 3,
      similarityThreshold: 0.85,
    }
  ) {
    this.config = config;
    this.startCleanupTimer();
  }

  static getInstance(config?: PromptCacheConfig): PromptCacheManager {
    if (!PromptCacheManager.instance) {
      PromptCacheManager.instance = new PromptCacheManager(config);
    }
    return PromptCacheManager.instance;
  }

  /**
   * Generate a cache key from messages
   */
  private generateCacheKey(messages: Message[], provider: ProviderType, model: string): string {
    const contentHash = this.hashMessages(messages);
    return `${provider}:${model}:${contentHash}`;
  }

  /**
   * Create a simple hash of message contents
   */
  private hashMessages(messages: Message[]): string {
    const content = messages.map(msg => `${msg.role}:${msg.content}`).join('|');
    return this.simpleHash(content);
  }

  /**
   * Simple string hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if cached prompt exists and is valid
   */
  getCachedResponse(messages: Message[], provider: ProviderType, model: string): string | null {
    if (!this.config.enableCaching) return null;

    const cacheKey = this.generateCacheKey(messages, provider, model);
    const cached = this.cache.get(cacheKey);

    if (!cached) return null;

    // Check expiration
    if (this.isExpired(cached)) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update access statistics
    cached.lastAccessed = new Date();
    cached.accessCount++;

    return cached.response;
  }

  /**
   * Store a response in cache
   */
  cacheResponse(
    messages: Message[],
    response: string,
    provider: ProviderType,
    model: string,
    tokensUsed: number
  ): void {
    if (!this.config.enableCaching) return;

    // Clean up expired entries if cache is getting full
    if (this.cache.size >= this.config.maxCacheSize * 0.9) {
      this.cleanupExpiredEntries();
    }

    // If still at capacity, remove least recently used
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const cacheKey = this.generateCacheKey(messages, provider, model);
    const expiresAt = new Date(Date.now() + this.config.cacheExpirationHours * 60 * 60 * 1000);

    const cachedPrompt: CachedPrompt = {
      id: cacheKey,
      messages: [...messages], // Store copy
      response,
      provider,
      model,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      tokensUsed,
      expiresAt,
    };

    this.cache.set(cacheKey, cachedPrompt);
  }

  /**
   * Find similar cached prompts using fuzzy matching
   */
  findSimilarPrompt(
    messages: Message[],
    provider: ProviderType,
    model: string
  ): CachedPrompt | null {
    if (!this.config.enableCaching) return null;

    const currentContent = messages.map(msg => msg.content).join(' ');
    let bestMatch: CachedPrompt | null = null;
    let bestSimilarity = 0;

    for (const cached of this.cache.values()) {
      if (cached.provider !== provider || cached.model !== model) continue;
      if (this.isExpired(cached)) continue;

      const cachedContent = cached.messages.map(msg => msg.content).join(' ');
      const similarity = this.calculateSimilarity(currentContent, cachedContent);

      if (similarity > this.config.similarityThreshold && similarity > bestSimilarity) {
        bestMatch = cached;
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings (simple Jaccard similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Check if cached prompt is expired
   */
  private isExpired(cached: CachedPrompt): boolean {
    if (!cached.expiresAt) return false;
    return new Date() > cached.expiresAt;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    for (const [key, cached] of this.cache.entries()) {
      if (this.isExpired(cached)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, cached] of this.cache.entries()) {
      // Don't evict frequently used items
      if (cached.accessCount >= this.config.minAccessCount) continue;

      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean up every hour
    setInterval(
      () => {
        this.cleanupExpiredEntries();
      },
      60 * 60 * 1000
    );
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalHits: number;
    averageAccessCount: number;
    cacheHitRate: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalEntries = entries.length;
    const totalHits = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const averageAccessCount = totalEntries > 0 ? totalHits / totalEntries : 0;

    // Calculate hit rate (this would need to track total requests)
    const cacheHitRate = 0; // Placeholder - would need request tracking

    return {
      totalEntries,
      totalHits,
      averageAccessCount,
      cacheHitRate,
    };
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PromptCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PromptCacheConfig {
    return { ...this.config };
  }
}
