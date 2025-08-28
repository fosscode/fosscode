import chalk from 'chalk';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderType } from '../types/index.js';

export class AuthCommand {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async login(provider: string): Promise<void> {
    try {
      if (!['openai', 'grok', 'lmstudio', 'openrouter', 'sonicfree'].includes(provider)) {
        console.error(chalk.red(`Unknown provider: ${provider}`));
        console.log(
          chalk.yellow('Available providers: openai, grok, lmstudio, openrouter, sonicfree')
        );
        process.exit(1);
      }

      console.log(chalk.blue(`🔐 Logging in to ${provider}...`));

      // Import the login handler only after validation
      const { LoginHandler } = await import('../auth/LoginHandler.js');
      const loginHandler = new LoginHandler(this.configManager);

      const success = await loginHandler.login(provider as ProviderType);

      if (success) {
        console.log(chalk.green(`✅ Successfully logged in to ${provider}!`));
        console.log(chalk.gray('Your API credentials have been stored securely.'));
      } else {
        console.error(chalk.red(`❌ Failed to login to ${provider}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(
        chalk.red('Login error:'),
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }
}
