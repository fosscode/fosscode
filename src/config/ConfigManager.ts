import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppConfig, ProviderType, LLMConfig, MCPServerConfig } from '../types/index.js';
import { ConfigMigration } from './ConfigMigration.js';
import { ConfigDefaults } from './ConfigDefaults.js';
import { ModelCacheManager } from './ModelCacheManager.js';
import { ConfigValidator } from './ConfigValidator.js';

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;
  private modelCacheManager: ModelCacheManager;
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
    // Use XDG config directory: ~/.config/fosscode/
    // Allow override via FOSSCODE_CONFIG_PATH for testing
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.configPath =
      process.env.FOSSCODE_CONFIG_PATH ?? path.join(xdgConfigDir, 'fosscode', 'config.json');
    if (this.verbose) {
      console.log('ConfigManager using config path:', this.configPath);
      console.log('FOSSCODE_CONFIG_PATH env var:', process.env.FOSSCODE_CONFIG_PATH);
    }
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
      if (this.verbose) {
        console.log('Loading config from:', this.configPath);
      }
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      const configData = await fs.readFile(this.configPath, 'utf-8');
      if (this.verbose) {
        console.log('Config data loaded:', configData);
      }
      const loadedConfig = JSON.parse(configData);
      if (this.verbose) {
        console.log('Parsed config:', loadedConfig);
      }

      // Load MCP server configurations from mcp.d directory
      const mcpConfigs = await this.loadMCPConfigs(configDir);

      // Merge with default config to ensure all properties exist
      const defaultConfig = ConfigDefaults.getDefaultConfig();
      this.config = { ...defaultConfig, ...loadedConfig };

      // Deep merge providers to ensure all providers exist with their defaults
      if (loadedConfig.providers) {
        this.config.providers = { ...defaultConfig.providers, ...loadedConfig.providers };
      }

      // Deep merge cachedModels to ensure all providers have model caches
      if (loadedConfig.cachedModels) {
        this.config.cachedModels = { ...defaultConfig.cachedModels, ...loadedConfig.cachedModels };
      }

      if (this.verbose) {
        console.log('Final merged config:', this.config);
      }

      // Merge MCP server configs into the main config
      if (mcpConfigs && Object.keys(mcpConfigs).length > 0) {
        if (!this.config.providers.mcp.mcpServers) {
          this.config.providers.mcp.mcpServers = {};
        }
        this.config.providers.mcp.mcpServers = {
          ...this.config.providers.mcp.mcpServers,
          ...mcpConfigs,
        };
      }

      this.modelCacheManager = new ModelCacheManager(this.config.cachedModels);
    } catch (error) {
      if (this.verbose) {
        console.log('Error loading config:', error);
      }
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

  private async loadMCPConfigs(configDir: string): Promise<Record<string, MCPServerConfig> | null> {
    const mcpDir = path.join(configDir, 'mcp.d');
    const mcpConfigs: Record<string, MCPServerConfig> = {};

    try {
      // Check if mcp.d directory exists
      const stat = await fs.stat(mcpDir);
      if (!stat.isDirectory()) {
        return null;
      }

      // Read all .json files from mcp.d directory
      const files = await fs.readdir(mcpDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(mcpDir, file);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const mcpConfig: MCPServerConfig = JSON.parse(fileContent);

          // Use filename (without .json) as the server name if not specified
          const serverName = mcpConfig.name || path.basename(file, '.json');
          mcpConfig.name = serverName;

          mcpConfigs[serverName] = mcpConfig;
        } catch (error) {
          console.warn(`Failed to load MCP config from ${file}:`, error);
        }
      }

      return Object.keys(mcpConfigs).length > 0 ? mcpConfigs : null;
    } catch (error) {
      // mcp.d directory doesn't exist, which is fine
      return null;
    }
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
