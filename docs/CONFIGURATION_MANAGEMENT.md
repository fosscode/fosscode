# fosscode Configuration Management Documentation

## Overview

The Configuration Management system in fosscode provides a robust, secure, and user-friendly way to manage application settings, provider configurations, and system preferences. It follows XDG Base Directory specifications and includes automatic migration, validation, and caching mechanisms.

## Architecture

### Configuration System Components

```
ConfigManager
├── ConfigDefaults     (Default values & settings)
├── ConfigMigration    (Legacy config migration)
├── ConfigValidator    (Validation & security)
├── ModelCacheManager  (Model list caching)
└── Storage Layer      (File system operations)
```

### Data Flow

```
1. Application Start
   ↓
2. Initialize ConfigManager
   ↓
3. Run Legacy Migration
   ↓
4. Load Configuration File
   ↓
5. Merge with Defaults
   ↓
6. Validate Configuration
   ↓
7. Initialize Providers
   ↓
8. Ready for Operations
```

## Configuration Structure

### File Locations

#### Primary Configuration

```
~/.config/fosscode/config.json    # XDG standard location
```

#### Legacy Location (Auto-migrated)

```
~/.fosscode/config.json           # Legacy location (deprecated)
```

#### Example Configuration File Structure

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4",
  "maxConversations": 100,
  "theme": "dark",
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "organization": "org-...",
      "timeout": 30000,
      "maxRetries": 3,
      "model": "gpt-4",
      "verbose": false
    },
    "grok": {
      "apiKey": "xai-...",
      "baseURL": "https://api.x.ai/v1",
      "timeout": 30000,
      "maxRetries": 3,
      "model": "grok-4-0709",
      "verbose": false
    },
    "lmstudio": {
      "baseURL": "http://localhost:1234",
      "timeout": 60000,
      "maxRetries": 2,
      "model": "local-model",
      "verbose": true
    },
    "openrouter": {
      "apiKey": "sk-or-v1-...",
      "baseURL": "https://openrouter.ai/api/v1",
      "timeout": 30000,
      "maxRetries": 3,
      "model": "anthropic/claude-3-haiku",
      "verbose": false
    },
    "sonicfree": {
      "baseURL": "https://gateway.opencode.ai/v1",
      "timeout": 30000,
      "maxRetries": 3,
      "model": "sonic",
      "verbose": false
    },
    "mcp": {
      "mcpServerCommand": "npx",
      "mcpServerArgs": ["@playwright/mcp@latest"],
      "timeout": 30000,
      "verbose": true
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "timeout": 30000,
      "maxRetries": 3,
      "model": "claude-3-5-sonnet-20241022",
      "verbose": false
    }
  },
  "cachedModels": {
    "openai": {
      "models": ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"],
      "lastUpdated": "2024-01-15T10:30:00.000Z",
      "expiresAt": "2024-01-16T10:30:00.000Z"
    }
  },
  "messagingPlatforms": {
    "telegram": {
      "enabled": true,
      "botToken": "your-telegram-bot-token"
    }
  }
}
```

## Core Components

### ConfigManager

**Location**: `src/config/ConfigManager.ts`

#### Purpose

Central configuration management with CRUD operations, validation, and caching.

#### Key Features

- **XDG Compliance**: Uses `~/.config/fosscode/` directory
- **Automatic Migration**: Migrates from legacy `~/.fosscode/` location
- **Nested Key Support**: Set values using dot notation (e.g., `providers.openai.apiKey`)
- **Security Validation**: Prevents prototype pollution attacks
- **Model Caching**: TTL-based model list caching per provider
- **Atomic Operations**: Safe concurrent access to configuration

#### Core Methods

```typescript
export class ConfigManager {
  // Configuration lifecycle
  async loadConfig(): Promise<void>;
  async saveConfig(): Promise<void>;
  async validateConfig(): Promise<void>;

  // General configuration
  getConfig(): AppConfig;
  async setConfig(key: string, value: unknown): Promise<void>;

  // Provider management
  getProviderConfig(provider: ProviderType): LLMConfig;
  async setProviderConfig(provider: ProviderType, config: Partial<LLMConfig>): Promise<void>;
  async validateProvider(provider: ProviderType): Promise<void>;

