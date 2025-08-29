import { initializeTools, getTool, listAvailableTools } from '../tools/init';
import { toolRegistry } from '../tools/ToolRegistry';

describe('Tools Integration', () => {
  beforeEach(() => {
    // Clear registry before each test
    toolRegistry.clear();
  });

  describe('Tool Initialization and Discovery', () => {
    it('should initialize all tools successfully', () => {
      expect(() => {
        initializeTools();
      }).not.toThrow();

      const tools = listAvailableTools();
      expect(tools.length).toBeGreaterThan(10);
    });

    it('should allow retrieving tools by name', () => {
      initializeTools();

      const readTool = getTool('read');
      const grepTool = getTool('grep');
      const listTool = getTool('list');

      expect(readTool).toBeDefined();
      expect(grepTool).toBeDefined();
      expect(listTool).toBeDefined();

      expect(readTool?.name).toBe('read');
      expect(grepTool?.name).toBe('grep');
      expect(listTool?.name).toBe('list');
    });

    it('should return undefined for non-existent tools', () => {
      initializeTools();

      const nonExistentTool = getTool('non-existent-tool');
      expect(nonExistentTool).toBeUndefined();
    });

    it('should provide consistent tool information', () => {
      initializeTools();

      const tools1 = listAvailableTools();
      const tools2 = listAvailableTools();

      expect(tools1).toEqual(tools2);
      expect(tools1.length).toBe(tools2.length);

      // Check that all tools have required properties
      tools1.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(Array.isArray(tool.parameters)).toBe(true);
      });
    });

    it('should handle verbose initialization', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      expect(() => {
        initializeTools(true);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Initializing agent tools...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Registered'));

      consoleSpy.mockRestore();
    });

    it('should support tool categories', () => {
      initializeTools();

      const tools = listAvailableTools();
      const toolNames = tools.map(tool => tool.name);

      // File system tools
      expect(toolNames).toEqual(expect.arrayContaining(['read', 'write', 'edit', 'list', 'grep']));

      // System tools
      expect(toolNames).toEqual(expect.arrayContaining(['bash']));

      // Web tools
      expect(toolNames).toEqual(expect.arrayContaining(['webfetch']));

      // Development tools
      expect(toolNames).toEqual(expect.arrayContaining(['test']));
    });
  });

  describe('Tool Registry Integration', () => {
    it('should maintain tool registry state across operations', () => {
      initializeTools();

      const initialCount = toolRegistry.getToolCount();
      expect(initialCount).toBeGreaterThan(10);

      // Verify we can get tools from the registry
      const readTool = toolRegistry.getTool('read');
      expect(readTool).toBeDefined();
      expect(readTool?.name).toBe('read');

      // Verify tool count remains consistent
      const finalCount = toolRegistry.getToolCount();
      expect(finalCount).toBe(initialCount);
    });

    it('should provide tool listing functionality', () => {
      initializeTools();

      const registryTools = toolRegistry.listTools();
      const availableTools = listAvailableTools();

      expect(registryTools.length).toBe(availableTools.length);

      // Verify that the tools from both sources match
      registryTools.forEach(registryTool => {
        const availableTool = availableTools.find(t => t.name === registryTool.name);
        expect(availableTool).toBeDefined();
        expect(availableTool?.description).toBe(registryTool.description);
      });
    });
  });
});
