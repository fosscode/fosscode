import { detectTerminal, getDefaultConfig, TerminalType } from '../commands/TerminalSetupCommand.js';

describe('TerminalSetupCommand', () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    // Clear terminal-specific variables
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.ALACRITTY_SOCKET;
    delete process.env.WARP_IS_WARP;
    delete process.env.ZED_TERM;
    delete process.env.ITERM_SESSION_ID;
    delete process.env.TERM_PROGRAM;
    delete process.env.TERM_PROGRAM_VERSION;
    delete process.env.TERM;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('detectTerminal', () => {
    it('should detect Kitty terminal via KITTY_WINDOW_ID', () => {
      process.env.KITTY_WINDOW_ID = '1';
      expect(detectTerminal()).toBe('kitty');
    });

    it('should detect Kitty terminal via TERM', () => {
      process.env.TERM = 'xterm-kitty';
      expect(detectTerminal()).toBe('kitty');
    });

    it('should detect Alacritty terminal via ALACRITTY_SOCKET', () => {
      process.env.ALACRITTY_SOCKET = '/tmp/alacritty.sock';
      expect(detectTerminal()).toBe('alacritty');
    });

    it('should detect Alacritty terminal via TERM', () => {
      process.env.TERM = 'alacritty';
      expect(detectTerminal()).toBe('alacritty');
    });

    it('should detect Warp terminal via WARP_IS_WARP', () => {
      process.env.WARP_IS_WARP = '1';
      expect(detectTerminal()).toBe('warp');
    });

    it('should detect Warp terminal via TERM_PROGRAM', () => {
      process.env.TERM_PROGRAM = 'warp';
      expect(detectTerminal()).toBe('warp');
    });

    it('should detect Zed terminal via ZED_TERM', () => {
      process.env.ZED_TERM = '1';
      expect(detectTerminal()).toBe('zed');
    });

    it('should detect Zed terminal via TERM_PROGRAM', () => {
      process.env.TERM_PROGRAM = 'zed';
      expect(detectTerminal()).toBe('zed');
    });

    it('should detect iTerm2 terminal via ITERM_SESSION_ID', () => {
      process.env.ITERM_SESSION_ID = 'abc123';
      expect(detectTerminal()).toBe('iterm2');
    });

    it('should detect iTerm2 terminal via TERM_PROGRAM', () => {
      process.env.TERM_PROGRAM = 'iterm.app';
      expect(detectTerminal()).toBe('iterm2');
    });

    it('should detect macOS Terminal.app', () => {
      process.env.TERM_PROGRAM = 'Apple_Terminal';
      expect(detectTerminal()).toBe('terminal.app');
    });

    it('should return unknown for unrecognized terminal', () => {
      process.env.TERM = 'xterm-256color';
      expect(detectTerminal()).toBe('unknown');
    });

    it('should prioritize Kitty over other terminals', () => {
      process.env.KITTY_WINDOW_ID = '1';
      process.env.TERM_PROGRAM = 'iterm.app';
      expect(detectTerminal()).toBe('kitty');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return base config for unknown terminal', () => {
      const config = getDefaultConfig('unknown');
      expect(config.terminal).toBe('unknown');
      expect(config.font.family).toBe('JetBrains Mono');
      expect(config.font.size).toBe(14);
      expect(config.colors.foreground).toBe('#e0e0e0');
    });

    it('should return Kitty-specific config', () => {
      const config = getDefaultConfig('kitty');
      expect(config.terminal).toBe('kitty');
      expect(config.font.size).toBe(13);
      expect(config.keyBindings['ctrl+shift+t']).toBe('new_tab');
      expect(config.keyBindings['ctrl+shift+enter']).toBe('new_window');
    });

    it('should return Alacritty-specific config', () => {
      const config = getDefaultConfig('alacritty');
      expect(config.terminal).toBe('alacritty');
      expect(config.font.family).toBe('Fira Code');
      expect(config.font.size).toBe(12);
      expect(config.keyBindings['ctrl+shift+c']).toBe('copy');
      expect(config.keyBindings['ctrl+shift+v']).toBe('paste');
    });

    it('should return Warp-specific config', () => {
      const config = getDefaultConfig('warp');
      expect(config.terminal).toBe('warp');
      expect(config.colors.background).toBe('#0a0a0f');
      expect(config.keyBindings['cmd+k']).toBe('clear');
    });

    it('should return Zed-specific config', () => {
      const config = getDefaultConfig('zed');
      expect(config.terminal).toBe('zed');
      expect(config.font.family).toBe('Zed Mono');
      expect(config.keyBindings['ctrl+`']).toBe('toggle_terminal');
    });

    it('should return iTerm2-specific config', () => {
      const config = getDefaultConfig('iterm2');
      expect(config.terminal).toBe('iterm2');
      expect(config.keyBindings['cmd+d']).toBe('split_vertical');
      expect(config.keyBindings['cmd+shift+d']).toBe('split_horizontal');
    });

    it('should include detectedAt timestamp', () => {
      const config = getDefaultConfig('kitty');
      expect(config.detectedAt).toBeDefined();
      // Should be a valid ISO date string
      expect(() => new Date(config.detectedAt)).not.toThrow();
    });

    it('should include common key bindings for all terminals', () => {
      const terminals: TerminalType[] = ['kitty', 'alacritty', 'warp', 'zed', 'iterm2', 'unknown'];
      for (const terminal of terminals) {
        const config = getDefaultConfig(terminal);
        expect(config.keyBindings['ctrl+c']).toBe('cancel');
        expect(config.keyBindings['ctrl+d']).toBe('exit');
        expect(config.keyBindings['ctrl+l']).toBe('clear');
      }
    });
  });
});