  // Default values
  getDefaultProvider(): ProviderType;
  getDefaultModel(): string;
  getDefaultModelForProvider(provider: string): string;

  // Model caching
  async getCachedModels(provider: ProviderType): Promise<string[] | null>;
  async setCachedModels(provider: ProviderType, models: string[]): Promise<void>;
  async clearModelCache(provider?: ProviderType): Promise<void>;
  isModelCacheExpired(provider: ProviderType): boolean;
}
```

#### Implementation Details

##### Configuration Loading

```typescript
async loadConfig(): Promise<void> {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath)
    await fs.mkdir(configDir, { recursive: true })

    // Read configuration file
    const configData = await fs.readFile(this.configPath, 'utf-8')
    const loadedConfig = JSON.parse(configData)

    // Merge with defaults to ensure all properties exist
    this.config = { ...ConfigDefaults.getDefaultConfig(), ...loadedConfig }
    this.modelCacheManager = new ModelCacheManager(this.config.cachedModels)
  } catch (error) {
    // If config doesn't exist or is invalid, use defaults
    this.config = ConfigDefaults.getDefaultConfig()
    this.modelCacheManager = new ModelCacheManager(this.config.cachedModels)
    await this.saveConfig()
  }
}
```

##### Nested Key Setting

```typescript
async setConfig(key: string, value: unknown): Promise<void> {
  await this.loadConfig()

  // Support nested keys like "providers.openai.apiKey"
  const keys = key.split('.')

  // Validate keys to prevent prototype pollution
  for (const k of keys) {
    if (this.isPrototypePollutingKey(k)) {
      throw new Error(`Invalid config key: ${k}`)
    }
  }

  // Navigate to nested object
  let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>
  for (let i = 0; i < keys.length - 1; i++) {
    if (!Object.hasOwn(current, keys[i])) {
      current[keys[i]] = {}
    }
    current = current[keys[i]] as Record<string, unknown>
  }

  // Set final value
  const finalKey = keys[keys.length - 1]
  current[finalKey] = value
  await this.saveConfig()
}

private isPrototypePollutingKey(key: string): boolean {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype']
  return dangerousKeys.includes(key)
}
```

### ConfigDefaults

**Location**: `src/config/ConfigDefaults.ts`

#### Purpose

Centralized default values and fallback configurations.

#### Features

- **Provider Defaults**: Default settings for each provider
- **Model Mapping**: Default models for each provider
- **System Defaults**: Application-level default settings
- **Cache Initialization**: Default cache structures

#### Implementation

```typescript
export class ConfigDefaults {
  static getDefaultConfig(): AppConfig {
    return {
      defaultProvider: 'openai',
      defaultModel: 'gpt-3.5-turbo',
      maxConversations: 100,
      theme: 'dark',
      providers: {
        openai: {},
        grok: {},
        lmstudio: { baseURL: 'http://localhost:1234' },
        openrouter: {},
        sonicfree: { baseURL: 'https://gateway.opencode.ai/v1' },
        mcp: {
          mcpServerCommand: 'npx',
          mcpServerArgs: ['@playwright/mcp@latest'],
        },
        anthropic: {},
        mock: {},
      },
      cachedModels: {
        // Initialize empty caches for all providers
        openai: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        grok: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        // ... other providers
      },
    };
  }

