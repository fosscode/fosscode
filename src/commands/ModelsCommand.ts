import pc from 'picocolors';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ProviderType } from '../types/index.js';

export class ModelsCommand {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;

  constructor(configManager?: ConfigManager, providerManager?: ProviderManager) {
    this.configManager = configManager ?? new ConfigManager();
    this.providerManager = providerManager ?? new ProviderManager(this.configManager);
  }

  async execute(providerArg?: string, options?: { provider?: string }): Promise<void> {
    try {
      // Use option value if provided, otherwise use argument
      const provider = options?.provider ?? providerArg;

      if (provider) {
        // Validate provider exists
        if (!['openai', 'grok', 'lmstudio', 'openrouter', 'sonicfree', 'mock'].includes(provider)) {
          console.error(pc.red(`Unknown provider: ${provider}`));
          console.log(
            pc.yellow('Available providers: openai, grok, lmstudio, openrouter, sonicfree, mock')
          );
          process.exit(1);
        }

        console.log(pc.blue(`📋 Available models for ${provider}:`));

        try {
          const models = await this.providerManager.listModels(provider as ProviderType);
          if (models.length === 0) {
            console.log(pc.gray('  No models available'));
          } else {
            models.forEach(model => {
              console.log(`  • ${model}`);
            });
          }
        } catch (error) {
          console.error(
            pc.red(`Error listing models for ${provider}:`),
            error instanceof Error ? error.message : 'Unknown error'
          );
          console.log(pc.gray('Make sure your API key is configured and valid.'));
        }
      } else {
        // List models for all providers
        const providers = this.providerManager.getAvailableProviders();

        for (const providerType of providers) {
          console.log(pc.blue(`📋 ${providerType.toUpperCase()} models:`));

          try {
            const models = await this.providerManager.listModels(providerType);
            if (models.length === 0) {
              console.log(pc.gray('  No models available'));
            } else {
              models.forEach(model => {
                console.log(`  • ${model}`);
              });
            }
          } catch (error) {
            console.log(pc.gray(`  Unable to list models (API key may not be configured)`));
          }

          console.log(); // Add spacing between providers
        }
      }
    } catch (error) {
      console.error(pc.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
}
