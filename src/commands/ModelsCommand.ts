import chalk from 'chalk';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ProviderType } from '../types/index.js';

export class ModelsCommand {
  private configManager: ConfigManager;
  private providerManager: ProviderManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.providerManager = new ProviderManager(this.configManager);
  }

  async execute(providerArg?: string, options?: { provider?: string }): Promise<void> {
    try {
      // Use option value if provided, otherwise use argument
      const provider = options?.provider ?? providerArg;

      if (provider) {
        // Validate provider exists
        if (!['openai', 'grok', 'lmstudio', 'openrouter', 'sonicfree'].includes(provider)) {
          console.error(chalk.red(`Unknown provider: ${provider}`));
          console.log(
            chalk.yellow('Available providers: openai, grok, lmstudio, openrouter, sonicfree')
          );
          process.exit(1);
        }

        console.log(chalk.blue(`📋 Available models for ${provider}:`));

        try {
          const models = await this.providerManager.listModels(provider as ProviderType);
          if (models.length === 0) {
            console.log(chalk.gray('  No models available'));
          } else {
            models.forEach(model => {
              console.log(`  • ${model}`);
            });
          }
        } catch (error) {
          console.error(
            chalk.red(`Error listing models for ${provider}:`),
            error instanceof Error ? error.message : 'Unknown error'
          );
          console.log(chalk.gray('Make sure your API key is configured and valid.'));
        }
      } else {
        // List models for all providers
        const providers = this.providerManager.getAvailableProviders();

        for (const providerType of providers) {
          console.log(chalk.blue(`📋 ${providerType.toUpperCase()} models:`));

          try {
            const models = await this.providerManager.listModels(providerType);
            if (models.length === 0) {
              console.log(chalk.gray('  No models available'));
            } else {
              models.forEach(model => {
                console.log(`  • ${model}`);
              });
            }
          } catch (error) {
            console.log(chalk.gray(`  Unable to list models (API key may not be configured)`));
          }

          console.log(); // Add spacing between providers
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
}