  static getDefaultModelForProvider(provider: string): string {
    const modelMap = {
      openai: 'gpt-3.5-turbo',
      grok: 'grok-4-0709',
      lmstudio: 'local-model',
      openrouter: 'anthropic/claude-3-haiku',
      sonicfree: 'sonic',
      mcp: 'mcp-server',
      anthropic: 'claude-3-5-sonnet-20241022',
      mock: 'mock-model',
    };

    return modelMap[provider] || 'gpt-3.5-turbo';
  }
}
```

### ConfigMigration

**Location**: `src/config/ConfigMigration.ts`

#### Purpose

Automatic migration from legacy configuration locations to XDG-compliant paths.

#### Migration Process

```typescript
export class ConfigMigration {
  async migrateLegacyConfig(): Promise<void> {
    // Check for legacy config location
    const legacyConfigPath = path.join(os.homedir(), '.fosscode', 'config.json');

    try {
      await fs.promises.access(legacyConfigPath);

      // Legacy config exists, migrate it
      const legacyConfigData = await fs.promises.readFile(legacyConfigPath, 'utf-8');
      const legacyConfig = JSON.parse(legacyConfigData);

      // Ensure new config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.promises.mkdir(configDir, { recursive: true });

      // Write to new XDG location
      await fs.promises.writeFile(this.configPath, JSON.stringify(legacyConfig, null, 2));

      // Create backup and remove old config
      const backupPath = path.join(os.homedir(), '.fosscode', 'config.json.backup');
      await fs.promises.rename(legacyConfigPath, backupPath);

      console.log('✅ Config migrated from ~/.fosscode/ to ~/.config/fosscode/');
      console.log('📁 Backup created at ~/.fosscode/config.json.backup');
    } catch {
      // Legacy config doesn't exist or migration already done
    }
  }
}
```

#### Migration Benefits

- **Zero Downtime**: Migration happens automatically on first run
- **Data Safety**: Creates backup of original configuration
- **User Notification**: Informs user of successful migration
- **Idempotent**: Safe to run multiple times

### ConfigValidator

**Location**: `src/config/ConfigValidator.ts`

#### Purpose

Comprehensive validation of configuration settings with provider-specific rules.

#### Validation Rules

```typescript
export class ConfigValidator {
  static async validateProvider(provider: ProviderType, providerConfig: LLMConfig): Promise<void> {
    // LMStudio validation (local server)
    if (provider === 'lmstudio') {
      if (!providerConfig.baseURL) {
        throw new Error(
          'LMStudio baseURL not configured. Please run: fosscode auth login lmstudio'
        );
      }
      return;
    }

    // SonicFree validation (free service)
    if (provider === 'sonicfree') {
      if (!providerConfig.baseURL) {
        throw new Error(
          'SonicFree baseURL not configured. Please run: fosscode auth login sonicfree'
        );
      }
      return;
    }

    // MCP validation (external servers)
    if (provider === 'mcp') {
      if (
        !providerConfig.mcpServerUrl &&
        (!providerConfig.mcpServerCommand ||
          !providerConfig.mcpServerArgs ||
          providerConfig.mcpServerArgs.length === 0)
      ) {
        throw new Error(
          'MCP server not configured. Please set either mcpServerUrl or both mcpServerCommand and mcpServerArgs.'
        );
      }
      return;
    }

    // API key validation for other providers
    if (!providerConfig.apiKey) {
      throw new Error(
        `No API key configured for ${provider}. Please run: fosscode auth login ${provider}`
      );
    }
  }

  static validateConfigHasProviders(config: Record<ProviderType, LLMConfig>): void {
    const configuredProviders = Object.entries(config)
      .filter(([provider, config]) => {
        if (provider === 'mcp') {
          return (
            config.mcpServerUrl ??
            (config.mcpServerCommand && config.mcpServerArgs && config.mcpServerArgs.length > 0)
          );
        }
        return config.apiKey ?? config.baseURL;
      })
      .map(([provider]) => provider as ProviderType);

    if (configuredProviders.length === 0) {
      throw new Error(
        'No providers configured. Please configure at least one provider using: fosscode auth login <provider>'
      );
    }
  }
}
```

### ModelCacheManager

**Location**: `src/config/ModelCacheManager.ts`

#### Purpose

Efficient caching of model lists with TTL (Time-To-Live) management.

#### Features

- **TTL Management**: 24-hour cache expiration
- **Provider Isolation**: Separate caches per provider
- **Cache Invalidation**: Manual and automatic cache clearing
- **Fallback Handling**: Use expired cache if API fails

#### Implementation

```typescript
export class ModelCacheManager {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private cachedModels: Record<ProviderType, CachedModels>;

  constructor(cachedModels: Record<ProviderType, CachedModels>) {
    this.cachedModels = cachedModels;
  }

  getCachedModels(provider: ProviderType): string[] | null {
    const cache = this.cachedModels[provider];
    if (!cache || cache.models.length === 0) {
      return null;
    }

    // Check if cache is still valid
    if (new Date() < cache.expiresAt) {
      return cache.models;
    }

    // Cache expired but has data - return null to trigger refresh
    // (expired cache can be used as fallback if API fails)
    return null;
  }

  setCachedModels(provider: ProviderType, models: string[]): void {
    const now = new Date();
    this.cachedModels[provider] = {
      models,
      lastUpdated: now,
      expiresAt: new Date(now.getTime() + this.CACHE_TTL),
    };
  }

