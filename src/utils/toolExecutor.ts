import { listAvailableTools, getTool } from '../tools/init.js';
import { ToolResult } from '../types/index.js';

/**
 * Tool execution result interface
 */
export interface ToolExecutionResult {
  content: string;
  hasToolCalls: boolean;
}

/**
 * Formats tool execution results in a user-friendly way for CLI display
 * @param toolName The name of the tool that was executed
 * @param result The tool execution result
 * @returns Formatted string suitable for CLI display
 */
function formatToolResult(toolName: string, result: ToolResult): string {
  if (!result.success) {
    return `❌ ${toolName}: ${result.error ?? 'Unknown error'}`;
  }

  if (!result.data) {
    return `✅ ${toolName}: Completed successfully`;
  }

  // Format based on tool type and data structure
  switch (toolName) {
    case 'bash':
      return formatBashResult(result.data);
    case 'read':
      return formatReadResult(result.data);
    case 'list':
      return formatListResult(result.data);
    case 'grep':
      return formatGrepResult(result.data);
    case 'write':
      return formatWriteResult(result.data);
    case 'edit':
      return formatEditResult(result.data);
    case 'webfetch':
      return formatWebFetchResult(result.data);
    default:
      return formatGenericResult(toolName, result.data);
  }
}

/**
 * Formats bash command results
 */
function formatBashResult(data: any): string {
  const { command, cwd, exitCode, stdout, stderr, executionTime } = data;

  let output = `✅ bash: ${command}\n`;
  output += `   📁 Working directory: ${cwd}\n`;
  output += `   ⏱️  Execution time: ${executionTime}ms\n`;
  output += `   📊 Exit code: ${exitCode}\n`;

  if (stdout) {
    // Show first few lines of output for brevity
    const lines = stdout.split('\n');
    const previewLines = lines.slice(0, 10);
    output += `   📝 Output:\n${indentText(previewLines.join('\n'), 6)}`;
    if (lines.length > 10) {
      output += `\n${indentText(`... and ${lines.length - 10} more lines`, 6)}`;
    }
    output += '\n';
  }

  if (stderr) {
    // Show stderr briefly
    const lines = stderr.split('\n');
    const previewLines = lines.slice(0, 5);
    output += `   ⚠️  Errors:\n${indentText(previewLines.join('\n'), 6)}`;
    if (lines.length > 5) {
      output += `\n${indentText(`... and ${lines.length - 5} more error lines`, 6)}`;
    }
    output += '\n';
  }

  return output;
}

/**
 * Formats file read results
 */
function formatReadResult(data: any): string {
  const { filePath, content, lines } = data;

  let output = `✅ read: ${filePath}\n`;
  output += `   📄 Lines: ${lines}\n`;

  if (content && content.length > 500) {
    output += `   📝 Content (first 500 chars):\n${indentText(content.substring(0, 500) + '...', 6)}`;
  } else if (content) {
    output += `   📝 Content:\n${indentText(content, 6)}`;
  }

  return output;
}

/**
 * Formats directory listing results
 */
function formatListResult(data: any): string {
  const { path, items } = data;

  let output = `✅ list: ${path}\n`;
  output += `   📁 Contents (${items?.length || 0} items):\n`;

  if (items && items.length > 0) {
    const formattedItems = items
      .map((item: any) => {
        const icon = item.isDirectory ? '📁' : '📄';
        return `   ${icon} ${item.name}`;
      })
      .join('\n');
    output += formattedItems;
  } else {
    output += '   (empty directory)';
  }

  return output;
}

/**
 * Formats grep search results
 */
function formatGrepResult(data: any): string {
  const { pattern, matches, path } = data;

  let output = `✅ grep: "${pattern}"`;
  if (path) output += ` in ${path}`;
  output += `\n`;

  output += `   🔍 Found ${matches?.length || 0} matches:\n`;

  if (matches && matches.length > 0) {
    const formattedMatches = matches
      .slice(0, 10)
      .map((match: any) => {
        return `   📍 ${match.file}:${match.line}: ${match.content?.trim() || ''}`;
      })
      .join('\n');
    output += formattedMatches;

    if (matches.length > 10) {
      output += `\n   ... and ${matches.length - 10} more matches`;
    }
  } else {
    output += '   (no matches found)';
  }

  return output;
}

/**
 * Formats file write results
 */
