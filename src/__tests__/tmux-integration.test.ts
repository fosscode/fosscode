import * as tmuxUtils from '../utils/tmuxUtils.js';

describe('Tmux Integration Tests', () => {
  describe('Tmux detection and configuration handling', () => {
    const originalEnv = process.env;
    let mockExecSync: jest.SpyInstance;

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
      // Mock execSync for all tests
      mockExecSync = jest.spyOn(require('child_process'), 'execSync');
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
      // Restore execSync
      mockExecSync.mockRestore();
      // Clear tmux cache
      tmuxUtils.clearTmuxCache();
    });

    it('should detect when not in tmux', () => {
      delete process.env.TMUX;

      const result = tmuxUtils.getTmuxInfo();
      expect(result.isInTmux).toBe(false);
      expect(result.paneWidth).toBeNull();
      expect(result.paneHeight).toBeNull();
      expect(result.sessionName).toBeNull();
      expect(result.windowName).toBeNull();
      expect(result.paneId).toBeNull();
    });

    it('should handle tmux environment variables', () => {
      // Simulate being in tmux
      process.env.TMUX = 'tmux-123';

      // Mock execSync to return tmux data
      mockExecSync.mockReturnValue('100,25,test-session,test-window,%1');

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBe(100);
      expect(result.paneHeight).toBe(25);
      expect(result.sessionName).toBe('test-session');
      expect(result.windowName).toBe('test-window');
      expect(result.paneId).toBe('%1');
    });

    it('should handle split pane configurations', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('60,25,test-session,test-window,%1');

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBe(60);
      expect(result.paneHeight).toBe(25);
    });

    it('should handle vertical split configurations', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('120,12,test-session,test-window,%1');

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBe(120);
      expect(result.paneHeight).toBe(12);
    });

    it('should handle nested tmux sessions', () => {
      process.env.TMUX = 'tmux-123,tmux-456'; // Nested session

      mockExecSync.mockReturnValue('80,20,nested-session,nested-window,%2');

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.sessionName).toBe('nested-session');
      expect(result.windowName).toBe('nested-window');
    });

    it('should handle tmux command failures gracefully', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockImplementation(() => {
        throw new Error('tmux command failed');
      });

      const result = tmuxUtils.getTmuxInfo();

      // Should still return basic tmux info even if commands fail
      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBeNull();
      expect(result.paneHeight).toBeNull();
    });
  });

  describe('Responsive breakpoints with different configurations', () => {
    const originalEnv = process.env;
    let mockExecSync: jest.SpyInstance;

    beforeEach(() => {
      process.env = { ...originalEnv };
      mockExecSync = jest.spyOn(require('child_process'), 'execSync');
    });

    afterEach(() => {
      process.env = originalEnv;
      mockExecSync.mockRestore();
      // Clear tmux cache
      tmuxUtils.clearTmuxCache();
    });

    it('should calculate responsive breakpoints for large panes', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('120,30,test-session,test-window,%1');

      const breakpoints = tmuxUtils.getTmuxResponsiveBreakpoints();

      expect(breakpoints.isSmallScreen).toBe(false);
      expect(breakpoints.isVerySmallScreen).toBe(false);
      expect(breakpoints.isExtraSmallScreen).toBe(false);
    });

    it('should calculate responsive breakpoints for small panes', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('50,20,test-session,test-window,%1');

      const breakpoints = tmuxUtils.getTmuxResponsiveBreakpoints();

      expect(breakpoints.isSmallScreen).toBe(true);
      expect(breakpoints.isVerySmallScreen).toBe(false);
      expect(breakpoints.isExtraSmallScreen).toBe(false);
    });

    it('should calculate responsive breakpoints for very small panes', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('35,15,test-session,test-window,%1');

      const breakpoints = tmuxUtils.getTmuxResponsiveBreakpoints();

      expect(breakpoints.isSmallScreen).toBe(true);
      expect(breakpoints.isVerySmallScreen).toBe(true);
      expect(breakpoints.isExtraSmallScreen).toBe(false);
    });

    it('should calculate responsive breakpoints for extra small panes', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('25,10,test-session,test-window,%1');

      const breakpoints = tmuxUtils.getTmuxResponsiveBreakpoints();

      expect(breakpoints.isSmallScreen).toBe(true);
      expect(breakpoints.isVerySmallScreen).toBe(true);
      expect(breakpoints.isExtraSmallScreen).toBe(true);
    });
  });

  describe('Session storage and persistence', () => {
    const originalEnv = process.env;
    let mockExecSync: jest.SpyInstance;

    beforeEach(() => {
      process.env = { ...originalEnv };
      mockExecSync = jest.spyOn(require('child_process'), 'execSync');
      // Clean up any test files
      const fs = require('fs');
      const path = require('path');
      const tempDir = '/tmp/tmux-chat-sessions';
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach((file: string) => {
          if (file.includes('test-session')) {
            fs.unlinkSync(path.join(tempDir, file));
          }
        });
      }
    });

    afterEach(() => {
      process.env = originalEnv;
      mockExecSync.mockRestore();
      // Clear tmux cache
      tmuxUtils.clearTmuxCache();
    });

    it('should generate correct session storage key', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('80,20,test-session,test-window,%1');

      const key = tmuxUtils.getSessionStorageKey();
      expect(key).toBe('tmux-chat-test-session');
    });

    it('should return null when not in tmux', () => {
      delete process.env.TMUX;

      const key = tmuxUtils.getSessionStorageKey();
      expect(key).toBeNull();
    });

    it('should save and load chat history for tmux sessions', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('80,20,test-session,test-window,%1');

      const testTimestamp = new Date('2023-01-01T00:00:00Z');
      const testMessages = [
        { role: 'user', content: 'Hello', timestamp: testTimestamp },
        { role: 'assistant', content: 'Hi there!', timestamp: testTimestamp },
      ];

      // Save messages
      const saveResult = tmuxUtils.saveChatHistoryToSession(testMessages);
      expect(saveResult).toBe(true);

      // Load messages - timestamps will be serialized as ISO strings
      const loadedMessages = tmuxUtils.loadChatHistoryFromSession();
      expect(loadedMessages).toHaveLength(2);
      expect(loadedMessages![0].role).toBe('user');
      expect(loadedMessages![0].content).toBe('Hello');
      expect(loadedMessages![1].role).toBe('assistant');
      expect(loadedMessages![1].content).toBe('Hi there!');
    });

    it('should handle missing session files gracefully', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('80,20,test-session,test-window,%1');

      const loadedMessages = tmuxUtils.loadChatHistoryFromSession();
      expect(loadedMessages).toBeNull();
    });

    it('should return null when not in tmux', () => {
      delete process.env.TMUX;

      const key = tmuxUtils.getSessionStorageKey();
      expect(key).toBeNull();
    });

    it('should save and load chat history for tmux sessions', () => {
      process.env.TMUX = 'tmux-123';

      const mockExecSync = jest.spyOn(require('child_process'), 'execSync');
      mockExecSync.mockReturnValue('80,20,test-session,test-window,%1');

      const testTimestamp = new Date('2023-01-01T00:00:00Z');
      const testMessages = [
        { role: 'user', content: 'Hello', timestamp: testTimestamp },
        { role: 'assistant', content: 'Hi there!', timestamp: testTimestamp },
      ];

      // Save messages
      const saveResult = tmuxUtils.saveChatHistoryToSession(testMessages);
      expect(saveResult).toBe(true);

      // Load messages - timestamps will be serialized as ISO strings
      const loadedMessages = tmuxUtils.loadChatHistoryFromSession();
      expect(loadedMessages).toHaveLength(2);
      expect(loadedMessages![0].role).toBe('user');
      expect(loadedMessages![0].content).toBe('Hello');
      expect(loadedMessages![1].role).toBe('assistant');
      expect(loadedMessages![1].content).toBe('Hi there!');

      mockExecSync.mockRestore();
    });

    it('should handle missing session files gracefully', () => {
      process.env.TMUX = 'tmux-123';

      const mockExecSync = jest.spyOn(require('child_process'), 'execSync');
      mockExecSync.mockReturnValue('80,20,test-session,test-window,%1');

      const loadedMessages = tmuxUtils.loadChatHistoryFromSession();
      expect(loadedMessages).toBeNull();

      mockExecSync.mockRestore();
    });
  });

  describe('Error handling and edge cases', () => {
    const originalEnv = process.env;
    let mockExecSync: jest.SpyInstance;

    beforeEach(() => {
      process.env = { ...originalEnv };
      mockExecSync = jest.spyOn(require('child_process'), 'execSync');
    });

    afterEach(() => {
      process.env = originalEnv;
      mockExecSync.mockRestore();
      // Clear tmux cache
      tmuxUtils.clearTmuxCache();
    });

    it('should handle malformed tmux output', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('invalid,data,format');

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBeNull();
      expect(result.paneHeight).toBeNull();
    });

    it('should handle empty tmux output', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockReturnValue('');

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBeNull();
      expect(result.paneHeight).toBeNull();
    });

    it('should handle tmux commands with timeout', () => {
      process.env.TMUX = 'tmux-123';

      mockExecSync.mockImplementation(() => {
        throw new Error('ETIMEDOUT');
      });

      const result = tmuxUtils.getTmuxInfo();

      expect(result.isInTmux).toBe(true);
      expect(result.paneWidth).toBeNull();
    });
  });
});
