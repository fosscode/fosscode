import { toolRegistry } from './ToolRegistry.js';
import { GrepTool } from './GrepTool.js';
import { ReadTool } from './ReadTool.js';
import { WriteTool } from './WriteTool.js';
import { EditTool } from './EditTool.js';
import { GitHubTool } from './GitHubTool.js';
import { WebFetchTool } from './WebFetchTool.js';
import { ListTool } from './ListTool.js';
import { BashTool } from './BashTool.js';
import { GlobTool } from './GlobTool.js';
import { MultieditTool } from './MultieditTool.js';
import { PatchTool } from './PatchTool.js';
import { LSPDiagnosticsTool } from './LSPDiagnosticsTool.js';
import { LSPHoverTool } from './LSPHoverTool.js';
import { WebSearchTool } from './WebSearchTool.js';
import { TodoWriteTool, TodoReadTool } from './TodoTool.js';
import { DuckDuckGoTool } from './DuckDuckGoTool.js';
import { TestTool } from './TestTool.js';
import { InvalidTool } from './InvalidTool.js';

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
  toolRegistry.register(new GitHubTool());
  toolRegistry.register(new ListTool());
  toolRegistry.register(new GlobTool());
  toolRegistry.register(new MultieditTool());
  toolRegistry.register(new PatchTool());
  toolRegistry.register(new LSPDiagnosticsTool());
  toolRegistry.register(new LSPHoverTool());
  toolRegistry.register(new WebSearchTool());

  // Register system tools
  toolRegistry.register(new BashTool());

  // Register web tools
  toolRegistry.register(new WebFetchTool());

  // Register task management tools
  toolRegistry.register(new TodoWriteTool());
  toolRegistry.register(new TodoReadTool());

  // Register search tools
  toolRegistry.register(new DuckDuckGoTool());

  // Register development and utility tools
  toolRegistry.register(new TestTool());
  toolRegistry.register(new InvalidTool());

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