  isModelCacheExpired(provider: ProviderType): boolean {
    const cache = this.cachedModels[provider];
    if (!cache) return true;

    return new Date() >= cache.expiresAt;
  }

  clearModelCache(provider?: ProviderType): void {
    if (provider) {
      this.cachedModels[provider] = {
        models: [],
        lastUpdated: new Date(0),
        expiresAt: new Date(0),
      };
    } else {
      // Clear all caches
      for (const providerKey of Object.keys(this.cachedModels)) {
        this.clearModelCache(providerKey as ProviderType);
      }
    }
  }
}
```

## Configuration Commands

### Setting Configuration Values

#### Basic Usage

```bash
# Set top-level configuration
fosscode config set defaultProvider openai
fosscode config set defaultModel gpt-4
fosscode config set theme light

# Set provider-specific configuration
fosscode config set providers.openai.apiKey "sk-..."
fosscode config set providers.openai.model "gpt-4"
fosscode config set providers.openai.timeout 30000

# Set nested configuration
fosscode config set providers.grok.apiKey "xai-..."
fosscode config set providers.grok.baseURL "https://api.x.ai/v1"
```

#### Advanced Examples

```bash
# Configure LMStudio
fosscode config set providers.lmstudio.baseURL "http://192.168.1.100:1234"
fosscode config set providers.lmstudio.timeout 60000

# Configure MCP servers
fosscode config set providers.mcp.mcpServerCommand "npx"
fosscode config set providers.mcp.mcpServerArgs '["@playwright/mcp@latest"]'

# Configure messaging platforms
fosscode config set messagingPlatforms.telegram.enabled true
fosscode config set messagingPlatforms.telegram.botToken "your-bot-token"

