import pc from 'picocolors';
import { ConfigManager } from '../config/ConfigManager.js';

export class ConfigCommand {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.configManager.setConfig(key, value);
      console.log(pc.green(`✓ Set ${key} = ${value}`));
    } catch (error) {
      console.error(pc.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
}
