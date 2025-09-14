import pc from 'picocolors';
import { ConfigManager } from '../config/ConfigManager.js';

export class ThemesCommand {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async execute(theme?: string): Promise<void> {
    try {
      if (!theme) {
        // List current theme and available themes
        await this.listThemes();
        return;
      }

      // Validate theme
      if (!['dark', 'light'].includes(theme)) {
        console.error(pc.red(`Unknown theme: ${theme}`));
        console.log(pc.yellow('Available themes: dark, light'));
        process.exit(1);
      }

      // Load config and set the theme
      await this.configManager.loadConfig();
      await this.configManager.setConfig('theme', theme);
      console.log(pc.green(`✅ Theme set to: ${theme}`));
    } catch (error) {
      console.error(
        pc.red('Theme error:'),
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }

  private async listThemes(): Promise<void> {
    await this.configManager.loadConfig();
    const config = this.configManager.getConfig();
    const currentTheme = config.theme;

    console.log(pc.blue('🎨 Available Themes:'));
    console.log('');

    const themes = ['dark', 'light'];
    themes.forEach(theme => {
      const indicator = theme === currentTheme ? pc.green('●') : '○';
      const themeName = theme === currentTheme ? pc.green(theme) : pc.gray(theme);
      console.log(`  ${indicator} ${themeName}`);
    });

    console.log('');
  }
}
