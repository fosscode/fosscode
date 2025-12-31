import pc from 'picocolors';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Terminal type detection and configuration
 */
export type TerminalType = 'kitty' | 'alacritty' | 'warp' | 'zed' | 'iterm2' | 'terminal.app' | 'unknown';

export interface TerminalConfig {
  terminal: TerminalType;
  colors: {
    foreground: string;
    background: string;
    cursor: string;
    selection: string;
  };
  font: {
    family: string;
    size: number;
  };
  keyBindings: Record<string, string>;
  detectedAt: string;
}

/**
 * Detects the current terminal type from environment variables
 */
export function detectTerminal(): TerminalType {
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || '';
  const termProgramVersion = process.env.TERM_PROGRAM_VERSION || '';
  const term = process.env.TERM?.toLowerCase() || '';
  const kittyWindowId = process.env.KITTY_WINDOW_ID;
  const alacrittySocket = process.env.ALACRITTY_SOCKET;
  const warpIsWarp = process.env.WARP_IS_WARP;
  const zedTerm = process.env.ZED_TERM;
  const itermSession = process.env.ITERM_SESSION_ID;

  // Kitty detection
  if (kittyWindowId || term === 'xterm-kitty') {
    return 'kitty';
  }

  // Alacritty detection
  if (alacrittySocket || term.includes('alacritty')) {
    return 'alacritty';
  }

  // Warp detection
  if (warpIsWarp || termProgram === 'warp') {
    return 'warp';
  }

  // Zed detection
  if (zedTerm || termProgram === 'zed') {
    return 'zed';
  }

  // iTerm2 detection
  if (itermSession || termProgram === 'iterm.app' || termProgramVersion.includes('iTerm')) {
    return 'iterm2';
  }

  // macOS Terminal.app detection
  if (termProgram === 'apple_terminal') {
    return 'terminal.app';
  }

  return 'unknown';
}

/**
 * Get default configuration for a terminal type
 */
export function getDefaultConfig(terminal: TerminalType): TerminalConfig {
  const baseConfig: TerminalConfig = {
    terminal,
    colors: {
      foreground: '#e0e0e0',
      background: '#1a1a2e',
      cursor: '#00d4aa',
      selection: '#3a3a5e',
    },
    font: {
      family: 'JetBrains Mono',
      size: 14,
    },
    keyBindings: {
      'ctrl+c': 'cancel',
      'ctrl+d': 'exit',
      'ctrl+l': 'clear',
    },
    detectedAt: new Date().toISOString(),
  };

  // Terminal-specific defaults
  switch (terminal) {
    case 'kitty':
      return {
        ...baseConfig,
        font: { family: 'JetBrains Mono', size: 13 },
        keyBindings: {
          ...baseConfig.keyBindings,
          'ctrl+shift+t': 'new_tab',
          'ctrl+shift+enter': 'new_window',
          'ctrl+shift+left': 'prev_tab',
          'ctrl+shift+right': 'next_tab',
        },
      };

    case 'alacritty':
      return {
        ...baseConfig,
        font: { family: 'Fira Code', size: 12 },
        keyBindings: {
          ...baseConfig.keyBindings,
          'ctrl+shift+c': 'copy',
          'ctrl+shift+v': 'paste',
          'ctrl+plus': 'font_increase',
          'ctrl+minus': 'font_decrease',
        },
      };

    case 'warp':
      return {
        ...baseConfig,
        colors: {
          ...baseConfig.colors,
          background: '#0a0a0f',
        },
        keyBindings: {
          ...baseConfig.keyBindings,
          'cmd+k': 'clear',
          'cmd+t': 'new_tab',
          'cmd+w': 'close_tab',
        },
      };

    case 'zed':
      return {
        ...baseConfig,
        font: { family: 'Zed Mono', size: 14 },
        keyBindings: {
          ...baseConfig.keyBindings,
          'ctrl+`': 'toggle_terminal',
          'ctrl+shift+`': 'new_terminal',
        },
      };

    case 'iterm2':
      return {
        ...baseConfig,
        keyBindings: {
          ...baseConfig.keyBindings,
          'cmd+d': 'split_vertical',
          'cmd+shift+d': 'split_horizontal',
          'cmd+t': 'new_tab',
          'cmd+w': 'close_tab',
        },
      };

    default:
      return baseConfig;
  }
}

export class TerminalSetupCommand {
  private configPath: string;

  constructor() {
    const xdgConfigDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    this.configPath = path.join(xdgConfigDir, 'fosscode', 'terminal.json');
  }