# Configure UI preferences
fosscode config set theme "dark"
fosscode config set maxConversations 50
```

## Provider Authentication

### Authentication Flow

Each provider has specific authentication requirements handled by the `AuthCommand`:

#### OpenAI Authentication

```bash
fosscode auth login openai
# Prompts for API key (sk-...)
# Optionally prompts for organization ID
# Validates key format and saves to config
```

#### Grok (xAI) Authentication

```bash
fosscode auth login grok
# Prompts for API key (xai-...)
# Validates key format
# Sets default baseURL to https://api.x.ai/v1
```

#### LMStudio Authentication

```bash
fosscode auth login lmstudio
# Prompts for server URL (default: http://localhost:1234)
# Tests connection to server
# No API key required for local instance
```

#### Anthropic Authentication

```bash
fosscode auth login anthropic
# Prompts for API key (sk-ant-...)
# Validates key format
# Sets default model to claude-3-5-sonnet-20241022
```

#### OpenRouter Authentication

```bash
fosscode auth login openrouter
# Prompts for API key (sk-or-v1-...)
# Sets baseURL to https://openrouter.ai/api/v1
# Supports hundreds of models through single API
```

#### MCP Authentication

```bash
fosscode auth login mcp
# Prompts for server command and arguments
# Example: command="npx", args=["@playwright/mcp@latest"]
# Tests server connectivity
```

### Authentication Implementation

```typescript
export class AuthCommand {
  async login(provider: string): Promise<void> {
    const configManager = new ConfigManager();
    await configManager.loadConfig();

    switch (provider) {
      case 'openai':
        await this.loginOpenAI(configManager);
        break;
      case 'grok':
        await this.loginGrok(configManager);
        break;
      case 'lmstudio':
        await this.loginLMStudio(configManager);
        break;
      case 'anthropic':
        await this.loginAnthropic(configManager);
        break;
      case 'openrouter':
        await this.loginOpenRouter(configManager);
        break;
      case 'mcp':
        await this.loginMCP(configManager);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async loginOpenAI(configManager: ConfigManager): Promise<void> {
    // Prompt for API key
    const apiKey = await this.promptForInput('Enter your OpenAI API key:', true);

    // Validate key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Optional organization
    const organization = await this.promptForInput('Enter organization ID (optional):', false);

    // Save configuration
    const config: Partial<LLMConfig> = { apiKey };
    if (organization) config.organization = organization;

    await configManager.setProviderConfig('openai', config);

    console.log('✅ OpenAI configuration saved');
  }
}
```

## Environment Variable Support

### Configuration Override

Environment variables can override configuration file settings:

```bash
# Override provider API keys
export FOSSCODE_OPENAI_API_KEY="sk-..."
export FOSSCODE_GROK_API_KEY="xai-..."
export FOSSCODE_ANTHROPIC_API_KEY="sk-ant-..."

# Override provider settings
export FOSSCODE_LMSTUDIO_BASE_URL="http://192.168.1.100:1234"
export FOSSCODE_DEFAULT_PROVIDER="grok"
export FOSSCODE_DEFAULT_MODEL="grok-4-0709"

# Override MCP settings
export FOSSCODE_MCP_SERVER_COMMAND="python"
export FOSSCODE_MCP_SERVER_ARGS='["-m", "my_mcp_server"]'
```

### Environment Variable Precedence

1. **Environment Variables** (highest priority)
2. **Configuration File** (`~/.config/fosscode/config.json`)
3. **Default Values** (lowest priority)

```typescript
// Environment variable loading example
function loadEnvironmentOverrides(config: AppConfig): AppConfig {
  // API key overrides
  if (process.env.FOSSCODE_OPENAI_API_KEY) {
    config.providers.openai.apiKey = process.env.FOSSCODE_OPENAI_API_KEY;
  }

  // Default provider override
  if (process.env.FOSSCODE_DEFAULT_PROVIDER) {
    config.defaultProvider = process.env.FOSSCODE_DEFAULT_PROVIDER as ProviderType;
  }

  // Model overrides
  if (process.env.FOSSCODE_DEFAULT_MODEL) {
    config.defaultModel = process.env.FOSSCODE_DEFAULT_MODEL;
  }

  return config;
}
```

## Security Considerations

### API Key Protection

#### Storage Security

- **File Permissions**: Configuration file restricted to user read/write only (600)
- **No Logging**: API keys never written to logs or console output
- **Memory Protection**: Keys cleared from memory after use where possible

#### Validation Security

- **Format Validation**: API keys validated for correct format before storage
- **Prototype Pollution Protection**: Configuration keys validated against dangerous patterns
- **Input Sanitization**: All configuration inputs sanitized before processing

```typescript
// Security implementation
async saveConfig(): Promise<void> {
  try {
    const configDir = path.dirname(this.configPath)
    await fs.mkdir(configDir, { recursive: true })

    // Write with restricted permissions
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), {
      mode: 0o600 // Owner read/write only
    })
  } catch (error) {
    throw new Error(`Failed to save configuration: ${error.message}`)
  }
}

// Prototype pollution prevention
private isPrototypePollutingKey(key: string): boolean {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype']
  return dangerousKeys.includes(key)
}
```

### Configuration Validation

#### Input Validation

```typescript
// Validate configuration structure
function validateConfigStructure(config: any): config is AppConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.defaultProvider === 'string' &&
    typeof config.defaultModel === 'string' &&
    typeof config.providers === 'object'
  )
}

// Validate provider configurations
async validateAllProviders(config: AppConfig): Promise<void> {
  for (const [provider, providerConfig] of Object.entries(config.providers)) {
    try {
      await ConfigValidator.validateProvider(provider as ProviderType, providerConfig)
    } catch (error) {
      console.warn(`Provider ${provider} configuration invalid: ${error.message}`)
    }
  }
}
```

## Debugging Configuration

### Configuration Inspection

```bash
# View current configuration (API keys masked)
fosscode config show

# View provider-specific configuration
fosscode config show --provider openai

# View model cache status
fosscode config cache --status

