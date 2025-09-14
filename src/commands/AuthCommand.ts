import pc from 'picocolors';
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
        console.error(pc.red(`Unknown provider: ${provider}`));
        console.log(
          pc.yellow('Available providers: openai, grok, lmstudio, openrouter, sonicfree')
        );
        process.exit(1);
      }

      console.log(pc.blue(`🔐 Logging in to ${provider}...`));

      // Import the login handler
      const { LoginHandler } = await import('../auth/LoginHandler.js');
      const loginHandler = new LoginHandler(this.configManager);

      const success = await loginHandler.login(provider as ProviderType);

      if (success) {
        console.log(pc.green(`✅ Successfully logged in to ${provider}!`));
        console.log(pc.gray('Your API credentials have been stored securely.'));
      } else {
        console.error(pc.red(`❌ Failed to login to ${provider}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(
        pc.red('Login error:'),
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }
}
