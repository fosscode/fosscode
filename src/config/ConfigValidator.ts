import { ProviderType, LLMConfig } from '../types/index.js';

export class ConfigValidator {
  /**
   * Validate provider-specific configuration
   */
  static async validateProvider(provider: ProviderType, providerConfig: LLMConfig): Promise<void> {
    console.log(`Validating provider ${provider} with config:`, providerConfig);
    // For LMStudio, we only need a baseURL (no API key required)
    if (provider === 'lmstudio') {
      if (!providerConfig.baseURL) {
        throw new Error(
          `LMStudio baseURL not configured. Please run: fosscode auth login lmstudio`
        );
      }
      return;
    }

    // For SonicFree, we only need a baseURL (no API key required)
    if (provider === 'sonicfree') {
      if (!providerConfig.baseURL) {
        throw new Error(
          `SonicFree baseURL not configured. Please run: fosscode auth login sonicfree`
        );
      }
      return;
    }

    // For MCP, we need either a command with args or a URL, or multiple servers
    if (provider === 'mcp') {
      // Check if multiple servers are configured
      if (providerConfig.mcpServers && Object.keys(providerConfig.mcpServers).length > 0) {
        const enabledServers = Object.values(providerConfig.mcpServers).filter(
          s => s.enabled !== false
        );
        if (enabledServers.length === 0) {
          throw new Error('No enabled MCP servers found in mcpServers configuration.');
        }
        // Validate each enabled server
        for (const server of enabledServers) {
          if (
            !server.mcpServerUrl &&
            (!server.mcpServerCommand || !server.mcpServerArgs || server.mcpServerArgs.length === 0)
          ) {
            throw new Error(
              `MCP server '${server.name}' not properly configured. Please set either mcpServerUrl or both mcpServerCommand and mcpServerArgs.`
            );
          }
        }
        return;
      }

      // Fall back to legacy single server validation
      if (
        !providerConfig.mcpServerUrl &&
        (!providerConfig.mcpServerCommand ||
          !providerConfig.mcpServerArgs ||
          providerConfig.mcpServerArgs.length === 0)
      ) {
        throw new Error(
          `MCP server not configured. Please set either mcpServerUrl or both mcpServerCommand and mcpServerArgs.`
        );
      }
      return;
    }

    // For other providers, we need an API key
    if (!providerConfig.apiKey) {
      throw new Error(
        `No API key configured for ${provider}. Please run: fosscode auth login ${provider}`
      );
    }
  }

  /**
   * Validate that at least one provider is configured
   */
  static validateConfigHasProviders(config: Record<ProviderType, LLMConfig>): void {
    const configuredProviders = Object.entries(config)
      .filter(([provider, config]) => {
        if (provider === 'mcp') {
          // MCP is configured if it has either a URL or command+args, or multiple servers
          if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
            return Object.values(config.mcpServers).some(
              s =>
                s.enabled !== false &&
                (s.mcpServerUrl ??
                  (s.mcpServerCommand && s.mcpServerArgs && s.mcpServerArgs.length > 0))
            );
          }
          return (
            config.mcpServerUrl ??
            (config.mcpServerCommand && config.mcpServerArgs && config.mcpServerArgs.length > 0)
          );
        }
        // Other providers need apiKey or baseURL
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
