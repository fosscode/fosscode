import { Box, Text, useStdout } from 'ink';
import { useMemo, memo } from 'react';

/**
 * Syntax highlighting colors for code blocks
 */
const syntaxColors: Record<string, string> = {
  keyword: 'magenta',
  string: 'green',
  number: 'yellow',
  comment: 'gray',
  function: 'cyan',
  operator: 'white',
  variable: 'blue',
  type: 'yellow',
  default: 'white',
};

/**
 * Language-specific keyword sets for syntax highlighting
 */
const languageKeywords: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'extends', 'public', 'private', 'protected', 'readonly'],
  python: ['def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'lambda', 'yield', 'async', 'await', 'pass', 'break', 'continue', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'while', 'do', 'done', 'function', 'return', 'exit', 'echo', 'export', 'local', 'readonly', 'declare', 'set', 'unset', 'source'],
  go: ['func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'fallthrough', 'select', 'nil', 'true', 'false'],
  rust: ['fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'use', 'mod', 'pub', 'crate', 'self', 'super', 'if', 'else', 'match', 'for', 'while', 'loop', 'return', 'break', 'continue', 'async', 'await', 'move', 'unsafe', 'where', 'true', 'false', 'Some', 'None', 'Ok', 'Err'],
};

interface MarkdownRendererProps {
  content: string;
  /**
   * Maximum width for rendering (default: terminal width - 4)
   */
  maxWidth?: number;
  /**
   * Whether to enable syntax highlighting in code blocks
   */
  syntaxHighlight?: boolean;
}

/**
 * Parsed markdown block types
 */
type BlockType = 'paragraph' | 'header' | 'code' | 'list' | 'quote' | 'hr' | 'table';

interface ParsedBlock {
  type: BlockType;
  content: string;
  level?: number;
  language?: string;
  ordered?: boolean;
  rows?: string[][];
}

/**
 * Parse markdown content into blocks
 */
function parseMarkdown(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        type: 'header',
        content: headerMatch[2],
        level: headerMatch[1].length,
      });
      i++;
      continue;
    }

    // Code blocks
    const codeBlockMatch = line.match(/^```(\w*)?$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language,
      });
      i++; // Skip closing ```
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'quote',
        content: quoteLines.join('\n'),
      });
      continue;
    }

    // Tables
    if (line.includes('|') && i + 1 < lines.length && /^\|?[-:|]+\|?$/.test(lines[i + 1].trim())) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const cells = lines[i]
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '');
        if (cells.length > 0 && !/^[-:|]+$/.test(lines[i])) {
          tableRows.push(cells);
        }
        i++;
      }
      blocks.push({
        type: 'table',
        content: '',
        rows: tableRows,
      });
      continue;
    }

    // Lists (unordered)
    if (/^[-*+]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'list',
        content: listItems.join('\n'),
        ordered: false,
      });
      continue;
    }

    // Lists (ordered)
    if (/^\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'list',
        content: listItems.join('\n'),
        ordered: true,
      });
      continue;
    }

    // Paragraph (default)
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^[-*_]{3,}$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: paragraphLines.join(' '),
      });
    }
  }

  return blocks;
}

/**
 * Apply inline markdown formatting
 */
function formatInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      elements.push(
        <Text key={key++} bold>
          {boldMatch[2]}
        </Text>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic (*text* or _text_)
    const italicMatch = remaining.match(/^([*_])(.+?)\1/);
    if (italicMatch) {
      elements.push(
        <Text key={key++} italic color="white">
          {italicMatch[2]}
        </Text>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push(
        <Text key={key++} color="cyan" backgroundColor="blackBright">
          {' '}{codeMatch[1]}{' '}
        </Text>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      elements.push(
        <Text key={key++} color="blue" underline>
          {linkMatch[1]}
        </Text>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Strikethrough ~~text~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      elements.push(
        <Text key={key++} strikethrough color="gray">
          {strikeMatch[1]}
        </Text>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Regular text (find next special character)
    const nextSpecial = remaining.search(/[*_`[~]/);
    if (nextSpecial === -1) {
      elements.push(<Text key={key++}>{remaining}</Text>);
      break;
    } else if (nextSpecial === 0) {
      elements.push(<Text key={key++}>{remaining[0]}</Text>);
      remaining = remaining.slice(1);
    } else {
      elements.push(<Text key={key++}>{remaining.slice(0, nextSpecial)}</Text>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

/**
 * Simple syntax highlighting for code
 */
function highlightCode(code: string, language: string): React.ReactNode[] {
  const keywords = languageKeywords[language] || languageKeywords['javascript'] || [];
  const lines = code.split('\n');

  return lines.map((line, lineIndex) => {
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let tokenKey = 0;

    while (remaining.length > 0) {
      // Comments
      const commentMatch = remaining.match(/^(\/\/.*|#.*)$/);
      if (commentMatch) {
        tokens.push(
          <Text key={tokenKey++} color={syntaxColors.comment}>
            {commentMatch[1]}
          </Text>
        );
        break;
      }

      // Strings
      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push(
          <Text key={tokenKey++} color={syntaxColors.string}>
            {stringMatch[0]}
          </Text>
        );
        remaining = remaining.slice(stringMatch[0].length);
        continue;
      }

      // Numbers
      const numberMatch = remaining.match(/^-?\d+\.?\d*/);
      if (numberMatch) {
        tokens.push(
          <Text key={tokenKey++} color={syntaxColors.number}>
            {numberMatch[0]}
          </Text>
        );
        remaining = remaining.slice(numberMatch[0].length);
        continue;
      }

      // Keywords
      const wordMatch = remaining.match(/^[a-zA-Z_]\w*/);
      if (wordMatch) {
        const word = wordMatch[0];
        const color = keywords.includes(word) ? syntaxColors.keyword : syntaxColors.default;
        tokens.push(
          <Text key={tokenKey++} color={color}>
            {word}
          </Text>
        );
        remaining = remaining.slice(word.length);
        continue;
      }

      // Other characters
      tokens.push(
        <Text key={tokenKey++} color={syntaxColors.default}>
          {remaining[0]}
        </Text>
      );
      remaining = remaining.slice(1);
    }

    return (
      <Box key={lineIndex}>
        <Text color="gray" dimColor>
          {String(lineIndex + 1).padStart(3)}
        </Text>
        <Text>{tokens}</Text>
      </Box>
    );
  });
}

/**
 * Render a single markdown block
 */
function renderBlock(
  block: ParsedBlock,
  index: number,
  maxWidth: number,
  syntaxHighlight: boolean
): React.ReactNode {
  switch (block.type) {
    case 'header': {
      const level = block.level || 1;
      const colors = ['cyan', 'blue', 'green', 'yellow', 'magenta', 'gray'];
      const prefix = '#'.repeat(level) + ' ';
      return (
        <Box key={index} marginY={1}>
          <Text color={colors[level - 1] as any} bold>
            {prefix}
            {block.content}
          </Text>
        </Box>
      );
    }

    case 'code': {
      return (
        <Box
          key={index}
          flexDirection="column"
          marginY={1}
          paddingX={1}
          borderStyle="round"
          borderColor="gray"
        >
          <Text color="gray" dimColor>
            {block.language || 'code'}
          </Text>
          <Box flexDirection="column">
            {syntaxHighlight
              ? highlightCode(block.content, block.language || 'text')
              : block.content.split('\n').map((line, i) => (
                  <Text key={i} color="white">
                    {line}
                  </Text>
                ))}
          </Box>
        </Box>
      );
    }

    case 'quote': {
      return (
        <Box key={index} marginY={1} paddingLeft={2}>
          <Text color="gray">│ </Text>
          <Text color="white" italic>
            {formatInlineMarkdown(block.content)}
          </Text>
        </Box>
      );
    }

    case 'list': {
      const items = block.content.split('\n');
      return (
        <Box key={index} flexDirection="column" marginY={1}>
          {items.map((item, i) => (
            <Box key={i} paddingLeft={2}>
              <Text color="cyan">
                {block.ordered ? `${i + 1}. ` : '• '}
              </Text>
              <Text>{formatInlineMarkdown(item)}</Text>
            </Box>
          ))}
        </Box>
      );
    }

    case 'table': {
      if (!block.rows || block.rows.length === 0) return null;

      // Calculate column widths
      const columnWidths: number[] = [];
      for (const row of block.rows) {
        row.forEach((cell, i) => {
          columnWidths[i] = Math.max(columnWidths[i] || 0, cell.length);
        });
      }

      return (
        <Box key={index} flexDirection="column" marginY={1}>
          {block.rows.map((row, rowIndex) => (
            <Box key={rowIndex}>
              <Text color="gray">│</Text>
              {row.map((cell, cellIndex) => (
                <Text key={cellIndex}>
                  <Text color={rowIndex === 0 ? 'cyan' : 'white'} bold={rowIndex === 0}>
                    {' '}{cell.padEnd(columnWidths[cellIndex])}{' '}
                  </Text>
                  <Text color="gray">│</Text>
                </Text>
              ))}
            </Box>
          ))}
        </Box>
      );
    }

    case 'hr': {
      return (
        <Box key={index} marginY={1}>
          <Text color="gray">{'─'.repeat(Math.min(maxWidth, 40))}</Text>
        </Box>
      );
    }

    case 'paragraph':
    default: {
      return (
        <Box key={index} marginY={1}>
          <Text wrap="wrap">{formatInlineMarkdown(block.content)}</Text>
        </Box>
      );
    }
  }
}

/**
 * MarkdownRenderer component for terminal
 * Renders markdown with syntax highlighting, tables, lists, and more
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  maxWidth,
  syntaxHighlight = true,
}: MarkdownRendererProps) {
  const { stdout } = useStdout();
  const terminalWidth = maxWidth ?? (stdout?.columns ?? 80) - 4;

  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <Box flexDirection="column" width={terminalWidth}>
      {blocks.map((block, index) =>
        renderBlock(block, index, terminalWidth, syntaxHighlight)
      )}
    </Box>
  );
});

/**
 * Export utility functions for external use
 */
export { parseMarkdown, formatInlineMarkdown, highlightCode };
