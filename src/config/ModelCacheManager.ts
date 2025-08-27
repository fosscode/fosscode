import { ProviderType, CachedModels } from '../types/index.js';

export class ModelCacheManager {
  private config: Record<ProviderType, CachedModels>;

  constructor(config: Record<ProviderType, CachedModels>) {
    this.config = config;
  }

  /**
   * Get cached models for a provider if not expired
   */
  getCachedModels(provider: ProviderType): string[] | null {
    const cached = this.config[provider];

    if (!cached || cached.models.length === 0) {
      return null;
    }

    // Check if cache is expired (24 hours)
    if (new Date() > cached.expiresAt) {
      return null;
    }

    return cached.models;
  }

  /**
   * Set cached models for a provider with 24-hour expiration
   */
  setCachedModels(provider: ProviderType, models: string[]): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    this.config[provider] = {
      models,
      lastUpdated: now,
      expiresAt,
    };
  }

  /**
   * Clear model cache for a specific provider or all providers
   */
  clearModelCache(provider?: ProviderType): void {
    if (provider) {
      this.config[provider] = {
        models: [],
        lastUpdated: new Date(0),
        expiresAt: new Date(0),
      };
    } else {
      // Clear all caches
      for (const p of Object.keys(this.config) as ProviderType[]) {
        this.config[p] = {
          models: [],
          lastUpdated: new Date(0),
          expiresAt: new Date(0),
        };
      }
    }
  }

  /**
   * Check if model cache is expired for a provider
   */
  isModelCacheExpired(provider: ProviderType): boolean {
    const cached = this.config[provider];
    return !cached || cached.models.length === 0 || new Date() > cached.expiresAt;
  }

  /**
   * Get the updated config object
   */
  getConfig(): Record<ProviderType, CachedModels> {
    return { ...this.config };
  }
}
