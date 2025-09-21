import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppConfig, ProviderType, LLMConfig } from '../types/index.js';
import { ConfigMigration } from './ConfigMigration.js';
import { ConfigDefaults } from './ConfigDefaults.js';
import { ModelCacheManager } from './ModelCacheManager.js';
import { ConfigValidator } from './ConfigValidator.js';

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;
  private modelCacheManager: ModelCacheManager;

  constructor() {
    // Use XDG config directory: ~/.config/fosscode/
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.configPath = path.join(xdgConfigDir, 'fosscode', 'config.json');
    this.config = ConfigDefaults.getDefaultConfig();
    this.modelCacheManager = new ModelCacheManager(this.config.cachedModels);
    this.initializeConfig();
  }

  private async initializeConfig(): Promise<void> {
    const migration = new ConfigMigration(this.configPath);
    await migration.migrateLegacyConfig();
  }

  getDefaultModelForProvider(provider: string): string {
    return ConfigDefaults.getDefaultModelForProvider(provider);
  }

  async loadConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      const configData = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configData);

      // Merge with default config to ensure all properties exist
      this.config = { ...ConfigDefaults.getDefaultConfig(), ...loadedConfig };
      this.modelCacheManager = new ModelCacheManager(this.config.cachedModels);
    } catch {
      // If config doesn't exist or is invalid, use defaults
      this.config = ConfigDefaults.getDefaultConfig();
      this.modelCacheManager = new ModelCacheManager(this.config.cachedModels);
      await this.saveConfig();
    }
  }

  async saveConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async validateConfig(): Promise<void> {
    await this.loadConfig();
    ConfigValidator.validateConfigHasProviders(this.config.providers);
  }

  async validateProvider(provider: ProviderType): Promise<void> {
    await this.loadConfig();
    const providerConfig = this.config.providers[provider];
    await ConfigValidator.validateProvider(provider, providerConfig);
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    await this.loadConfig();

    // Support nested keys like "providers.openai.apiKey"
    const keys = key.split('.');

    // Validate keys to prevent prototype pollution
    for (const k of keys) {
      if (this.isPrototypePollutingKey(k)) {
        throw new Error(`Invalid config key: ${k}`);
      }
    }

    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!Object.hasOwn(current, keys[i])) {
        current[keys[i]] = {};
      }
      current = current[keys[i]] as Record<string, unknown>;
    }

    const finalKey = keys[keys.length - 1];
    if (this.isPrototypePollutingKey(finalKey)) {
      throw new Error(`Invalid config key: ${finalKey}`);
    }
    current[finalKey] = value;
    await this.saveConfig();
  }

  private isPrototypePollutingKey(key: string): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    return dangerousKeys.includes(key);
  }

  getProviderConfig(provider: ProviderType): LLMConfig {
    return this.config.providers[provider] || {};
  }

  async setProviderConfig(provider: ProviderType, config: Partial<LLMConfig>): Promise<void> {
    await this.loadConfig();
    this.config.providers[provider] = { ...this.config.providers[provider], ...config };
    await this.saveConfig();
  }

  getDefaultProvider(): ProviderType {
    return this.config.defaultProvider;
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  getDefaultModelForCurrentProvider(): string {
    return this.getDefaultModelForProvider(this.config.defaultProvider);
  }

  async getCachedModels(provider: ProviderType): Promise<string[] | null> {
    await this.loadConfig();
    return this.modelCacheManager.getCachedModels(provider);
  }

  async setCachedModels(provider: ProviderType, models: string[]): Promise<void> {
    await this.loadConfig();
    this.modelCacheManager.setCachedModels(provider, models);
    this.config.cachedModels = this.modelCacheManager.getConfig();
    await this.saveConfig();
  }

  async clearModelCache(provider?: ProviderType): Promise<void> {
    await this.loadConfig();
    this.modelCacheManager.clearModelCache(provider);
    this.config.cachedModels = this.modelCacheManager.getConfig();
    await this.saveConfig();
  }

  isModelCacheExpired(provider: ProviderType): boolean {
    return this.modelCacheManager.isModelCacheExpired(provider);
  }
}
