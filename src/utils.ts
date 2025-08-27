import { ToolResult, ProviderType } from './types/index.js';

// Pricing constants (per 1K tokens, in USD)
export const TOKEN_PRICING: Record<ProviderType, Record<string, { input: number; output: number }>> = {
  openai: {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  },
  grok: {
    'grok-1': { input: 0, output: 0 }, // Free for now
    'grok-beta': { input: 0, output: 0 },
  },
  anthropic: {
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-2': { input: 0.008, output: 0.024 },
  },
  lmstudio: {
    default: { input: 0, output: 0 }, // Local, no cost
  },
  openrouter: {
    // OpenRouter uses market rates, approximate
    default: { input: 0.001, output: 0.002 },
  },
  sonicfree: {
    default: { input: 0, output: 0 }, // Free
  },
  mcp: {
    default: { input: 0, output: 0 }, // Local
  },
};

/**
 * Calculate the cost of token usage for a given provider and model
 */
export function calculateCost(
  provider: ProviderType,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const providerPricing = TOKEN_PRICING[provider];
  if (!providerPricing) return 0;

  const modelPricing = providerPricing[model] || providerPricing.default;
  if (!modelPricing) return 0;

  const inputCost = (promptTokens / 1000) * modelPricing.input;
  const outputCost = (completionTokens / 1000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Format cost as a currency string
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  return `$${cost.toFixed(4)}`;
}

/**
 * Formats tool execution results in a user-friendly way for CLI display
 * @param toolName The name of the tool that was executed
 * @param result The tool execution result
 * @returns Formatted string suitable for CLI display
 */
export function formatToolResult(toolName: string, result: ToolResult): string {
  if (!result.success) {
    return `❌ ${toolName}: ${result.error || 'Unknown error'}`;
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
    output += `   📝 Output:\n${indentText(stdout, 6)}`;
  }

  if (stderr) {
    output += `   ⚠️  Errors:\n${indentText(stderr, 6)}`;
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
