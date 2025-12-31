import {
  matchWildcardPermission,
  isToolAllowed,
  parsePermissionRule,
  evaluatePermissions,
  MCPConfigManager,
} from '../mcp/MCPConfigManager.js';

describe('MCP Wildcard Permissions', () => {
  describe('matchWildcardPermission', () => {
    it('should match exact tool names', () => {
      expect(matchWildcardPermission('mcp__server__tool', 'mcp__server__tool')).toBe(true);
      expect(matchWildcardPermission('mcp__server__tool', 'mcp__server__other')).toBe(false);
    });

    it('should match wildcard at the end', () => {
      expect(matchWildcardPermission('mcp__server__read', 'mcp__server__*')).toBe(true);
      expect(matchWildcardPermission('mcp__server__write', 'mcp__server__*')).toBe(true);
      expect(matchWildcardPermission('mcp__other__read', 'mcp__server__*')).toBe(false);
    });

    it('should match wildcard in the middle', () => {
      expect(matchWildcardPermission('mcp__server1__read', 'mcp__*__read')).toBe(true);
      expect(matchWildcardPermission('mcp__server2__read', 'mcp__*__read')).toBe(true);
      expect(matchWildcardPermission('mcp__server1__write', 'mcp__*__read')).toBe(false);
    });

    it('should match wildcard at the beginning', () => {
      expect(matchWildcardPermission('mcp__server__tool', '*__server__tool')).toBe(true);
      expect(matchWildcardPermission('prefix__server__tool', '*__server__tool')).toBe(true);
    });

    it('should match multiple wildcards', () => {
      expect(matchWildcardPermission('mcp__server__tool', '*__*__*')).toBe(true);
      expect(matchWildcardPermission('mcp__server__tool', 'mcp__*__*')).toBe(true);
      expect(matchWildcardPermission('other__server__tool', 'mcp__*__*')).toBe(false);
    });

    it('should match everything with single wildcard', () => {
      expect(matchWildcardPermission('mcp__server__tool', '*')).toBe(true);
      expect(matchWildcardPermission('anything', '*')).toBe(true);
    });

    it('should handle special regex characters in patterns', () => {
      expect(matchWildcardPermission('mcp.server.tool', 'mcp.server.tool')).toBe(true);
      expect(matchWildcardPermission('mcp.server.tool', 'mcp.server.*')).toBe(true);
      expect(matchWildcardPermission('mcp[server]tool', 'mcp[server]tool')).toBe(true);
    });

    it('should be case-sensitive', () => {
      expect(matchWildcardPermission('mcp__Server__Tool', 'mcp__server__tool')).toBe(false);
      expect(matchWildcardPermission('MCP__server__tool', 'mcp__server__tool')).toBe(false);
    });
  });

  describe('isToolAllowed', () => {
    it('should allow all tools when no permissions specified', () => {
      expect(isToolAllowed('mcp__server__tool', undefined)).toBe(true);
      expect(isToolAllowed('mcp__server__tool', [])).toBe(true);
    });

    it('should allow tools matching any pattern', () => {
      const permissions = ['mcp__server1__*', 'mcp__server2__*'];
      expect(isToolAllowed('mcp__server1__read', permissions)).toBe(true);
      expect(isToolAllowed('mcp__server2__write', permissions)).toBe(true);
      expect(isToolAllowed('mcp__server3__read', permissions)).toBe(false);
    });

    it('should work with exact tool names', () => {
      const permissions = ['mcp__server__read', 'mcp__server__write'];
      expect(isToolAllowed('mcp__server__read', permissions)).toBe(true);
      expect(isToolAllowed('mcp__server__write', permissions)).toBe(true);
      expect(isToolAllowed('mcp__server__delete', permissions)).toBe(false);
    });
  });

  describe('parsePermissionRule', () => {
    it('should parse allow rules', () => {
      expect(parsePermissionRule('allow:mcp__*__*')).toEqual({
        pattern: 'mcp__*__*',
        allowed: true,
      });
    });

    it('should parse deny rules', () => {
      expect(parsePermissionRule('deny:mcp__*__delete')).toEqual({
        pattern: 'mcp__*__delete',
        allowed: false,
      });
    });

    it('should default to allow for patterns without prefix', () => {
      expect(parsePermissionRule('mcp__server__*')).toEqual({
        pattern: 'mcp__server__*',
        allowed: true,
      });
    });
  });

  describe('evaluatePermissions', () => {
    it('should allow all when no permissions specified', () => {
      expect(evaluatePermissions('mcp__server__tool', undefined)).toBe(true);
      expect(evaluatePermissions('mcp__server__tool', [])).toBe(true);
    });

    it('should deny when deny rule matches', () => {
      const permissions = ['mcp__*__*', 'deny:mcp__*__delete'];
      expect(evaluatePermissions('mcp__server__read', permissions)).toBe(true);
      expect(evaluatePermissions('mcp__server__delete', permissions)).toBe(false);
    });

    it('should prioritize deny rules over allow rules', () => {
      const permissions = ['allow:mcp__server__*', 'deny:mcp__server__dangerous'];
      expect(evaluatePermissions('mcp__server__read', permissions)).toBe(true);
      expect(evaluatePermissions('mcp__server__dangerous', permissions)).toBe(false);
    });

    it('should require at least one allow rule to match when allow rules exist', () => {
      const permissions = ['allow:mcp__server1__*', 'allow:mcp__server2__*'];
      expect(evaluatePermissions('mcp__server1__read', permissions)).toBe(true);
      expect(evaluatePermissions('mcp__server3__read', permissions)).toBe(false);
    });

    it('should handle complex permission combinations', () => {
      const permissions = [
        'mcp__filesystem__*',
        'mcp__git__*',
        'deny:mcp__filesystem__delete',
        'deny:mcp__git__push',
      ];

      expect(evaluatePermissions('mcp__filesystem__read', permissions)).toBe(true);
      expect(evaluatePermissions('mcp__filesystem__write', permissions)).toBe(true);
      expect(evaluatePermissions('mcp__filesystem__delete', permissions)).toBe(false);
      expect(evaluatePermissions('mcp__git__status', permissions)).toBe(true);
      expect(evaluatePermissions('mcp__git__push', permissions)).toBe(false);
      expect(evaluatePermissions('mcp__other__tool', permissions)).toBe(false);
    });
  });

  describe('MCPConfigManager', () => {
    let configManager: MCPConfigManager;

    beforeEach(() => {
      configManager = new MCPConfigManager();
    });

    describe('global permissions', () => {
      it('should set and get global permissions', () => {
        configManager.setGlobalPermissions(['mcp__*__read', 'mcp__*__list']);
        expect(configManager.getGlobalPermissions()).toEqual(['mcp__*__read', 'mcp__*__list']);
      });

      it('should start with empty global permissions', () => {
        expect(configManager.getGlobalPermissions()).toEqual([]);
      });
    });

    describe('isToolAllowed', () => {
      it('should allow all tools when no permissions set', () => {
        expect(configManager.isToolAllowed('server', 'read')).toBe(true);
        expect(configManager.isToolAllowed('server', 'write')).toBe(true);
      });

      it('should respect global permissions', () => {
        configManager.setGlobalPermissions(['mcp__*__read']);
        expect(configManager.isToolAllowed('server', 'read')).toBe(true);
        expect(configManager.isToolAllowed('server', 'write')).toBe(false);
      });
    });

    describe('filterAllowedTools', () => {
      it('should filter tools based on permissions', () => {
        configManager.setGlobalPermissions(['mcp__server__read', 'mcp__server__list']);
        const tools = ['read', 'list', 'write', 'delete'];
        const allowed = configManager.filterAllowedTools('server', tools);
        expect(allowed).toEqual(['read', 'list']);
      });

      it('should return all tools when no permissions set', () => {
        const tools = ['read', 'write', 'delete'];
        const allowed = configManager.filterAllowedTools('server', tools);
        expect(allowed).toEqual(tools);
      });
    });
  });
});
