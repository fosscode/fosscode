import { ConfigManager } from '../config/ConfigManager.js';

export class ThinkingCommand {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Execute the thinking command
   * @param args Command arguments (e.g., "on", "off", "toggle")
   * @returns Response message
   */
  async execute(args: string[] = []): Promise<string> {
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case 'on':
        return await this.setThinkingDisplay(true);
      case 'off':
        return await this.setThinkingDisplay(false);
      case 'toggle':
        return await this.toggleThinkingDisplay();
      case 'status':
        return await this.getThinkingStatus();
      default:
        return this.getHelpMessage();
    }
  }

  /**
   * Set thinking display state
   */
  private async setThinkingDisplay(enabled: boolean): Promise<string> {
    try {
      await this.configManager.setConfig('thinkingDisplay.showThinkingBlocks', enabled);
      const state = enabled ? 'enabled' : 'disabled';
      return `🧠 Thinking blocks display has been ${state}.`;
    } catch (error) {
      return `❌ Failed to update thinking display setting: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Toggle thinking display state
   */
  private async toggleThinkingDisplay(): Promise<string> {
    try {
      const config = this.configManager.getConfig();
      const currentState = config.thinkingDisplay?.showThinkingBlocks ?? true;
      const newState = !currentState;

      await this.configManager.setConfig('thinkingDisplay.showThinkingBlocks', newState);
      const state = newState ? 'enabled' : 'disabled';
      return `🧠 Thinking blocks display has been toggled to: ${state}`;
    } catch (error) {
      return `❌ Failed to toggle thinking display: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get current thinking display status
   */
  private async getThinkingStatus(): Promise<string> {
    try {
      const config = this.configManager.getConfig();
      const enabled = config.thinkingDisplay?.showThinkingBlocks ?? true;
      const state = enabled ? 'enabled' : 'disabled';

      return `🧠 Thinking blocks display is currently: ${state}`;
    } catch (error) {
      return `❌ Failed to get thinking display status: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get help message for the thinking command
   */
  private getHelpMessage(): string {
    return `🧠 *Thinking Command Help*

Control the display of thinking blocks from AI providers like Anthropic's Claude.

*Usage:*
• \`/thinking\` - Show this help message
• \`/thinking on\` - Enable thinking blocks display
• \`/thinking off\` - Disable thinking blocks display
• \`/thinking toggle\` - Toggle thinking blocks display
• \`/thinking status\` - Show current thinking display status

*Default behavior:* Thinking blocks are shown by default.

*Note:* This setting is saved to your configuration and persists across sessions.`;
  }
}
