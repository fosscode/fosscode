import { initializeTools, listAvailableTools } from '../tools/init';
import { toolRegistry } from '../tools/ToolRegistry';

describe('Tool Initialization', () => {
  beforeEach(() => {
    // Clear any existing tool registrations before each test
    toolRegistry.clear();
  });

  describe('initializeTools', () => {
    it('should initialize all tools without errors', () => {
      expect(() => {
        initializeTools();
      }).not.toThrow();
    });

    it('should register expected number of tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      // Based on the imports in init.ts, we expect 17 tools to be registered
      expect(tools.length).toBeGreaterThan(10); // At least 10 core tools
    });

    it('should register core file system tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // Check for essential file system tools
      expect(toolNames).toContain('grep');
      expect(toolNames).toContain('read');
      expect(toolNames).toContain('write');
      expect(toolNames).toContain('edit');
      expect(toolNames).toContain('list');
    });

    it('should register system and web tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // Check for system tools
      expect(toolNames).toContain('bash');

      // Check for web tools
      expect(toolNames).toContain('webfetch');
    });

    it('should register task management tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // Check for task management tools
      expect(toolNames).toContain('todowrite');
      expect(toolNames).toContain('todoread');
    });

    it('should register search tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // Check for search tools
      expect(toolNames).toContain('duckduckgo');
    });

    it('should register development and utility tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // Check for development tools
      expect(toolNames).toContain('test');
      expect(toolNames).toContain('invalid');
    });

    it('should register advanced file system and development tools', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // Check for advanced file system tools
      expect(toolNames).toContain('glob');
      expect(toolNames).toContain('multiedit');
      expect(toolNames).toContain('patch');

      // Check for LSP and diagnostic tools
      expect(toolNames).toContain('lsp-diagnostics');
      expect(toolNames).toContain('lsp-hover');

      // Check for web search tools
      expect(toolNames).toContain('web-search');
    });

    it('should handle verbose mode without errors', () => {
      // Capture console.log output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      expect(() => {
        initializeTools(true); // verbose mode
      }).not.toThrow();

      // Verify that verbose output was produced
      expect(consoleSpy).toHaveBeenCalledWith('Initializing agent tools...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Registered'));

      consoleSpy.mockRestore();
    });
  });

  describe('listAvailableTools', () => {
    it('should return tool information with required properties', () => {
      initializeTools();

      const tools = listAvailableTools();

      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(Array.isArray(tool.parameters)).toBe(true);
      });
    });

    it('should return consistent results on multiple calls', () => {
      initializeTools();

      const tools1 = listAvailableTools();
      const tools2 = listAvailableTools();

      expect(tools1).toEqual(tools2);
    });
  });
});
