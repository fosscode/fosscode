import { Box, Text } from 'ink';
import { memo, useMemo } from 'react';

/**
 * Diff line types for styling
 */
export type DiffLineType = 'addition' | 'deletion' | 'context' | 'header' | 'hunk' | 'meta';

/**
 * Parsed diff line with type information
 */
export interface ParsedDiffLine {
  type: DiffLineType;
  content: string;
  lineNumber?: {
    old?: number;
    new?: number;
  };
}

/**
 * Parsed diff hunk
 */
export interface DiffHunk {
  header: string;
  startLineOld: number;
  countOld: number;
  startLineNew: number;
  countNew: number;
  lines: ParsedDiffLine[];
}

/**
 * Parsed diff file
 */
export interface ParsedDiffFile {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

/**
 * Props for DiffRenderer component
 */
export interface DiffRendererProps {
  diff: string;
  showLineNumbers?: boolean;
  showSyntaxHighlight?: boolean;
  maxLines?: number;
  compact?: boolean;
}

/**
 * Parse a unified diff string into structured data
 */
export function parseDiff(diffText: string): ParsedDiffFile[] {
  const files: ParsedDiffFile[] = [];
  const lines = diffText.split('\n');

  let currentFile: ParsedDiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }
        files.push(currentFile);
      }

      const pathMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        oldPath: pathMatch ? pathMatch[1] : '',
        newPath: pathMatch ? pathMatch[2] : '',
        hunks: [],
        isNew: false,
        isDeleted: false,
        isRenamed: false,
      };
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    // Check for new/deleted file markers
    if (line.startsWith('new file mode')) {
      currentFile.isNew = true;
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      currentFile.isDeleted = true;
      continue;
    }
    if (line.startsWith('rename from')) {
      currentFile.isRenamed = true;
      continue;
    }

    // Skip index, old mode, new mode lines
    if (
      line.startsWith('index ') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode') ||
      line.startsWith('rename to') ||
      line.startsWith('similarity index')
    ) {
      continue;
    }

    // File path headers
    if (line.startsWith('--- ')) {
      // Old file path, already captured
      continue;
    }
    if (line.startsWith('+++ ')) {
      // New file path, already captured
      continue;
    }

    // Hunk header: @@ -start,count +start,count @@
    const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)?/);
    if (hunkMatch) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }

      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[3], 10);

      currentHunk = {
        header: line,
        startLineOld: oldLineNum,
        countOld: parseInt(hunkMatch[2] ?? '1', 10),
        startLineNew: newLineNum,
        countNew: parseInt(hunkMatch[4] ?? '1', 10),
        lines: [
          {
            type: 'hunk',
            content: line,
          },
        ],
      };
      continue;
    }

    if (!currentHunk) continue;

    // Parse diff lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({
        type: 'addition',
        content: line.substring(1),
        lineNumber: { new: newLineNum++ },
      });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({
        type: 'deletion',
        content: line.substring(1),
        lineNumber: { old: oldLineNum++ },
      });
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        content: line.substring(1),
        lineNumber: { old: oldLineNum++, new: newLineNum++ },
      });
    } else if (line === '\\ No newline at end of file') {
      currentHunk.lines.push({
        type: 'meta',
        content: line,
      });
    }
  }

  // Push final file/hunk
  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    files.push(currentFile);
  }

  return files;
}

/**
 * Get color for diff line type
 */
function getLineColor(type: DiffLineType): string {
  switch (type) {
    case 'addition':
      return 'green';
    case 'deletion':
      return 'red';
    case 'hunk':
      return 'cyan';
    case 'header':
      return 'yellow';
    case 'meta':
      return 'gray';
    case 'context':
    default:
      return 'white';
  }
}

/**
 * Get background color for diff line type
 * Note: Exported for potential future use in enhanced terminal rendering
 */
export function getLineBackground(type: DiffLineType): string | undefined {
  switch (type) {
    case 'addition':
      return '#1a3d1a'; // Dark green background
    case 'deletion':
      return '#3d1a1a'; // Dark red background
    default:
      return undefined;
  }
}

/**
 * Apply basic syntax highlighting to code content
 */
