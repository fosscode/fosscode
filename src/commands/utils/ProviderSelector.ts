import pc from 'picocolors';
import { ConfigManager } from '../../config/ConfigManager.js';
import { ProviderManager } from '../../providers/ProviderManager.js';
import { ProviderType } from '../../types/index.js';

export class ProviderSelector {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;

  constructor(configManager: ConfigManager, providerManager: ProviderManager) {
    this.configManager = configManager;
    this.providerManager = providerManager;
  }

  async selectProvider(isNonInteractive: boolean): Promise<string> {
    const availableProviders = [
      'sonicfree',
      'openai',
      'grok',
      'lmstudio',
      'openrouter',
      'anthropic',
    ];

    // Add mock provider if environment variable is set
    if (process.env.FOSSCODE_PROVIDER === 'mock' || process.env.NODE_ENV === 'test') {
      availableProviders.push('mock');
    }

    const configuredProviders: string[] = [];

    console.log(pc.blue('🔍 Checking configured providers...'));

    // Check which providers are properly configured
    for (const provider of availableProviders) {
      try {
        await this.configManager.validateProvider(provider as ProviderType);
        await this.providerManager.initializeProvider(provider as ProviderType);
        configuredProviders.push(provider);
        console.log(pc.green(`  ✅ ${provider}`));
      } catch (_error) {
        console.log(pc.gray(`  ❌ ${provider} (not configured)`));
      }
    }

    if (configuredProviders.length === 0) {
      this.showConfigurationHelp();
      process.exit(1);
    }

    if (configuredProviders.length === 1) {
      const provider = configuredProviders[0];
      console.log(pc.green(`\n🎯 Using ${provider} (only configured provider)`));
      return provider;
    }

    // Multiple providers configured - let user choose
    console.log(pc.blue(`\n📋 Multiple providers configured. Please choose:`));
    configuredProviders.forEach((provider, index) => {
      console.log(pc.cyan(`  ${index + 1}. ${provider}`));
    });

    // For non-interactive mode, use the first configured provider
    if (isNonInteractive) {
      const provider = configuredProviders[0];
      console.log(
        pc.yellow(`📝 Using ${provider} (first configured provider for non-interactive mode)`)
      );
      return provider;
    }

    // Interactive selection
    return this.interactiveProviderSelection(configuredProviders);
  }

  private showConfigurationHelp(): void {
    console.log(pc.red('\n❌ No providers are configured!'));
    console.log(pc.yellow('\n📝 To get started, configure a provider:'));
    console.log(pc.cyan('  • SonicFree (free):'), 'bun run start auth login sonicfree');
    console.log(pc.cyan('  • Grok (free):'), 'bun run start auth login grok');
    console.log(pc.cyan('  • OpenAI (paid):'), 'bun run start auth login openai');
    console.log(pc.cyan('  • LMStudio (local):'), 'bun run start auth login lmstudio');
    console.log(pc.cyan('  • OpenRouter (paid):'), 'bun run start auth login openrouter');
  }

  private async interactiveProviderSelection(configuredProviders: string[]): Promise<string> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(pc.yellow('\nEnter provider number (or name): '), (answer: string) => {
        rl.close();

        const trimmed = answer.trim();

        // Check if it's a number
        const num = parseInt(trimmed);
        if (!isNaN(num) && num >= 1 && num <= configuredProviders.length) {
          resolve(configuredProviders[num - 1]);
          return;
        }

        // Check if it's a provider name
        if (configuredProviders.includes(trimmed)) {
          resolve(trimmed);
          return;
        }

        // Default to first provider
        console.log(pc.yellow(`⚠️  Invalid choice, using ${configuredProviders[0]}`));
        resolve(configuredProviders[0]);
      });
    });
  }
}
