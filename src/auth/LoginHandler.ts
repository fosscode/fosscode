import * as readline from 'readline';
import chalk from 'chalk';
import { ConfigManager } from '../config/ConfigManager.js';
import { ProviderType } from '../types/index.js';

export class LoginHandler {
  private configManager: ConfigManager;
  private rl: readline.Interface;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async login(provider: ProviderType): Promise<boolean> {
    try {
      switch (provider) {
        case 'grok':
          return await this.loginGrok();
        case 'openai':
          return await this.loginOpenAI();
        case 'lmstudio':
          return await this.loginLMStudio();
        case 'openrouter':
          return await this.loginOpenRouter();
        case 'sonicfree':
          return await this.loginSonicFree();
        default:
          console.error(chalk.red(`Login not supported for provider: ${provider}`));
          return false;
      }
    } finally {
      this.rl.close();
    }
  }

  private async loginGrok(): Promise<boolean> {
    console.log(chalk.cyan('\n🔑 xAI/Grok Authentication'));
    console.log(chalk.gray('Get your API key from: https://console.x.ai/'));

    const apiKey = await this.prompt('Enter your xAI API key: ');

    if (!apiKey || apiKey.trim() === '') {
      console.error(chalk.red('❌ API key cannot be empty'));
      return false;
    }

    // Validate API key format (basic check)
    if (!apiKey.startsWith('xai-')) {
      console.log(chalk.yellow('⚠️  Warning: xAI API keys typically start with "xai-"'));
      const confirm = await this.confirm('Continue anyway?');
      if (!confirm) {
        return false;
      }
    }

    await this.configManager.setProviderConfig('grok', { apiKey: apiKey.trim() });
    return true;
  }

  private async loginOpenAI(): Promise<boolean> {
    console.log(chalk.cyan('\n🔑 OpenAI Authentication'));
    console.log(chalk.gray('Get your API key from: https://platform.openai.com/api-keys'));

    const apiKey = await this.prompt('Enter your OpenAI API key: ');

    if (!apiKey || apiKey.trim() === '') {
      console.error(chalk.red('❌ API key cannot be empty'));
      return false;
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      console.log(chalk.yellow('⚠️  Warning: OpenAI API keys typically start with "sk-"'));
      const confirm = await this.confirm('Continue anyway?');
      if (!confirm) {
        return false;
      }
    }

    await this.configManager.setProviderConfig('openai', { apiKey: apiKey.trim() });
    return true;
  }

  private async loginLMStudio(): Promise<boolean> {
    console.log(chalk.cyan('\n🔑 LMStudio Authentication'));
    console.log(chalk.gray('LMStudio runs locally. Configure the server URL.'));

    const baseURL = await this.prompt(
      'Enter LMStudio server URL (default: http://localhost:1234): '
    );

    const finalURL = baseURL.trim() || 'http://localhost:1234';

    // Basic URL validation
    try {
      new URL(finalURL);
    } catch {
      console.error(chalk.red('❌ Invalid URL format'));
      return false;
    }

    await this.configManager.setProviderConfig('lmstudio', { baseURL: finalURL });
    console.log(chalk.green('✅ LMStudio configured successfully!'));
    console.log(chalk.gray('Make sure LMStudio is running on the specified URL.'));
    return true;
  }

  private async loginOpenRouter(): Promise<boolean> {
    console.log(chalk.cyan('\n🔑 OpenRouter Authentication'));
    console.log(chalk.gray('Get your API key from: https://openrouter.ai/keys'));

    const apiKey = await this.prompt('Enter your OpenRouter API key: ');

    if (!apiKey || apiKey.trim() === '') {
      console.error(chalk.red('❌ API key cannot be empty'));
      return false;
    }

    // OpenRouter keys typically start with 'sk-or-v1-'
    if (!apiKey.startsWith('sk-or-')) {
      console.log(chalk.yellow('⚠️  Warning: OpenRouter API keys typically start with "sk-or-"'));
      const confirm = await this.confirm('Continue anyway?');
      if (!confirm) {
        return false;
      }
    }

    await this.configManager.setProviderConfig('openrouter', { apiKey: apiKey.trim() });
    return true;
  }

  private async loginSonicFree(): Promise<boolean> {
    console.log(chalk.cyan('\n🔑 SonicFree Authentication'));
    console.log(chalk.gray('SonicFree provides free AI models. No API key required!'));

    const baseURL = await this.prompt(
      'Enter SonicFree server URL (default: https://gateway.opencode.ai/v1): '
    );

    const finalURL = baseURL.trim() || 'https://gateway.opencode.ai/v1';

    // Basic URL validation
    try {
      new URL(finalURL);
    } catch {
      console.error(chalk.red('❌ Invalid URL format'));
      return false;
    }

    await this.configManager.setProviderConfig('sonicfree', { baseURL: finalURL });
    console.log(chalk.green('✅ SonicFree configured successfully!'));
    console.log(chalk.gray('You can now use free AI models without an API key.'));
    return true;
  }

  private async prompt(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer);
      });
    });
  }

  private async confirm(question: string): Promise<boolean> {
    const answer = await this.prompt(`${question} (y/N): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }
}