  /**
   * Execute terminal setup command
   */
  async execute(options: { detect?: boolean; apply?: boolean; show?: boolean }): Promise<void> {
    try {
      if (options.detect || (!options.apply && !options.show)) {
        await this.detectAndDisplay();
      }

      if (options.apply) {
        await this.applyConfiguration();
      }

      if (options.show) {
        await this.showCurrentConfig();
      }
    } catch (error) {
      console.error(
        pc.red('Terminal setup error:'),
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  }

  /**
   * Detect terminal and display information
   */
  private async detectAndDisplay(): Promise<void> {
    const terminal = detectTerminal();

    console.log(pc.blue('\n📺 Terminal Detection\n'));
    console.log(`  ${pc.cyan('Detected Terminal:')} ${this.formatTerminalName(terminal)}`);
    console.log(`  ${pc.cyan('TERM:')} ${process.env.TERM || 'not set'}`);
    console.log(`  ${pc.cyan('TERM_PROGRAM:')} ${process.env.TERM_PROGRAM || 'not set'}`);

    if (terminal !== 'unknown') {
      console.log(`\n  ${pc.green('✓')} Terminal recognized! Run with --apply to save configuration.`);
    } else {
      console.log(`\n  ${pc.yellow('⚠')} Unknown terminal. Using default configuration.`);
    }

    // Show environment hints
    console.log(pc.dim('\n  Environment Variables Checked:'));
    const envVars = [
      ['KITTY_WINDOW_ID', process.env.KITTY_WINDOW_ID],
      ['ALACRITTY_SOCKET', process.env.ALACRITTY_SOCKET],
      ['WARP_IS_WARP', process.env.WARP_IS_WARP],
      ['ZED_TERM', process.env.ZED_TERM],
      ['ITERM_SESSION_ID', process.env.ITERM_SESSION_ID],
    ];

    for (const [name, value] of envVars) {
      const status = value ? pc.green('set') : pc.dim('not set');
      console.log(`    ${name}: ${status}`);
    }

    console.log('');
  }

  /**
   * Apply and save terminal configuration
   */
  private async applyConfiguration(): Promise<void> {
    const terminal = detectTerminal();
    const config = getDefaultConfig(terminal);

    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Save configuration
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

    console.log(pc.green('\n✅ Terminal configuration saved!\n'));
    console.log(`  ${pc.cyan('Terminal:')} ${this.formatTerminalName(terminal)}`);
    console.log(`  ${pc.cyan('Config file:')} ${this.configPath}`);
    console.log(`  ${pc.cyan('Font:')} ${config.font.family} @ ${config.font.size}pt`);
    console.log('');

    // Show key bindings
    console.log(pc.blue('  Key Bindings:'));
    for (const [key, action] of Object.entries(config.keyBindings)) {
      console.log(`    ${pc.yellow(key)}: ${action}`);
    }
    console.log('');
  }

  /**
   * Show current saved configuration
   */
  private async showCurrentConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config: TerminalConfig = JSON.parse(configData);

      console.log(pc.blue('\n📄 Current Terminal Configuration\n'));
      console.log(`  ${pc.cyan('Terminal:')} ${this.formatTerminalName(config.terminal)}`);
      console.log(`  ${pc.cyan('Detected at:')} ${config.detectedAt}`);
      console.log('');

      console.log(pc.blue('  Colors:'));
      console.log(`    Foreground: ${config.colors.foreground}`);
      console.log(`    Background: ${config.colors.background}`);
      console.log(`    Cursor: ${config.colors.cursor}`);
      console.log(`    Selection: ${config.colors.selection}`);
      console.log('');

      console.log(pc.blue('  Font:'));
      console.log(`    Family: ${config.font.family}`);
      console.log(`    Size: ${config.font.size}pt`);
      console.log('');

      console.log(pc.blue('  Key Bindings:'));
      for (const [key, action] of Object.entries(config.keyBindings)) {
        console.log(`    ${pc.yellow(key)}: ${action}`);
      }
      console.log('');
    } catch {
      console.log(pc.yellow('\n⚠ No terminal configuration found.'));
      console.log(pc.dim('  Run "fosscode terminal-setup --apply" to create one.\n'));
    }
  }

  /**
   * Format terminal name for display
   */
  private formatTerminalName(terminal: TerminalType): string {
    const names: Record<TerminalType, string> = {
      kitty: 'Kitty',
      alacritty: 'Alacritty',
      warp: 'Warp',
      zed: 'Zed Terminal',
      iterm2: 'iTerm2',
      'terminal.app': 'macOS Terminal',
      unknown: 'Unknown Terminal',
    };
    return names[terminal] || terminal;
  }

  /**
   * Load saved terminal configuration
   */
  async loadConfig(): Promise<TerminalConfig | null> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(configData);
    } catch {
      return null;
    }
  }
}
