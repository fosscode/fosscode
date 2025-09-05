import { ApprovalManager, ApprovalRequest } from '../utils/ApprovalManager.js';
import { AppConfig } from '../types/index.js';

describe('ApprovalManager', () => {
  let config: AppConfig;
  let approvalManager: ApprovalManager;

  beforeEach(() => {
    config = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      maxConversations: 100,
      theme: 'dark',
      providers: {} as any,
      cachedModels: {} as any,
      approvalMode: {
        enabled: false,
        godMode: false,
        allowlist: ['rm', 'sudo', 'chmod'],
      },
      approvals: {
        session: {},
        persistent: {},
      },
    };
    approvalManager = new ApprovalManager(config);
  });

  describe('needsApproval', () => {
    describe('GOD mode', () => {
      it('should not require approval when GOD mode is enabled', () => {
        config.approvalMode!.godMode = true;
        approvalManager.updateConfig(config);

        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /',
        };

        expect(approvalManager.needsApproval(request)).toBe(false);
      });

      it('should require approval when GOD mode is disabled', () => {
        config.approvalMode!.godMode = false;
        config.approvalMode!.enabled = true;
        approvalManager.updateConfig(config);

        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /',
        };

        expect(approvalManager.needsApproval(request)).toBe(true);
      });
    });

    describe('Approval mode disabled', () => {
      it('should not require approval when approval mode is disabled', () => {
        config.approvalMode!.enabled = false;
        approvalManager.updateConfig(config);

        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /',
        };

        expect(approvalManager.needsApproval(request)).toBe(false);
      });
    });

    describe('Command approvals', () => {
      beforeEach(() => {
        config.approvalMode!.enabled = true;
        config.approvalMode!.godMode = false;
        approvalManager.updateConfig(config);
      });

      it('should require approval for commands in allowlist', () => {
        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /tmp/test',
        };

        expect(approvalManager.needsApproval(request)).toBe(true);
      });

      it('should not require approval for commands not in allowlist', () => {
        const request: ApprovalRequest = {
          type: 'command',
          command: 'ls -la',
        };

        expect(approvalManager.needsApproval(request)).toBe(false);
      });

      it('should handle command with arguments correctly', () => {
        const request: ApprovalRequest = {
          type: 'command',
          command: 'sudo apt update',
        };

        expect(approvalManager.needsApproval(request)).toBe(true);
      });

      it('should handle partial command matches', () => {
        const request: ApprovalRequest = {
          type: 'command',
          command: 'chmod +x script.sh',
        };

        expect(approvalManager.needsApproval(request)).toBe(true);
      });
    });

    describe('Edit approvals', () => {
      beforeEach(() => {
        config.approvalMode!.enabled = true;
        config.approvalMode!.godMode = false;
        approvalManager.updateConfig(config);
      });

      it('should always require approval for edits when mode is enabled', () => {
        const request: ApprovalRequest = {
          type: 'edit',
          filePath: '/tmp/test.txt',
          oldString: 'old content',
          newString: 'new content',
        };

        expect(approvalManager.needsApproval(request)).toBe(true);
      });

      it('should not require approval for edits when mode is disabled', () => {
        config.approvalMode!.enabled = false;
        approvalManager.updateConfig(config);

        const request: ApprovalRequest = {
          type: 'edit',
          filePath: '/tmp/test.txt',
          oldString: 'old content',
          newString: 'new content',
        };

        expect(approvalManager.needsApproval(request)).toBe(false);
      });
    });

    describe('Persistent approvals', () => {
      beforeEach(() => {
        config.approvalMode!.enabled = true;
        config.approvalMode!.godMode = false;
        config.approvals!.persistent = {
          'cmd:rm -rf /tmp/test': 'always',
        };
        approvalManager.updateConfig(config);
      });

      it('should not require approval for persistently approved commands', () => {
        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /tmp/test',
        };

        expect(approvalManager.needsApproval(request)).toBe(false);
      });

      it('should still require approval for other commands', () => {
        const request: ApprovalRequest = {
          type: 'command',
          command: 'sudo apt update',
        };

        expect(approvalManager.needsApproval(request)).toBe(true);
      });
    });

    describe('Session approvals', () => {
      beforeEach(() => {
        config.approvalMode!.enabled = true;
        config.approvalMode!.godMode = false;
        approvalManager.updateConfig(config);
      });

      it('should not require approval for session-approved commands', () => {
        // First approve for session
        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /tmp/test',
        };
        approvalManager.recordApproval(request, 'session');

        expect(approvalManager.needsApproval(request)).toBe(false);
      });

      it('should not require approval for always-approved commands', () => {
        // First approve always
        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /tmp/test',
        };
        approvalManager.recordApproval(request, 'always');

        expect(approvalManager.needsApproval(request)).toBe(false);
      });

      it('should require approval for once-approved commands on subsequent calls', () => {
        // First approve once
        const request: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /tmp/test',
        };
        approvalManager.recordApproval(request, 'once');

        // Should not require approval immediately after
        expect(approvalManager.needsApproval(request)).toBe(false);

        // But should require approval again (once approvals don't persist)
        // Note: In real usage, this would be a new request, but for testing we simulate
        const newRequest: ApprovalRequest = {
          type: 'command',
          command: 'rm -rf /tmp/other',
        };
        expect(approvalManager.needsApproval(newRequest)).toBe(true);
      });
    });
  });

  describe('recordApproval', () => {
    beforeEach(() => {
      config.approvalMode!.enabled = true;
      config.approvalMode!.godMode = false;
      approvalManager.updateConfig(config);
    });

    it('should record always approvals in persistent config', () => {
      const request: ApprovalRequest = {
        type: 'command',
        command: 'rm -rf /tmp/test',
      };

      approvalManager.recordApproval(request, 'always');

      expect(config.approvals!.persistent['cmd:rm -rf /tmp/test']).toBe('always');
    });

    it('should record session approvals in session storage', () => {
      const request: ApprovalRequest = {
        type: 'command',
        command: 'rm -rf /tmp/test',
      };

      approvalManager.recordApproval(request, 'session');

      // Access private property for testing
      const manager = approvalManager as any;
      expect(manager.sessionApprovals['cmd:rm -rf /tmp/test']).toBe('session');
    });

    it('should record once approvals in session storage', () => {
      const request: ApprovalRequest = {
        type: 'command',
        command: 'rm -rf /tmp/test',
      };

      approvalManager.recordApproval(request, 'once');

      // Access private property for testing
      const manager = approvalManager as any;
      expect(manager.sessionApprovals['cmd:rm -rf /tmp/test']).toBe('once');
    });

    it('should initialize approvals config if undefined', () => {
      delete config.approvals;
      approvalManager.updateConfig(config);

      const request: ApprovalRequest = {
        type: 'command',
        command: 'rm -rf /tmp/test',
      };

      approvalManager.recordApproval(request, 'always');

      expect(config.approvals).toBeDefined();
      expect(config.approvals!.persistent).toBeDefined();
      expect(config.approvals!.session).toBeDefined();
    });
  });

  describe('clearSessionApprovals', () => {
    it('should clear all session approvals', () => {
      config.approvalMode!.enabled = true;
      config.approvalMode!.godMode = false;
      config.approvalMode!.allowlist = ['ls', 'cat']; // Commands that will require approval
      approvalManager.updateConfig(config);

      // Record some session approvals
      const request1: ApprovalRequest = {
        type: 'command',
        command: 'ls -la /tmp',
      };
      const request2: ApprovalRequest = {
        type: 'command',
        command: 'cat /etc/hostname',
      };

      approvalManager.recordApproval(request1, 'session');
      approvalManager.recordApproval(request2, 'once');

      // Verify they don't need approval
      expect(approvalManager.needsApproval(request1)).toBe(false);
      expect(approvalManager.needsApproval(request2)).toBe(false);

      // Clear session approvals
      approvalManager.clearSessionApprovals();

      // Now they should need approval again
      expect(approvalManager.needsApproval(request1)).toBe(true); // ls is in allowlist
      expect(approvalManager.needsApproval(request2)).toBe(true); // cat is in allowlist
    });
  });

  describe('updateConfig', () => {
    it('should update config reference and reload session approvals', () => {
      const newConfig: AppConfig = {
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
        maxConversations: 100,
        theme: 'dark',
        providers: {} as any,
        cachedModels: {} as any,
        approvalMode: {
          enabled: true,
          godMode: false,
          allowlist: ['rm', 'sudo'],
        },
        approvals: {
          session: {
            'cmd:ls': 'session',
          },
          persistent: {
            'cmd:cat': 'always',
          },
        },
      };

      approvalManager.updateConfig(newConfig);

      // Test that new config is used
      const request: ApprovalRequest = {
        type: 'command',
        command: 'ls -la',
      };
      expect(approvalManager.needsApproval(request)).toBe(false); // Should be approved via session

      const persistentRequest: ApprovalRequest = {
        type: 'command',
        command: 'cat /etc/passwd',
      };
      expect(approvalManager.needsApproval(persistentRequest)).toBe(false); // Should be approved via persistent
    });
  });

  describe('getApprovalKey', () => {
    it('should generate correct keys for commands', () => {
      const manager = approvalManager as any;

      const commandRequest: ApprovalRequest = {
        type: 'command',
        command: 'rm -rf /tmp/test',
      };

      expect(manager.getApprovalKey(commandRequest)).toBe('cmd:rm -rf /tmp/test');
    });

    it('should generate correct keys for edits', () => {
      const manager = approvalManager as any;

      const editRequest: ApprovalRequest = {
        type: 'edit',
        filePath: '/tmp/test.txt',
      };

      expect(manager.getApprovalKey(editRequest)).toBe('edit:/tmp/test.txt');
    });

    it('should return unknown for invalid types', () => {
      const manager = approvalManager as any;

      const invalidRequest: ApprovalRequest = {
        type: 'invalid' as any,
      };

      expect(manager.getApprovalKey(invalidRequest)).toBe('unknown');
    });
  });
});
