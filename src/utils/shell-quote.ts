/**
 * Custom implementation of shell-quote to avoid security vulnerabilities
 * Replaces the vulnerable shell-quote package
 */

/**
 * Quote shell arguments for safe execution
 * @param args - Array of arguments to quote
 * @returns Array of quoted arguments
 */
export function quote(args: string[]): string[] {
  if (!Array.isArray(args)) {
    throw new TypeError('Expected an array');
  }

  return args.map(arg => {
    if (typeof arg !== 'string') {
      throw new TypeError('Expected string arguments');
    }

    // If the argument contains no special characters, return as-is
    if (/^[a-zA-Z0-9._/-]+$/i.test(arg)) {
      return arg;
    }

    // Escape single quotes by replacing ' with '\''
    // and wrap the whole thing in single quotes
    return "'" + arg.replace(/'/g, "'\\''") + "'";
  });
}

/**
 * Parse a shell command string into arguments
 * @param command - The command string to parse
 * @returns Array of parsed arguments
 */
export function parse(command: string): string[] {
  if (typeof command !== 'string') {
    throw new TypeError('Expected a string');
  }

  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
      continue;
    }

    if (!inQuotes && char === ' ') {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    args.push(current);
  }

  if (inQuotes) {
    throw new Error('Unclosed quote in command');
  }

  return args;
}

// Default export for compatibility
export default { quote, parse };
