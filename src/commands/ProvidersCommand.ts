import pc from 'picocolors';
import { ProviderManager } from '../providers/ProviderManager.js';

export class ProvidersCommand {
  constructor(private providerManager: ProviderManager) {}

  execute(): void {
    const providers = this.providerManager.getAvailableProviders();
    const descriptions = {
      openai: 'OpenAI GPT models',
      grok: 'xAI Grok models',
      lmstudio: 'Local LMStudio models',
      openrouter: 'OpenRouter unified API',
      sonicfree: 'Free OpenAI-compatible models',
      mcp: 'Model Context Protocol provider',
      anthropic: 'Anthropic Claude models',
      mock: 'Mock provider for testing',
    };

    console.log(pc.blue('Available providers:'));
    providers.forEach(provider => {
      const description = descriptions[provider as keyof typeof descriptions] || 'Unknown provider';
      console.log(`  • ${provider} - ${description}`);
    });
  }
}
