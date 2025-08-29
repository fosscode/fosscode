import { ToolRegistry } from '../tools/ToolRegistry';
import { Tool } from '../types';

// Mock tool for testing
const createMockTool = (name: string, description: string = 'Test tool'): Tool => ({
  name,
  description,
  parameters: [
    {
      name: 'input',
      type: 'string',
      description: 'Input parameter',
      required: true,
    },
  ],
  execute: jest.fn().mockResolvedValue({
    success: true,
    data: `Executed ${name}`,
  }),
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('constructor', () => {
    it('should create a ToolRegistry instance', () => {
      expect(registry).toBeInstanceOf(ToolRegistry);
    });

    it('should start with no tools registered', () => {
      expect(registry.getToolCount()).toBe(0);
      expect(registry.listTools()).toHaveLength(0);
    });
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      const tool = createMockTool('test-tool');

      expect(() => registry.register(tool)).not.toThrow();
      expect(registry.hasTool('test-tool')).toBe(true);
      expect(registry.getToolCount()).toBe(1);
    });

    it('should throw error when registering tool with existing name', () => {
      const tool1 = createMockTool('duplicate-tool');
      const tool2 = createMockTool('duplicate-tool');

      registry.register(tool1);

      expect(() => registry.register(tool2)).toThrow(
        "Tool with name 'duplicate-tool' is already registered"
      );
    });

    it('should allow registering multiple tools with different names', () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');
      const tool3 = createMockTool('tool3');

      registry.register(tool1);
      registry.register(tool2);
      registry.register(tool3);

      expect(registry.getToolCount()).toBe(3);
      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('tool2')).toBe(true);
      expect(registry.hasTool('tool3')).toBe(true);
    });
  });

  describe('getTool', () => {
    it('should return the registered tool', () => {
      const tool = createMockTool('test-tool', 'A test tool');
      registry.register(tool);

      const retrievedTool = registry.getTool('test-tool');

      expect(retrievedTool).toBe(tool);
      expect(retrievedTool?.name).toBe('test-tool');
      expect(retrievedTool?.description).toBe('A test tool');
    });

    it('should return undefined for non-existent tool', () => {
      const result = registry.getTool('non-existent-tool');

      expect(result).toBeUndefined();
    });
  });

  describe('listTools', () => {
    it('should return empty array when no tools are registered', () => {
      const tools = registry.listTools();

      expect(tools).toEqual([]);
    });

    it('should return all registered tools', () => {
      const tool1 = createMockTool('tool1', 'First tool');
      const tool2 = createMockTool('tool2', 'Second tool');
      const tool3 = createMockTool('tool3', 'Third tool');

      registry.register(tool1);
      registry.register(tool2);
      registry.register(tool3);

      const tools = registry.listTools();

      expect(tools).toHaveLength(3);
      expect(tools).toEqual([tool1, tool2, tool3]);
    });

    it('should return a new array each time (not a reference)', () => {
      const tool = createMockTool('test-tool');
      registry.register(tool);

      const tools1 = registry.listTools();
      const tools2 = registry.listTools();

      expect(tools1).not.toBe(tools2); // Different array references
      expect(tools1).toEqual(tools2); // Same content
    });
  });

  describe('unregister', () => {
    it('should remove an existing tool and return true', () => {
      const tool = createMockTool('test-tool');
      registry.register(tool);

      expect(registry.hasTool('test-tool')).toBe(true);

      const result = registry.unregister('test-tool');

      expect(result).toBe(true);
      expect(registry.hasTool('test-tool')).toBe(false);
      expect(registry.getToolCount()).toBe(0);
    });

    it('should return false when trying to remove non-existent tool', () => {
      const result = registry.unregister('non-existent-tool');

      expect(result).toBe(false);
    });

    it('should handle multiple unregister operations', () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');
      const tool3 = createMockTool('tool3');

      registry.register(tool1);
      registry.register(tool2);
      registry.register(tool3);

      expect(registry.unregister('tool2')).toBe(true);
      expect(registry.getToolCount()).toBe(2);
      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('tool3')).toBe(true);

      expect(registry.unregister('tool1')).toBe(true);
      expect(registry.getToolCount()).toBe(1);

      expect(registry.unregister('tool3')).toBe(true);
      expect(registry.getToolCount()).toBe(0);
    });
  });

  describe('hasTool', () => {
    it('should return true for registered tool', () => {
      const tool = createMockTool('test-tool');
      registry.register(tool);

      expect(registry.hasTool('test-tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.hasTool('non-existent-tool')).toBe(false);
    });

    it('should return false after tool is unregistered', () => {
      const tool = createMockTool('test-tool');
      registry.register(tool);

      expect(registry.hasTool('test-tool')).toBe(true);

      registry.unregister('test-tool');

      expect(registry.hasTool('test-tool')).toBe(false);
    });
  });

  describe('getToolCount', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.getToolCount()).toBe(0);
    });

    it('should return correct count after registering tools', () => {
      expect(registry.getToolCount()).toBe(0);

      registry.register(createMockTool('tool1'));
      expect(registry.getToolCount()).toBe(1);

      registry.register(createMockTool('tool2'));
      expect(registry.getToolCount()).toBe(2);

      registry.register(createMockTool('tool3'));
      expect(registry.getToolCount()).toBe(3);
    });

    it('should return correct count after unregistering tools', () => {
      registry.register(createMockTool('tool1'));
      registry.register(createMockTool('tool2'));
      registry.register(createMockTool('tool3'));

      expect(registry.getToolCount()).toBe(3);

      registry.unregister('tool2');
      expect(registry.getToolCount()).toBe(2);

      registry.unregister('tool1');
      expect(registry.getToolCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      registry.register(createMockTool('tool1'));
      registry.register(createMockTool('tool2'));
      registry.register(createMockTool('tool3'));

      expect(registry.getToolCount()).toBe(3);

      registry.clear();

      expect(registry.getToolCount()).toBe(0);
      expect(registry.listTools()).toEqual([]);
      expect(registry.hasTool('tool1')).toBe(false);
      expect(registry.hasTool('tool2')).toBe(false);
      expect(registry.hasTool('tool3')).toBe(false);
    });

    it('should handle clearing empty registry', () => {
      expect(registry.getToolCount()).toBe(0);

      registry.clear();

      expect(registry.getToolCount()).toBe(0);
    });
  });

  describe('integration tests', () => {
    it('should handle complete tool lifecycle', () => {
      // Register tools
      const tool1 = createMockTool('tool1', 'First tool');
      const tool2 = createMockTool('tool2', 'Second tool');

      registry.register(tool1);
      registry.register(tool2);

      // Verify registration
      expect(registry.getToolCount()).toBe(2);
      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('tool2')).toBe(true);

      // Verify retrieval
      expect(registry.getTool('tool1')).toBe(tool1);
      expect(registry.getTool('tool2')).toBe(tool2);

      // Verify listing
      const tools = registry.listTools();
      expect(tools).toHaveLength(2);
      expect(tools).toContain(tool1);
      expect(tools).toContain(tool2);

      // Unregister one tool
      expect(registry.unregister('tool1')).toBe(true);
      expect(registry.getToolCount()).toBe(1);
      expect(registry.hasTool('tool1')).toBe(false);
      expect(registry.hasTool('tool2')).toBe(true);

      // Clear all
      registry.clear();
      expect(registry.getToolCount()).toBe(0);
      expect(registry.hasTool('tool2')).toBe(false);
    });

    it('should handle tools with complex parameters', () => {
      const complexTool: Tool = {
        name: 'complex-tool',
        description: 'A tool with complex parameters',
        parameters: [
          {
            name: 'text',
            type: 'string',
            description: 'Text input',
            required: true,
          },
          {
            name: 'number',
            type: 'number',
            description: 'Numeric input',
            required: false,
            defaultValue: 42,
          },
          {
            name: 'flag',
            type: 'boolean',
            description: 'Boolean flag',
            required: false,
            defaultValue: false,
          },
        ],
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: 'Complex execution result',
        }),
      };

      registry.register(complexTool);

      const retrieved = registry.getTool('complex-tool');
      expect(retrieved).toBe(complexTool);
      expect(retrieved?.parameters).toHaveLength(3);
      expect(retrieved?.parameters[0].required).toBe(true);
      expect(retrieved?.parameters[1].defaultValue).toBe(42);
    });
  });
});
