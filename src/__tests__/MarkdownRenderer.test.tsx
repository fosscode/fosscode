/**
 * @jest-environment jsdom
 */

import React from 'react';

// Mock ink before importing the component
jest.mock('ink', () => ({
  Box: ({ children }: { children: React.ReactNode }) => <div data-testid="box">{children}</div>,
  Text: ({
    children,
    color,
    bold,
    italic,
    underline,
    strikethrough,
  }: {
    children: React.ReactNode;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
  }) => (
    <span
      data-testid="text"
      data-color={color}
      data-bold={bold}
      data-italic={italic}
      data-underline={underline}
      data-strikethrough={strikethrough}
    >
      {children}
    </span>
  ),
  useStdout: () => ({
    stdout: { columns: 80 },
  }),
}));

// Import utility functions for testing
import { parseMarkdown, formatInlineMarkdown, highlightCode } from '../ui/components/MarkdownRenderer.js';

describe('MarkdownRenderer', () => {
  describe('parseMarkdown', () => {
    it('should parse headers', () => {
      const content = '# Header 1\n## Header 2\n### Header 3';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].level).toBe(1);
      expect(blocks[0].content).toBe('Header 1');

      expect(blocks[1].type).toBe('header');
      expect(blocks[1].level).toBe(2);
      expect(blocks[1].content).toBe('Header 2');

      expect(blocks[2].type).toBe('header');
      expect(blocks[2].level).toBe(3);
      expect(blocks[2].content).toBe('Header 3');
    });

    it('should parse code blocks', () => {
      const content = '```javascript\nconst x = 1;\nconsole.log(x);\n```';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].content).toBe('const x = 1;\nconsole.log(x);');
    });

    it('should parse code blocks without language', () => {
      const content = '```\nsome code\n```';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('code');
      expect(blocks[0].language).toBe('text');
    });

    it('should parse blockquotes', () => {
      const content = '> This is a quote\n> with multiple lines';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('quote');
      expect(blocks[0].content).toBe('This is a quote\nwith multiple lines');
    });

    it('should parse unordered lists', () => {
      const content = '- Item 1\n- Item 2\n- Item 3';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('list');
      expect(blocks[0].ordered).toBe(false);
      expect(blocks[0].content).toBe('Item 1\nItem 2\nItem 3');
    });

    it('should parse ordered lists', () => {
      const content = '1. First\n2. Second\n3. Third';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('list');
      expect(blocks[0].ordered).toBe(true);
      expect(blocks[0].content).toBe('First\nSecond\nThird');
    });

    it('should parse horizontal rules', () => {
      const content = '---\n***\n___';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(3);
      blocks.forEach(block => {
        expect(block.type).toBe('hr');
      });
    });

    it('should parse tables', () => {
      const content = '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('table');
      expect(blocks[0].rows).toBeDefined();
      expect(blocks[0].rows).toHaveLength(2);
      expect(blocks[0].rows?.[0]).toEqual(['Header 1', 'Header 2']);
      expect(blocks[0].rows?.[1]).toEqual(['Cell 1', 'Cell 2']);
    });

    it('should parse paragraphs', () => {
      const content = 'This is a paragraph.\n\nThis is another paragraph.';
      const blocks = parseMarkdown(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe('paragraph');
      expect(blocks[1].type).toBe('paragraph');
    });

    it('should handle mixed content', () => {
      const content = `# Title

This is a paragraph.

\`\`\`bash
echo "hello"
\`\`\`

- List item 1
- List item 2

> A quote`;

      const blocks = parseMarkdown(content);

      expect(blocks.map(b => b.type)).toEqual([
        'header',
        'paragraph',
        'code',
        'list',
        'quote',
      ]);
    });
  });

  describe('formatInlineMarkdown', () => {
    it('should format bold text', () => {
      const result = formatInlineMarkdown('This is **bold** text');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format italic text', () => {
      const result = formatInlineMarkdown('This is *italic* text');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format inline code', () => {
      const result = formatInlineMarkdown('Use the `console.log` function');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format links', () => {
      const result = formatInlineMarkdown('Check out [Google](https://google.com)');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format strikethrough text', () => {
      const result = formatInlineMarkdown('This is ~~deleted~~ text');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle plain text', () => {
      const result = formatInlineMarkdown('Just plain text here');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle mixed formatting', () => {
      const result = formatInlineMarkdown('**Bold** and *italic* and `code`');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('highlightCode', () => {
    it('should highlight JavaScript keywords', () => {
      const code = 'const x = 1;';
      const result = highlightCode(code, 'javascript');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should highlight Python keywords', () => {
      const code = 'def hello():\n    return True';
      const result = highlightCode(code, 'python');

      expect(result).toBeDefined();
      expect(result.length).toBe(2); // 2 lines
    });

    it('should highlight strings', () => {
      const code = 'const name = "hello";';
      const result = highlightCode(code, 'javascript');

      expect(result).toBeDefined();
    });

    it('should highlight comments', () => {
      const code = '// This is a comment';
      const result = highlightCode(code, 'javascript');

      expect(result).toBeDefined();
    });

    it('should highlight numbers', () => {
      const code = 'const count = 42;';
      const result = highlightCode(code, 'javascript');

      expect(result).toBeDefined();
    });

    it('should handle bash code', () => {
      const code = 'if [ -f "$1" ]; then\n  echo "exists"\nfi';
      const result = highlightCode(code, 'bash');

      expect(result).toBeDefined();
      expect(result.length).toBe(3); // 3 lines
    });

    it('should handle unknown languages gracefully', () => {
      const code = 'some random code';
      const result = highlightCode(code, 'unknown-language');

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });

    it('should add line numbers', () => {
      const code = 'line1\nline2\nline3';
      const result = highlightCode(code, 'text');

      expect(result.length).toBe(3);
    });
  });
});
