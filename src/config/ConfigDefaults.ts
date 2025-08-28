import { AppConfig } from '../types/index.js';

export class ConfigDefaults {
  /**
   * Get the default application configuration
   */
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
          mcpServers: {
            context7: {
              name: 'context7',
              mcpServerCommand: 'npx',
              mcpServerArgs: ['-y', '@upstash/context7-mcp@latest'],
              enabled: true,
            },
          },
        },
        anthropic: {},
      },
      cachedModels: {
        openai: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        grok: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        lmstudio: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        openrouter: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        sonicfree: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        mcp: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        anthropic: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
      },
    };
  }

  /**
   * Get the default model for a specific provider
   */
  static getDefaultModelForProvider(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'grok':
        return 'sonic-fast-1';
      case 'lmstudio':
        return 'local-model';
      case 'openrouter':
        return 'openrouter-model';
      case 'sonicfree':
        return 'sonic';
      case 'mcp':
        return 'mcp-server';
      case 'anthropic':
        return 'claude-3-sonnet-20240229';
      default:
        return 'gpt-3.5-turbo';
    }
  }
}
