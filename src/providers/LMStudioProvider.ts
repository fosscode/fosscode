/// <reference types="node" />
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message, ProviderResponse, LLMConfig, LLMProvider } from '../types/index.js';

interface ModelInfo {
  id?: string;
  object?: string;
  [key: string]: unknown;
}

import { PermissionManager } from '../utils/PermissionManager.js';

export class LMStudioProvider implements LLMProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validateConfig(_config: LLMConfig): Promise<boolean> {
    // TODO: Implement LMStudio validation
    return true; // Assume local server is running
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMessage(
    _messages: Message[],
    _config: LLMConfig,
    _mode?: 'code' | 'thinking',
    _chatLogger?: any,
    _permissionManager?: PermissionManager
  ): Promise<ProviderResponse> {
    // TODO: Implement LMStudio API integration
    throw new Error('LMStudio provider not yet implemented');
  }

  async listModels(config: LLMConfig): Promise<string[]> {
    if (!config.baseURL) {
      throw new Error('LMStudio baseURL not configured');
    }

    // Try to fetch models from LMStudio local API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for local server

      const response = await fetch(`${config.baseURL}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((model: ModelInfo) => model.id ?? model.object).sort();
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Failed to fetch models from LMStudio API: Request timeout');
      } else {
        console.warn(
          `Failed to fetch models from LMStudio API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Fallback to placeholder if API call fails
    return ['local-model'];
  }
}
