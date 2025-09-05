import { execSync } from 'child_process';
import * as tmuxUtils from '../utils/tmuxUtils.js';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const fs = require('fs');

describe('tmuxUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.TMUX;
    delete process.env.TMUX_PANE;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic tmux detection', () => {
    it('should detect when not in tmux', () => {
      const result = tmuxUtils.isInTmux();
      expect(result).toBe(false);
    });

    it('should detect when in tmux', () => {
      process.env.TMUX = '1';
      const result = tmuxUtils.isInTmux();
      expect(result).toBe(true);
    });
  });

  describe('Resize Detection', () => {
    it('should add and remove resize listeners', () => {
      process.env.TMUX = '1';
      const mockCallback = jest.fn();

      const unsubscribe = tmuxUtils.addResizeListener(mockCallback);
      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });

  describe('Status Line Integration', () => {
    it('should update tmux status line when in tmux', () => {
      process.env.TMUX = '1';

      tmuxUtils.updateTmuxStatusLine('code', 'openai', 'gpt-4');

      expect(mockedExecSync).toHaveBeenCalledWith(
        'tmux set-status-left "[code] openai gpt-4"',
        expect.any(Object)
      );
    });

    it('should clear tmux status line when in tmux', () => {
      process.env.TMUX = '1';

      tmuxUtils.clearTmuxStatusLine();

      expect(mockedExecSync).toHaveBeenCalledWith('tmux set-status-left ""', expect.any(Object));
    });

    it('should not update status line when not in tmux', () => {
      tmuxUtils.updateTmuxStatusLine('code', 'openai');
      expect(mockedExecSync).not.toHaveBeenCalled();
    });
  });

  describe('Session Persistence', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('[]');
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
    });

    it('should return null when not in tmux', () => {
      const key = tmuxUtils.getSessionStorageKey();
      expect(key).toBe(null);
    });

    it('should save chat history to session', () => {
      process.env.TMUX = '1';
      mockedExecSync.mockReturnValue('120,30,test-session,window1,pane1');

      const messages = [{ role: 'user', content: 'test', timestamp: new Date() }];
      const result = tmuxUtils.saveChatHistoryToSession(messages);

      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should load chat history from session', () => {
      process.env.TMUX = '1';
      mockedExecSync.mockReturnValue('120,30,test-session,window1,pane1');
      fs.readFileSync.mockReturnValue(
        JSON.stringify([{ role: 'user', content: 'test', timestamp: new Date().toISOString() }])
      );

      const messages = tmuxUtils.loadChatHistoryFromSession();
      expect(messages).toHaveLength(1);
      expect(messages![0].content).toBe('test');
      expect(messages![0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Key Bindings', () => {
    it('should setup tmux key bindings when in tmux', () => {
      process.env.TMUX = '1';

      const bindings = { 'C-t': 'toggle-mode' };
      tmuxUtils.setupTmuxKeyBindings(bindings);

      expect(mockedExecSync).toHaveBeenCalledWith('tmux unbind-key -a', expect.any(Object));
      expect(mockedExecSync).toHaveBeenCalledWith(
        'tmux bind-key C-t run-shell "echo \'C-t:toggle-mode\' | tmux load-buffer - && tmux paste-buffer"',
        expect.any(Object)
      );
    });

    it('should add and remove key binding listeners', () => {
      process.env.TMUX = '1';
      const mockCallback = jest.fn();

      const unsubscribe = tmuxUtils.addKeyBindingListener(mockCallback);
      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });
});