function formatWriteResult(data: any): string {
  const { filePath, size } = data;

  return `✅ write: ${filePath}\n   📄 File created (${size} bytes)`;
}

/**
 * Formats file edit results
 */
function formatEditResult(data: any): string {
  const { filePath, changes } = data;

  let output = `✅ edit: ${filePath}\n`;

  if (changes) {
    output += `   📝 Changes made: ${changes}`;
  }

  return output;
}

/**
 * Formats web fetch results
 */
function formatWebFetchResult(data: any): string {
  const { url, status, content } = data;

  let output = `✅ webfetch: ${url}\n`;
  output += `   🌐 Status: ${status}\n`;

  if (content && content.length > 300) {
    output += `   📝 Content (first 300 chars):\n${indentText(content.substring(0, 300) + '...', 6)}`;
  } else if (content) {
    output += `   📝 Content:\n${indentText(content, 6)}`;
  }

  return output;
}

/**
 * Formats generic tool results
 */
function formatGenericResult(toolName: string, data: any): string {
  if (typeof data === 'string') {
    return `✅ ${toolName}: ${data}`;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return `✅ ${toolName}: ${data}`;
  }

  // For objects, try to show a summary
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return `✅ ${toolName}: Completed successfully`;
    }

    let output = `✅ ${toolName}:\n`;
    keys.slice(0, 5).forEach(key => {
      const value = data[key];
      const displayValue =
        typeof value === 'object'
          ? '[Object]'
          : String(value).length > 50
            ? String(value).substring(0, 50) + '...'
            : String(value);
      output += `   ${key}: ${displayValue}\n`;
    });

    if (keys.length > 5) {
      output += `   ... and ${keys.length - 5} more properties`;
    }

    return output;
  }

  return `✅ ${toolName}: ${String(data)}`;
}

/**
 * Helper function to indent text
 */
function indentText(text: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => indent + line)
    .join('\n');
}

/**
 * Executes tool calls from an OpenAI-style tool_calls array
 * @param toolCalls Array of tool calls from LLM response
 * @param mode Current mode (code or thinking) to restrict tools
 * @returns Formatted execution results
 */
export async function executeToolCalls(
  toolCalls: any[],
  mode?: 'code' | 'thinking'
): Promise<ToolExecutionResult> {
  let content = 'Executing tools to help with your request...\n\n';
  content += '[Tool Calls Executed]:\n';

  for (const toolCall of toolCalls) {
    if (toolCall.function?.name && toolCall.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const tool = getTool(toolCall.function.name);

        // Check if tool is allowed in current mode
        if (mode === 'thinking') {
          const allowedTools = ['read', 'grep', 'list', 'webfetch'];
          if (!allowedTools.includes(toolCall.function.name)) {
            content += `❌ ${toolCall.function.name}: Tool not allowed in thinking mode\n`;
            continue;
          }
        }

        if (tool) {
          const result = await tool.execute(args);
          content += formatToolResult(toolCall.function.name, result) + '\n';
        } else {
          content += `❌ ${toolCall.function.name}: Tool not found\n`;
        }
      } catch (parseError) {
        content += `❌ ${toolCall.function.name}: Invalid arguments - ${parseError instanceof Error ? parseError.message : 'Unknown error'}\n`;
      }
    }
  }

  return {
    content,
    hasToolCalls: toolCalls.length > 0,
  };
}

/**
 * Converts available tools to OpenAI tools format
 * @param mode Current mode to filter tools
 * @returns Array of tools in OpenAI format
 */
export function getOpenAIToolsFormat(mode?: 'code' | 'thinking') {
  const availableTools = listAvailableTools();

  // Filter tools based on mode
  let filteredTools = availableTools;
  if (mode === 'thinking') {
    const allowedTools = ['read', 'grep', 'list', 'webfetch'];
    filteredTools = availableTools.filter(tool => allowedTools.includes(tool.name));
  }

  return filteredTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce(
          (acc, param) => {
            acc[param.name] = {
              type: param.type,
              description: param.description,
              ...(param.defaultValue !== undefined && { default: param.defaultValue }),
            };
            return acc;
          },
          {} as Record<string, any>
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  }));
}

/**
 * Checks if tools are available
 * @returns true if tools are available, false otherwise
 */
export function hasAvailableTools(): boolean {
  const availableTools = listAvailableTools();
  return availableTools.length > 0;
}
