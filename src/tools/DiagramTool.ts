import { Tool, ToolParameter, ToolResult } from '../types/index.js';

/**
 * Diagram types supported by the tool
 */
export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'pie'
  | 'mindmap'
  | 'ascii-box'
  | 'ascii-tree'
  | 'ascii-table';

/**
 * DiagramTool - Generate diagrams in mermaid or ASCII format
 *
 * Supports:
 * - Mermaid diagram syntax (flowchart, sequence, class, state, ER, gantt, pie, mindmap)
 * - ASCII art diagrams (boxes, trees, tables)
 */
export class DiagramTool implements Tool {
  name = 'diagram';
  description = 'Generate diagrams in mermaid syntax or ASCII art format for terminal display';

  parameters: ToolParameter[] = [
    {
      name: 'type',
      type: 'string',
      description:
        'Diagram type: flowchart, sequence, class, state, er, gantt, pie, mindmap, ascii-box, ascii-tree, ascii-table',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: 'Diagram content/description to convert',
      required: true,
    },
    {
      name: 'title',
      type: 'string',
      description: 'Optional title for the diagram',
      required: false,
    },
    {
      name: 'direction',
      type: 'string',
      description: 'Flow direction for flowcharts: TB (top-bottom), LR (left-right), BT, RL',
      required: false,
      defaultValue: 'TB',
    },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const { type, content, title, direction = 'TB' } = params;

      if (!type || !content) {
        return {
          success: false,
          error: 'Both type and content are required',
        };
      }

      const diagramType = type.toLowerCase() as DiagramType;
      let diagram: string;

      switch (diagramType) {
        case 'flowchart':
          diagram = this.generateFlowchart(content, direction, title);
          break;
        case 'sequence':
          diagram = this.generateSequenceDiagram(content, title);
          break;
        case 'class':
          diagram = this.generateClassDiagram(content, title);
          break;
        case 'state':
          diagram = this.generateStateDiagram(content, title);
          break;
        case 'er':
          diagram = this.generateERDiagram(content, title);
          break;
        case 'gantt':
          diagram = this.generateGanttChart(content, title);
          break;
        case 'pie':
          diagram = this.generatePieChart(content, title);
          break;
        case 'mindmap':
          diagram = this.generateMindmap(content, title);
          break;
        case 'ascii-box':
          diagram = this.generateASCIIBox(content, title);
          break;
        case 'ascii-tree':
          diagram = this.generateASCIITree(content, title);
          break;
        case 'ascii-table':
          diagram = this.generateASCIITable(content, title);
          break;
        default:
          return {
            success: false,
            error: `Unknown diagram type: ${type}. Supported types: flowchart, sequence, class, state, er, gantt, pie, mindmap, ascii-box, ascii-tree, ascii-table`,
          };
      }

      return {
        success: true,
        data: {
          type: diagramType,
          diagram,
          format: diagramType.startsWith('ascii') ? 'ascii' : 'mermaid',
          title: title ?? null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error generating diagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate a flowchart in mermaid syntax
   */
  private generateFlowchart(content: string, direction: string, title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push('---');
      lines.push(`title: ${title}`);
      lines.push('---');
    }

    lines.push(`flowchart ${direction}`);

    // Parse content - expecting format like:
    // "Start -> Process -> Decision{condition} -> End"
    // or structured JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed.nodes && parsed.edges) {
        // Structured format
        for (const node of parsed.nodes) {
          const shape = this.getNodeShape(node.type);
          lines.push(`    ${node.id}${shape[0]}"${node.label}"${shape[1]}`);
        }
        for (const edge of parsed.edges) {
          const arrow = edge.label ? `-->|${edge.label}|` : '-->';
          lines.push(`    ${edge.from} ${arrow} ${edge.to}`);
        }
      }
    } catch {
      // Simple text format - pass through with some processing
      const flowLines = content.split(/->|-->/).map(s => s.trim());
      for (let i = 0; i < flowLines.length - 1; i++) {
        const from = this.sanitizeNodeId(flowLines[i]);
        const to = this.sanitizeNodeId(flowLines[i + 1]);
        lines.push(`    ${from} --> ${to}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a sequence diagram in mermaid syntax
   */
  private generateSequenceDiagram(content: string, title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push('---');
      lines.push(`title: ${title}`);
      lines.push('---');
    }

    lines.push('sequenceDiagram');

    // Parse content - expecting format like:
    // "Alice -> Bob: Hello\nBob -> Alice: Hi"
    const interactions = content.split('\n').filter(l => l.trim());
    for (const interaction of interactions) {
      // Support -> for solid arrow, ->> for async
      const match = interaction.match(/(\w+)\s*(->>?)\s*(\w+):\s*(.+)/);
      if (match) {
        const [, from, arrow, to, message] = match;
        lines.push(`    ${from}${arrow}${to}: ${message}`);
      } else {
        // Pass through if already formatted
        lines.push(`    ${interaction.trim()}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a class diagram in mermaid syntax
   */
  private generateClassDiagram(content: string, title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push('---');
      lines.push(`title: ${title}`);
      lines.push('---');
    }

    lines.push('classDiagram');

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        for (const cls of parsed) {
          if (cls.name) {
            lines.push(`    class ${cls.name} {`);
            if (cls.properties) {
              for (const prop of cls.properties) {
                lines.push(`        ${prop}`);
              }
            }
            if (cls.methods) {
              for (const method of cls.methods) {
                lines.push(`        ${method}`);
              }
            }
            lines.push(`    }`);
          }
          if (cls.extends) {
            lines.push(`    ${cls.extends} <|-- ${cls.name}`);
          }
          if (cls.implements) {
            lines.push(`    ${cls.implements} <|.. ${cls.name}`);
          }
        }
      }
    } catch {
      // Pass through as-is
      lines.push(`    ${content}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate a state diagram in mermaid syntax
   */
  private generateStateDiagram(content: string, title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push('---');
      lines.push(`title: ${title}`);
      lines.push('---');
    }

    lines.push('stateDiagram-v2');

    // Parse transitions
    const transitions = content.split('\n').filter(l => l.trim());
    for (const transition of transitions) {
      const match = transition.match(/(\w+|\[\*\])\s*-->\s*(\w+|\[\*\])(?::\s*(.+))?/);
      if (match) {
        const [, from, to, label] = match;
        if (label) {
          lines.push(`    ${from} --> ${to}: ${label}`);
        } else {
          lines.push(`    ${from} --> ${to}`);
        }
      } else {
        lines.push(`    ${transition.trim()}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate an ER diagram in mermaid syntax
   */
  private generateERDiagram(content: string, title?: string): string {
    const lines: string[] = [];

    if (title) {
      lines.push('---');
      lines.push(`title: ${title}`);
      lines.push('---');
    }

    lines.push('erDiagram');

    try {
      const parsed = JSON.parse(content);
      if (parsed.entities) {
        for (const entity of parsed.entities) {
          lines.push(`    ${entity.name} {`);
          if (entity.attributes) {
            for (const attr of entity.attributes) {
              lines.push(`        ${attr.type} ${attr.name}${attr.key ? ' PK' : ''}`);
            }
          }
          lines.push(`    }`);
        }
      }
      if (parsed.relationships) {
        for (const rel of parsed.relationships) {
          lines.push(`    ${rel.from} ${rel.cardinality || '||--o{'} ${rel.to} : "${rel.label || 'has'}"`);
        }
      }
    } catch {
      lines.push(`    ${content}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate a Gantt chart in mermaid syntax
   */
  private generateGanttChart(content: string, title?: string): string {
    const lines: string[] = [];

    lines.push('gantt');
    if (title) {
      lines.push(`    title ${title}`);
    }
    lines.push('    dateFormat YYYY-MM-DD');

    try {
      const parsed = JSON.parse(content);
      if (parsed.sections) {
        for (const section of parsed.sections) {
          lines.push(`    section ${section.name}`);
          if (section.tasks) {
            for (const task of section.tasks) {
              lines.push(`        ${task.name} : ${task.id || ''}, ${task.start}, ${task.duration}`);
            }
          }
        }
      }
    } catch {
      // Parse simple format: "Task1: 2024-01-01, 5d\nTask2: 2024-01-06, 3d"
      const tasks = content.split('\n').filter(l => l.trim());
      for (const task of tasks) {
        lines.push(`    ${task.trim()}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a pie chart in mermaid syntax
   */
  private generatePieChart(content: string, title?: string): string {
    const lines: string[] = [];

    lines.push('pie');
    if (title) {
      lines.push(`    title ${title}`);
    }

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.label && item.value !== undefined) {
            lines.push(`    "${item.label}" : ${item.value}`);
          }
        }
      } else if (typeof parsed === 'object') {
        for (const [label, value] of Object.entries(parsed)) {
          lines.push(`    "${label}" : ${value}`);
        }
      }
    } catch {
      // Parse simple format: "Label1: 30\nLabel2: 70"
      const items = content.split('\n').filter(l => l.trim());
      for (const item of items) {
        const match = item.match(/(.+):\s*(\d+)/);
        if (match) {
          lines.push(`    "${match[1].trim()}" : ${match[2]}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate a mindmap in mermaid syntax
   */
  private generateMindmap(content: string, title?: string): string {
    const lines: string[] = [];

    lines.push('mindmap');
    if (title) {
      lines.push(`  root((${title}))`);
    }

    try {
      const parsed = JSON.parse(content);
      this.renderMindmapNode(parsed, lines, 2);
    } catch {
      // Parse indented text format
      const items = content.split('\n');
      for (const item of items) {
        const indent = item.match(/^(\s*)/)?.[1].length ?? 0;
        const text = item.trim();
        if (text) {
          lines.push(`${'  '.repeat(indent / 2 + 2)}${text}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Helper to render mindmap nodes recursively
   */
  private renderMindmapNode(node: any, lines: string[], depth: number): void {
    const indent = '  '.repeat(depth);

    if (typeof node === 'string') {
      lines.push(`${indent}${node}`);
    } else if (node.label) {
      lines.push(`${indent}${node.label}`);
      if (node.children) {
        for (const child of node.children) {
          this.renderMindmapNode(child, lines, depth + 1);
        }
      }
    } else if (typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        lines.push(`${indent}${key}`);
        if (Array.isArray(value)) {
          for (const child of value) {
            this.renderMindmapNode(child, lines, depth + 1);
          }
        }
      }
    }
  }

  /**
   * Generate an ASCII box diagram
   */
  private generateASCIIBox(content: string, title?: string): string {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const maxLength = Math.max(...lines.map(l => l.length), title?.length ?? 0);
    const width = maxLength + 4;

    const result: string[] = [];

    // Top border
    result.push(`+${'='.repeat(width - 2)}+`);

    // Title
    if (title) {
      result.push(`| ${title.padEnd(width - 4)} |`);
      result.push(`+${'-'.repeat(width - 2)}+`);
    }

    // Content
    for (const line of lines) {
      result.push(`| ${line.padEnd(width - 4)} |`);
    }

    // Bottom border
    result.push(`+${'='.repeat(width - 2)}+`);

    return result.join('\n');
  }

  /**
   * Generate an ASCII tree diagram
   */
  private generateASCIITree(content: string, title?: string): string {
    const result: string[] = [];

    if (title) {
      result.push(title);
      result.push('='.repeat(title.length));
    }

    try {
      const parsed = JSON.parse(content);
      this.renderASCIITreeNode(parsed, result, '', true);
    } catch {
      // Parse indented format
      const lines = content.split('\n');
      let prevIndent = -1;
      const stack: number[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        const text = line.trim();

        if (!text) continue;

        if (indent > prevIndent) {
          stack.push(i);
        } else if (indent < prevIndent) {
          while (stack.length > 0 && stack.length > indent / 2) {
            stack.pop();
          }
        }

        const isLast = this.isLastSibling(lines, i, indent);
        const prefix = this.getTreePrefix(stack.length, isLast);
        result.push(`${prefix}${text}`);
        prevIndent = indent;
      }
    }

    return result.join('\n');
  }

  /**
   * Helper to check if a node is the last sibling
   */
  private isLastSibling(lines: string[], index: number, indent: number): boolean {
    for (let i = index + 1; i < lines.length; i++) {
      const lineIndent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
      if (lineIndent === indent) return false;
      if (lineIndent < indent) return true;
    }
    return true;
  }

  /**
   * Get tree branch prefix
   */
  private getTreePrefix(depth: number, isLast: boolean): string {
    if (depth === 0) return '';
    const prefix = '    '.repeat(depth - 1);
    return prefix + (isLast ? '└── ' : '├── ');
  }

  /**
   * Helper to render ASCII tree nodes recursively
   */
  private renderASCIITreeNode(node: any, result: string[], prefix: string, isLast: boolean): void {
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (typeof node === 'string') {
      result.push(`${prefix}${connector}${node}`);
    } else if (node.label) {
      result.push(`${prefix}${connector}${node.label}`);
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          this.renderASCIITreeNode(
            node.children[i],
            result,
            prefix + childPrefix,
            i === node.children.length - 1
          );
        }
      }
    }
  }

  /**
   * Generate an ASCII table
   */
  private generateASCIITable(content: string, title?: string): string {
    const result: string[] = [];

    try {
      const parsed = JSON.parse(content);
      if (parsed.headers && parsed.rows) {
        const headers = parsed.headers;
        const rows = parsed.rows;

        // Calculate column widths
        const widths = headers.map((h: string, i: number) => {
          const values = [h, ...rows.map((r: any[]) => String(r[i] ?? ''))];
          return Math.max(...values.map(v => v.length));
        });

        // Helper to create a row
        const createRow = (cells: string[]) => {
          return '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
        };

        const separator = '+' + widths.map((w: number) => '-'.repeat(w + 2)).join('+') + '+';

        if (title) {
          const totalWidth = widths.reduce((a: number, b: number) => a + b, 0) + (widths.length - 1) * 3 + 4;
          result.push(`+${'-'.repeat(totalWidth - 2)}+`);
          result.push(`| ${title.padEnd(totalWidth - 4)} |`);
        }

        result.push(separator);
        result.push(createRow(headers));
        result.push(separator.replace(/-/g, '='));

        for (const row of rows) {
          result.push(createRow(row.map((c: any) => String(c ?? ''))));
        }

        result.push(separator);
      }
    } catch {
      // Try CSV-like format
      const lines = content.split('\n').filter(l => l.trim());
      const rows = lines.map(l => l.split(/[,\t]/));

      if (rows.length > 0) {
        const widths = rows[0].map((_: any, i: number) =>
          Math.max(...rows.map(r => (r[i] ?? '').length))
        );

        const separator = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';

        result.push(separator);
        result.push('| ' + rows[0].map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |');
        result.push(separator.replace(/-/g, '='));

        for (let i = 1; i < rows.length; i++) {
          result.push('| ' + rows[i].map((c, j) => (c ?? '').padEnd(widths[j])).join(' | ') + ' |');
        }

        result.push(separator);
      }
    }

    return result.join('\n');
  }

  /**
   * Get node shape markers for mermaid
   */
  private getNodeShape(type?: string): [string, string] {
    switch (type?.toLowerCase()) {
      case 'decision':
      case 'diamond':
        return ['{', '}'];
      case 'database':
      case 'cylinder':
        return ['[(', ')]'];
      case 'circle':
        return ['((', '))'];
      case 'subroutine':
        return ['[[', ']]'];
      case 'stadium':
        return ['([', '])'];
      case 'hexagon':
        return ['{{', '}}'];
      default:
        return ['[', ']'];
    }
  }

  /**
   * Sanitize node ID for mermaid
   */
  private sanitizeNodeId(text: string): string {
    // Handle decision nodes
    const decisionMatch = text.match(/(.+)\{(.+)\}/);
    if (decisionMatch) {
      return `${decisionMatch[1].trim()}{"${decisionMatch[2].trim()}"}`;
    }

    // Remove special characters, keep alphanumeric and spaces
    const clean = text.replace(/[^\w\s]/g, '').trim();
    const id = clean.replace(/\s+/g, '_');

    return `${id}["${clean}"]`;
  }
}
