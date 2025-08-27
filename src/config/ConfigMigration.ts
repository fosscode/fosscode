import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ConfigMigration {
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * Migrate legacy config from ~/.fosscode/ to ~/.config/fosscode/
   */
  async migrateLegacyConfig(): Promise<void> {
    // Check if legacy config exists
    const legacyConfigPath = path.join(os.homedir(), '.fosscode', 'config.json');

    try {
      await fs.promises.access(legacyConfigPath);
      // Legacy config exists, migrate it
      const legacyConfigData = await fs.promises.readFile(legacyConfigPath, 'utf-8');
      const legacyConfig = JSON.parse(legacyConfigData);

      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.promises.mkdir(configDir, { recursive: true });

      // Write to new location
      await fs.promises.writeFile(this.configPath, JSON.stringify(legacyConfig, null, 2));

      // Optionally backup and remove old config
      const backupPath = path.join(os.homedir(), '.fosscode', 'config.json.backup');
      await fs.promises.rename(legacyConfigPath, backupPath);

      console.log('✅ Config migrated from ~/.fosscode/ to ~/.config/fosscode/');
      console.log('📁 Backup created at ~/.fosscode/config.json.backup');
    } catch {
      // Legacy config doesn't exist or migration already done
    }
  }
}