# Clear model cache
fosscode config cache --clear
fosscode config cache --clear --provider openai
```

### Common Configuration Issues

#### Issue: "No providers configured"

```bash
# Solution: Configure at least one provider
fosscode auth login openai
# or
fosscode auth login grok
```

#### Issue: "Invalid API key"

```bash
# Solution: Re-configure with correct API key
fosscode auth login openai
# Ensure API key starts with correct prefix (sk- for OpenAI, xai- for Grok)
```

#### Issue: "LMStudio server not accessible"

```bash
# Solution: Check LMStudio server is running and accessible
fosscode config set providers.lmstudio.baseURL "http://localhost:1234"
# Test connection manually:
curl http://localhost:1234/v1/models
```

#### Issue: "Configuration file corrupted"

```bash
# Solution: Reset to defaults
rm ~/.config/fosscode/config.json
fosscode auth login openai  # Reconfigure providers
```

## Configuration Migration

### Version Compatibility

fosscode automatically handles configuration format changes between versions:

#### Migration Process

1. **Detection**: Check for configuration format version
2. **Backup**: Create backup of existing configuration
3. **Migration**: Apply necessary transformations
4. **Validation**: Ensure migrated configuration is valid
5. **Cleanup**: Remove obsolete configuration keys

#### Example Migration

```typescript
// Migrate from v0.1.x to v0.2.x format
function migrateV1ToV2(config: any): AppConfig {
  // Rename old keys
  if (config.openaiApiKey) {
    config.providers = config.providers || {};
    config.providers.openai = config.providers.openai || {};
    config.providers.openai.apiKey = config.openaiApiKey;
    delete config.openaiApiKey;
  }

  // Add new required fields
  config.cachedModels = config.cachedModels || ConfigDefaults.getDefaultConfig().cachedModels;

  return config;
}
```

## Performance Optimization

### Configuration Caching

```typescript
export class ConfigManager {
  private configCache?: AppConfig;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds

  async loadConfig(): Promise<void> {
    const now = Date.now();

    // Use cached config if still valid
    if (this.configCache && now - this.cacheTimestamp < this.CACHE_TTL) {
      this.config = this.configCache;
      return;
    }

    // Load from disk
    await this.loadConfigFromDisk();

    // Update cache
    this.configCache = { ...this.config };
    this.cacheTimestamp = now;
  }
}
```

### Lazy Loading

```typescript
// Load configuration only when needed
class LazyConfigManager {
  private config?: AppConfig;

  async getConfig(): Promise<AppConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  async getProviderConfig(provider: ProviderType): Promise<LLMConfig> {
    const config = await this.getConfig();
    return config.providers[provider] || {};
  }
}
```

## Testing

### Configuration Testing

```typescript
describe('ConfigManager', () => {
  let tempConfigPath: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempConfigPath = path.join(os.tmpdir(), `test-config-${Date.now()}.json`);
    configManager = new ConfigManager(tempConfigPath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempConfigPath);
    } catch {}
  });

  it('should create default configuration', async () => {
    await configManager.loadConfig();
    const config = configManager.getConfig();

    expect(config.defaultProvider).toBe('openai');
    expect(config.defaultModel).toBe('gpt-3.5-turbo');
    expect(config.providers).toBeDefined();
  });

  it('should set nested configuration values', async () => {
    await configManager.setConfig('providers.openai.apiKey', 'sk-test');

    const providerConfig = configManager.getProviderConfig('openai');
    expect(providerConfig.apiKey).toBe('sk-test');
  });

  it('should prevent prototype pollution', async () => {
    await expect(configManager.setConfig('__proto__.polluted', 'value')).rejects.toThrow(
      'Invalid config key'
    );
  });

  it('should migrate legacy configuration', async () => {
    const migration = new ConfigMigration(tempConfigPath);

    // Create legacy config
    const legacyPath = path.join(os.tmpdir(), '.fosscode', 'config.json');
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, JSON.stringify({ defaultProvider: 'grok' }));

    // Run migration
    await migration.migrateLegacyConfig();

    // Check migrated config
    await configManager.loadConfig();
    expect(configManager.getConfig().defaultProvider).toBe('grok');
  });
});
```

## Future Enhancements

### Planned Features

1. **Configuration UI**: Web-based configuration interface
2. **Profile Management**: Multiple configuration profiles
3. **Configuration Sync**: Cloud-based configuration synchronization
4. **Advanced Validation**: Schema-based configuration validation
5. **Configuration Templates**: Pre-configured setups for common use cases
6. **Hot Reloading**: Dynamic configuration updates without restart
7. **Configuration Encryption**: Encrypted storage for sensitive settings
8. **Audit Logging**: Track configuration changes for security

### Research Areas

- **Configuration Distribution**: Enterprise configuration management
- **Policy Enforcement**: Configuration compliance checking
- **Performance Monitoring**: Configuration impact on performance
- **User Experience**: Simplified configuration workflows
- **Integration**: Third-party configuration management systems
