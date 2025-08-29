import { MCPTool } from './MCPToolManager.js';

export class MCPMessageParser {
  private availableTools: MCPTool[] = [];

  setAvailableTools(tools: MCPTool[]): void {
    this.availableTools = tools;
  }

  async parseMessageForToolCalls(
    message: string
  ): Promise<Array<{ name: string; arguments: any }>> {
    const toolCalls: Array<{ name: string; arguments: any }> = [];

    // Simple pattern matching for tool calls
    // This is a basic implementation - in a real system you'd use NLP or more sophisticated parsing
    for (const tool of this.availableTools) {
      const toolNamePattern = new RegExp(`\\b${tool.name}\\b`, 'i');
      if (toolNamePattern.test(message)) {
        // Extract arguments from the message (simplified approach)
        const args: any = {};

        // Try to extract arguments based on the tool's input schema
        if (tool.inputSchema.properties) {
          for (const [propName] of Object.entries(tool.inputSchema.properties)) {
            // Simple argument extraction - look for patterns like "argName: value"
            const argPattern = new RegExp(`${propName}\\s*:\\s*([^\\s,]+)`, 'i');
            const match = message.match(argPattern);
            if (match) {
              args[propName] = match[1];
            }
          }
        }

        toolCalls.push({
          name: tool.name,
          arguments: args,
        });
      }
    }

    return toolCalls;
  }
}
