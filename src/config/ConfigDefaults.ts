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
        mcp: { mcpServerCommand: 'npx', mcpServerArgs: ['@playwright/mcp@latest'] },
        anthropic: {},
        mock: {},
      },
      cachedModels: {
        openai: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        grok: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        lmstudio: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        openrouter: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        sonicfree: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        mcp: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        anthropic: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
        mock: { models: [], lastUpdated: new Date(0), expiresAt: new Date(0) },
      },
      contextDisplay: {
        enabled: true,
        format: 'both',
        showWarnings: true,
        warningThreshold: 80,
      },
      thinkingDisplay: {
        enabled: true,
        showThinkingBlocks: true,
      },
      approvalMode: {
        enabled: false,
        godMode: false,
        allowlist: ['rm', 'sudo', 'chmod', 'chown', 'dd', 'mkfs', 'fdisk'],
      },
      approvals: {
        session: {},
        persistent: {},
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
      case 'mock':
        return 'mock-model';
      default:
        return 'gpt-3.5-turbo';
    }
  }
}
