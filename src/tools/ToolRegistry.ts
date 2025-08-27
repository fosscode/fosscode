import { Tool, ToolRegistry as IToolRegistry } from '../types/index.js';

/**
 * Central registry for managing agent tools
 * Provides registration, discovery, and management of tools
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a new tool in the registry
   * @param tool The tool to register
   * @throws Error if tool with same name already exists
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   * @param name The name of the tool to retrieve
   * @returns The tool if found, undefined otherwise
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   * @returns Array of all registered tools
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Unregister a tool by name
   * @param name The name of the tool to remove
   * @returns true if tool was removed, false if not found
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Check if a tool exists
   * @param name The name of the tool to check
   * @returns true if tool exists, false otherwise
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools
   * @returns The count of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
