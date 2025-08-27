import chalk from 'chalk';

export class ProvidersCommand {
  execute(): void {
    console.log(chalk.blue('Available providers:'));
    console.log('  • openai - OpenAI GPT models');
    console.log('  • grok - xAI Grok models');
    console.log('  • lmstudio - Local LMStudio models');
    console.log('  • openrouter - OpenRouter unified API');
    console.log('  • sonicfree - Free OpenAI-compatible models');
  }
}
