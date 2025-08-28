import { toolRegistry } from './ToolRegistry.js';
import { GrepTool } from './GrepTool.js';
import { ReadTool } from './ReadTool.js';
import { WriteTool } from './WriteTool.js';
import { EditTool } from './EditTool.js';
import { WebFetchTool } from './WebFetchTool.js';
import { ListTool } from './ListTool.js';
import { BashTool } from './BashTool.js';
import { DuckDuckGoTool } from './DuckDuckGoTool.js';

/**
 * Initialize and register all agent tools
 * This function sets up the complete tool ecosystem for AI agents
 */
export function initializeTools(verbose: boolean = false): void {
  if (verbose) {
    console.log('Initializing agent tools...');
  }

  // Register core file system tools
  toolRegistry.register(new GrepTool());
  toolRegistry.register(new ReadTool());
  toolRegistry.register(new WriteTool());
  toolRegistry.register(new EditTool());
  toolRegistry.register(new ListTool());

  // Register system tools
  toolRegistry.register(new BashTool());

  // Register web tools
  toolRegistry.register(new WebFetchTool());
  toolRegistry.register(new DuckDuckGoTool());

  if (verbose) {
    console.log(`✅ Registered ${toolRegistry.getToolCount()} tools:`);
    toolRegistry.listTools().forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  }
}

/**
 * Get a tool by name with type safety
 * @param name The name of the tool to retrieve
 * @returns The tool instance or null if not found
 */
export function getTool(name: string) {
  return toolRegistry.getTool(name);
}

/**
 * List all available tools
 * @returns Array of tool information
 */
export function listAvailableTools() {
  return toolRegistry.listTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

// Tools will be initialized when explicitly called
