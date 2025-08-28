import { ProviderType } from '../types/index.js';
import { CONTEXT_LIMITS, getContextLimit } from './contextLimits.js';

export interface ContextLimitUpdate {
  provider: ProviderType;
  model: string;
  limit: number;
  source: 'api' | 'manual' | 'fallback';
  lastUpdated: Date;
  expiresAt?: Date;
}

export interface ContextLimitConfig {
  enableDynamicUpdates: boolean;
  updateIntervalHours: number;
  fallbackToStatic: boolean;
  cacheExpirationHours: number;
}

export class ContextLimitManager {
  private static instance: ContextLimitManager;
  private dynamicLimits: Map<string, ContextLimitUpdate> = new Map();
  private config: ContextLimitConfig;
  private updateTimer?: NodeJS.Timeout | undefined;

  private constructor(
    config: ContextLimitConfig = {
      enableDynamicUpdates: true,
      updateIntervalHours: 24,
      fallbackToStatic: true,
      cacheExpirationHours: 168, // 1 week
    }
  ) {
    this.config = config;
    this.startPeriodicUpdates();
  }

  static getInstance(config?: ContextLimitConfig): ContextLimitManager {
    if (!ContextLimitManager.instance) {
      ContextLimitManager.instance = new ContextLimitManager(config);
    }
    return ContextLimitManager.instance;
  }

  /**
   * Get context limit with dynamic updates and fallback
   */
  getContextLimit(provider: ProviderType, model: string): number | undefined {
    const cacheKey = `${provider}:${model}`;

    // Check for dynamic limit first
    const dynamicLimit = this.dynamicLimits.get(cacheKey);
    if (dynamicLimit && !this.isExpired(dynamicLimit)) {
      return dynamicLimit.limit;
    }

    // Fallback to static limits
    if (this.config.fallbackToStatic) {
      return getContextLimit(provider, model);
    }

    return undefined;
  }

  /**
   * Update context limit for a specific provider and model
   */
  updateContextLimit(
    provider: ProviderType,
    model: string,
    limit: number,
    source: 'api' | 'manual' = 'manual'
  ): void {
    const cacheKey = `${provider}:${model}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cacheExpirationHours * 60 * 60 * 1000);

    this.dynamicLimits.set(cacheKey, {
      provider,
      model,
      limit,
      source,
      lastUpdated: now,
      expiresAt,
    });
  }

  /**
   * Fetch context limits from provider APIs
   */
  async fetchContextLimitsFromAPI(provider: ProviderType): Promise<void> {
    try {
      // This would integrate with provider APIs to get current limits
      // For now, we'll simulate API calls with known limits
      const providerLimits = CONTEXT_LIMITS[provider];
      if (providerLimits) {
        for (const [model, limit] of Object.entries(providerLimits)) {
          if (model !== 'default') {
            this.updateContextLimit(provider, model, limit, 'api');
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch context limits for ${provider}:`, error);
    }
  }

  /**
   * Start periodic updates for all providers
   */
  private startPeriodicUpdates(): void {
    if (!this.config.enableDynamicUpdates) return;

    const intervalMs = this.config.updateIntervalHours * 60 * 60 * 1000;

    this.updateTimer = setInterval(async () => {
      const providers = Object.keys(CONTEXT_LIMITS) as ProviderType[];
      for (const provider of providers) {
        await this.fetchContextLimitsFromAPI(provider);
      }
    }, intervalMs);

    // Initial fetch
    setTimeout(async () => {
      const providers = Object.keys(CONTEXT_LIMITS) as ProviderType[];
      for (const provider of providers) {
        await this.fetchContextLimitsFromAPI(provider);
      }
    }, 1000); // Start after 1 second
  }

  /**
   * Check if a cached limit is expired
   */
  private isExpired(update: ContextLimitUpdate): boolean {
    return update.expiresAt ? new Date() > update.expiresAt : false;
  }

  /**
   * Get all cached dynamic limits
   */
  getAllDynamicLimits(): ContextLimitUpdate[] {
    return Array.from(this.dynamicLimits.values());
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    for (const [key, update] of this.dynamicLimits.entries()) {
      if (this.isExpired(update)) {
        this.dynamicLimits.delete(key);
      }
    }
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContextLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart periodic updates if configuration changed
    if (
      newConfig.enableDynamicUpdates !== undefined ||
      newConfig.updateIntervalHours !== undefined
    ) {
      this.stopPeriodicUpdates();
      this.startPeriodicUpdates();
    }
  }
}
