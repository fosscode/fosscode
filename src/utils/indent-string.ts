/**
 * Custom implementation of indent-string to avoid security vulnerabilities
 * Replaces the vulnerable indent-string package
 */

/**
 * Indent each line in a string
 * @param string - The string to indent
 * @param count - Number of spaces to indent (default: 1)
 * @param indent - The indent character(s) to use (default: ' ')
 * @returns The indented string
 */
export function indentString(string: string, count: number = 1, indent: string = ' '): string {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  if (typeof count !== 'number') {
    throw new TypeError('Expected a number');
  }

  if (count < 0) {
    throw new RangeError('Expected a positive number');
  }

  if (typeof indent !== 'string') {
    throw new TypeError('Expected a string');
  }

  if (string === '') {
    return string;
  }

  const indentation = indent.repeat(count);
  return string.replace(/^/gm, indentation);
}

// Default export for compatibility
export default indentString;
