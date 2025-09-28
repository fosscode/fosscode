#!/usr/bin/env node

import { Command } from 'commander';
import { BinaryChatCommand } from './binary-chat.js';
import { ConfigCommand } from './commands/ConfigCommand.js';
import { ProvidersCommand } from './commands/ProvidersCommand.js';
import { ModelsCommand } from './commands/ModelsCommand.js';
import { AuthCommand } from './commands/AuthCommand.js';
import { ThemesCommand } from './commands/ThemesCommand.js';

import { ConfigManager } from './config/ConfigManager.js';
import { ProviderManager } from './providers/ProviderManager.js';
import { initializeTools } from './tools/init.js';

// Initialize managers for commands that need them
const configManager = new ConfigManager();
const providerManager = new ProviderManager(configManager);
import { cancellationManager } from './utils/CancellationManager.js';

const version = '0.0.42'; // Hardcoded for binary builds

const program = new Command();

program
  .name('fosscode')
  .description('Lightweight CLI for code agent interactions with LLMs (binary version)')
  .version(version);

program
  .command('chat [message]')
  .description('Send a single message in non-interactive mode')
  .option(
    '-p, --provider <provider>',
    'LLM provider (openai, grok, lmstudio, openrouter, sonicfree)'
  )
  .option('-m, --model <model>', 'Model to use')
  .option('-v, --verbose', 'Enable verbose output (shows tool execution details)')
  .option('-q, --queue', 'Queue the message instead of sending immediately')
  .action(async (message, options) => {
    try {
      if (!message) {
        console.error(
          'Error: Binary version only supports non-interactive mode. Please provide a message.'
        );
        console.error('Usage: fosscode chat "your message" [options]');
        process.exit(1);
      }

      // Start listening for escape key presses
      cancellationManager.startListening();

      // Initialize tools with verbose setting
      initializeTools(options.verbose);

      const chatCommand = new BinaryChatCommand();
      await chatCommand.execute(message, options);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    } finally {
      // Stop listening for escape key presses
      cancellationManager.stopListening();
    }
  });

program
  .command('config')
  .description('Manage configuration settings')
  .command('set <key> <value>')
  .description('Set configuration value')
  .action(async (key: string, value: string) => {
    const configCommand = new ConfigCommand();
    await configCommand.set(key, value);
  });

program
  .command('providers')
  .description('List available LLM providers')
  .action(() => {
    const providersCommand = new ProvidersCommand(providerManager);
    providersCommand.execute();
  });

program
  .command('models [provider]')
  .description('List available models for a provider (or all providers if none specified)')
  .option('-p, --provider <provider>', 'Filter by specific provider')
  .action(async (providerArg?: string, options?: { provider?: string }) => {
    const modelsCommand = new ModelsCommand(configManager, providerManager);
    await modelsCommand.execute(providerArg, options);
  });

program
  .command('auth')
  .description('Authentication commands')
  .command('login <provider>')
  .description('Login to a provider and store API credentials')
  .action(async (provider: string) => {
    const authCommand = new AuthCommand();
    await authCommand.login(provider);
  });

program
  .command('themes [theme]')
  .description('Manage themes (dark/light) or list available themes if no theme specified')
  .action(async (theme?: string) => {
    const themesCommand = new ThemesCommand();
    await themesCommand.execute(theme);
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(program.version());
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

program.parse();
