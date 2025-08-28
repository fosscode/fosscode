import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderType, Message, ProviderResponse, LLMProvider } from '../types/index.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { GrokProvider } from './GrokProvider.js';
import { LMStudioProvider } from './LMStudioProvider.js';
import { OpenRouterProvider } from './OpenRouterProvider.js';
import { SonicFreeProvider } from './SonicFreeProvider.js';
import { MCPProvider } from './MCPProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { cancellationManager } from '../utils/CancellationManager.js';

export class ProviderManager {
  private providers: Map<ProviderType, LLMProvider>;
  private configManager: ConfigManager;
  private mcpServersFilter: string[] | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.providers = new Map();

<<<<<<< HEAD
    // Initialize providers
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('grok', new GrokProvider());
    this.providers.set('lmstudio', new LMStudioProvider());
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('sonicfree', new SonicFreeProvider());
    this.providers.set('mcp', new MCPProvider());
    this.providers.set('anthropic', new AnthropicProvider());
=======
  /**
   * Set filter for MCP servers to enable/disable at runtime
   */
  setMCPServersFilter(servers: string[]): void {
    this.mcpServersFilter = servers;
  }

  /**
   * Get or create a provider instance lazily
   */
  private getProvider(providerType: ProviderType): LLMProvider {
    let provider = this.providers.get(providerType);

    if (!provider) {
      // Lazy initialization of providers
      switch (providerType) {
        case 'openai':
          provider = new OpenAIProvider();
          break;
        case 'grok':
          provider = new GrokProvider();
          break;
        case 'lmstudio':
          provider = new LMStudioProvider();
          break;
        case 'openrouter':
          provider = new OpenRouterProvider();
          break;
        case 'sonicfree':
          provider = new SonicFreeProvider();
          break;
        case 'mcp':
          provider = new MCPProvider();
          break;
        case 'anthropic':
          provider = new AnthropicProvider();
          break;
        default:
          throw new Error(`Unknown provider: ${providerType}`);
      }

      this.providers.set(providerType, provider);
    }

    return provider;
>>>>>>> 26c47ea (feat: add MCP server filtering functionality)
  }

  async initializeProvider(providerType: ProviderType): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerType}`);
    }

    const config = this.configManager.getProviderConfig(providerType);
    const isValid = await provider.validateConfig(config);

    if (!isValid) {
      throw new Error(
        `Invalid configuration for provider ${providerType}. Please check your API key and settings.`
      );
    }
  }

  async sendMessage(
    providerType: ProviderType,
    messages: Message[],
    model?: string,
    verbose?: boolean,
    mode?: 'code' | 'thinking'
  ): Promise<ProviderResponse> {
    // Check if cancellation was requested before starting
    if (cancellationManager.shouldCancel()) {
      throw new Error('Request cancelled by user');
    }

    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerType}`);
    }

    const config = this.configManager.getProviderConfig(providerType);
    if (model) {
      config.model = model;
    }
    if (verbose !== undefined) {
      config.verbose = verbose;
    }

    try {
      return await provider.sendMessage(messages, config, mode);
    } catch (error) {
      // Check if this was a cancellation
      if (cancellationManager.shouldCancel()) {
        throw new Error('Request cancelled by user');
      }
      throw error;
    }
  }

  async listModels(providerType: ProviderType): Promise<string[]> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerType}`);
    }

    // First, try to get cached models
    const cachedModels = await this.configManager.getCachedModels(providerType);
    if (cachedModels && cachedModels.length > 0) {
      return cachedModels;
    }

    // If no cache or cache is expired, fetch from API
    try {
      const config = this.configManager.getProviderConfig(providerType);
      const models = await provider.listModels(config);

      // Cache the fetched models
      await this.configManager.setCachedModels(providerType, models);

      return models;
    } catch (error) {
      // If API call fails and we have expired cache, return the expired cache
      if (cachedModels && cachedModels.length > 0) {
        console.warn(
          `Warning: Failed to fetch latest models from ${providerType} API, using cached models`
        );
        return cachedModels;
      }

      // If no cache available, re-throw the error
      throw error;
    }
  }

  getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  async testConnection(providerType: ProviderType): Promise<boolean> {
    try {
      const provider = this.providers.get(providerType);
      if (!provider) {
        return false;
      }

      const config = this.configManager.getProviderConfig(providerType);
      return await provider.validateConfig(config);
    } catch {
      return false;
    }
  }

<<<<<<< HEAD
  setMCPServersFilter(servers: string[]): void {
    // Filter MCP servers if needed
=======
  /**
   * Initialize MCP tools if MCP is configured
   * This makes MCP tools available to AI providers through the global tool registry
   */
  private async initializeMCPToolsIfConfigured(): Promise<void> {
    try {
      // Check if MCP is configured
      const mcpConfig = this.configManager.getProviderConfig('mcp');

      if (!mcpConfig.mcpServerCommand && !mcpConfig.mcpServers) {
        // No MCP configured, skip
        return;
      }

      // Check if MCP tools are already initialized
      const existingMCPTools = toolRegistry
        .listTools()
        .filter(tool => tool.name.startsWith('mcp_'));
      if (existingMCPTools.length > 0) {
        // MCP tools already initialized
        return;
      }

      console.log('🔧 Initializing MCP tools for AI provider access...');

      // Initialize MCP provider and discover tools
      const mcpProvider = this.getProvider('mcp') as MCPProvider;

      // Apply runtime filter to MCP config if specified
      let filteredConfig = mcpConfig;
      if (this.mcpServersFilter && mcpConfig.mcpServers) {
        const filteredServers: any = {};
        for (const serverName of this.mcpServersFilter) {
          if (mcpConfig.mcpServers[serverName]) {
            filteredServers[serverName] = { ...mcpConfig.mcpServers[serverName], enabled: true };
          }
        }

        if (Object.keys(filteredServers).length > 0) {
          filteredConfig = { ...mcpConfig, mcpServers: filteredServers };
          console.log(`🔧 Enabling MCP servers: ${this.mcpServersFilter.join(', ')}`);
        } else {
          console.log(`⚠️ No matching MCP servers found for: ${this.mcpServersFilter.join(', ')}`);
          return;
        }
      }

      // Connect to MCP server and discover tools
      await mcpProvider.initializeMCPTools(filteredConfig);

      console.log('✅ MCP tools initialized and registered for AI provider use');
    } catch (error) {
      console.warn('⚠️ Failed to initialize MCP tools:', error);
      // Don't throw - MCP initialization failure shouldn't break the main flow
    }
>>>>>>> 26c47ea (feat: add MCP server filtering functionality)
  }
}
