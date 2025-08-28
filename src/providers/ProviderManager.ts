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

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.providers = new Map();
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
  }

  async initializeProvider(providerType: ProviderType): Promise<void> {
    const provider = this.getProvider(providerType);

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

    const provider = this.getProvider(providerType);

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
    const provider = this.getProvider(providerType);

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
    // Return all supported providers, not just initialized ones
    return ['openai', 'grok', 'lmstudio', 'openrouter', 'sonicfree', 'mcp', 'anthropic'];
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
}