function applySyntaxHighlighting(content: string): React.ReactNode {
  // Simple keyword highlighting for common languages
  const keywords = [
    'function',
    'const',
    'let',
    'var',
    'return',
    'if',
    'else',
    'for',
    'while',
    'class',
    'extends',
    'import',
    'export',
    'from',
    'async',
    'await',
    'try',
    'catch',
    'throw',
    'new',
    'this',
    'true',
    'false',
    'null',
    'undefined',
    'interface',
    'type',
    'enum',
    'public',
    'private',
    'protected',
    'static',
  ];

  // Create a simple tokenizer
  const tokens: Array<{ type: 'keyword' | 'string' | 'comment' | 'number' | 'text'; value: string }> = [];
  let remaining = content;

  while (remaining.length > 0) {
    // Check for strings
    const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
    if (stringMatch) {
      tokens.push({ type: 'string', value: stringMatch[0] });
      remaining = remaining.substring(stringMatch[0].length);
      continue;
    }

    // Check for comments
    const commentMatch = remaining.match(/^\/\/.*$|^\/\*[\s\S]*?\*\//m);
    if (commentMatch) {
      tokens.push({ type: 'comment', value: commentMatch[0] });
      remaining = remaining.substring(commentMatch[0].length);
      continue;
    }

    // Check for numbers
    const numberMatch = remaining.match(/^\b\d+(?:\.\d+)?\b/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[0] });
      remaining = remaining.substring(numberMatch[0].length);
      continue;
    }

    // Check for keywords
    const keywordPattern = new RegExp(`^\\b(${keywords.join('|')})\\b`);
    const keywordMatch = remaining.match(keywordPattern);
    if (keywordMatch) {
      tokens.push({ type: 'keyword', value: keywordMatch[0] });
      remaining = remaining.substring(keywordMatch[0].length);
      continue;
    }

    // Default: take one character
    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.substring(1);
  }

  // Convert tokens to React nodes
  return tokens.map((token, index) => {
    switch (token.type) {
      case 'keyword':
        return <Text key={index} color="magenta">{token.value}</Text>;
      case 'string':
        return <Text key={index} color="green">{token.value}</Text>;
      case 'comment':
        return <Text key={index} color="gray" dimColor>{token.value}</Text>;
      case 'number':
        return <Text key={index} color="yellow">{token.value}</Text>;
      default:
        return <Text key={index}>{token.value}</Text>;
    }
  });
}

/**
 * Format line number for display
 */
function formatLineNumber(num: number | undefined, width: number = 4): string {
  if (num === undefined) return ' '.repeat(width);
  return num.toString().padStart(width, ' ');
}

/**
 * DiffRenderer component - renders unified diffs with syntax highlighting
 */
export const DiffRenderer = memo(function DiffRenderer({
  diff,
  showLineNumbers = true,
  showSyntaxHighlight = true,
  maxLines,
  compact = false,
}: DiffRendererProps) {
  const parsedFiles = useMemo(() => parseDiff(diff), [diff]);

  const renderedDiff = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let lineCount = 0;

    for (const file of parsedFiles) {
      // File header
      let fileStatus = '';
      if (file.isNew) fileStatus = ' (new file)';
      else if (file.isDeleted) fileStatus = ' (deleted)';
      else if (file.isRenamed) fileStatus = ` (renamed from ${file.oldPath})`;

      elements.push(
        <Box key={`file-${file.newPath}`} marginTop={compact ? 0 : 1} marginBottom={compact ? 0 : 1}>
          <Text color="yellow" bold>
            {file.newPath}
            {fileStatus}
          </Text>
        </Box>
      );
      lineCount++;

      if (maxLines && lineCount >= maxLines) break;

      // Hunks
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (maxLines && lineCount >= maxLines) break;

          const lineColor = getLineColor(line.type);
          const prefix =
            line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : line.type === 'hunk' ? '' : ' ';

          if (line.type === 'hunk') {
            elements.push(
              <Box key={`hunk-${lineCount}`}>
                <Text color={lineColor}>{line.content}</Text>
              </Box>
            );
          } else {
            const lineNumberDisplay = showLineNumbers
              ? `${formatLineNumber(line.lineNumber?.old)} ${formatLineNumber(line.lineNumber?.new)} `
              : '';

            elements.push(
              <Box key={`line-${lineCount}`}>
                {showLineNumbers && (
                  <Text color="gray" dimColor>
                    {lineNumberDisplay}
                  </Text>
                )}
                <Text color={lineColor}>
                  {prefix}
                  {showSyntaxHighlight && (line.type === 'addition' || line.type === 'deletion' || line.type === 'context')
                    ? applySyntaxHighlighting(line.content)
                    : line.content}
                </Text>
              </Box>
            );
          }

          lineCount++;
        }

        if (maxLines && lineCount >= maxLines) break;
      }

      if (maxLines && lineCount >= maxLines) break;
    }

    if (maxLines && lineCount >= maxLines) {
      elements.push(
        <Box key="truncated" marginTop={1}>
          <Text color="yellow" dimColor>
            ... (output truncated, {parsedFiles.reduce((sum, f) => sum + f.hunks.reduce((s, h) => s + h.lines.length, 0), 0) - maxLines} more lines)
          </Text>
        </Box>
      );
    }

    return elements;
  }, [parsedFiles, showLineNumbers, showSyntaxHighlight, maxLines, compact]);

  return <Box flexDirection="column">{renderedDiff}</Box>;
});

/**
 * Simple inline diff display for single line changes
 */
export const InlineDiff = memo(function InlineDiff({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="red">- {oldText}</Text>
      </Box>
      <Box>
        <Text color="green">+ {newText}</Text>
      </Box>
    </Box>
  );
});

/**
 * Compact diff stats display
 */
export const DiffStats = memo(function DiffStats({ diff }: { diff: string }) {
  const stats = useMemo(() => {
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }

    return { additions, deletions };
  }, [diff]);

  return (
    <Box>
      <Text color="green">+{stats.additions}</Text>
      <Text> </Text>
      <Text color="red">-{stats.deletions}</Text>
    </Box>
  );
});

export default DiffRenderer;
