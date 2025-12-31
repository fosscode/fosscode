import { DiagramTool } from '../tools/DiagramTool';

describe('DiagramTool', () => {
  let diagramTool: DiagramTool;

  beforeEach(() => {
    diagramTool = new DiagramTool();
  });

  describe('constructor', () => {
    it('should create a DiagramTool with correct properties', () => {
      expect(diagramTool.name).toBe('diagram');
      expect(diagramTool.description).toContain('diagram');
      expect(diagramTool.parameters.length).toBe(4);
    });

    it('should have required parameters', () => {
      const typeParam = diagramTool.parameters.find(p => p.name === 'type');
      const contentParam = diagramTool.parameters.find(p => p.name === 'content');

      expect(typeParam?.required).toBe(true);
      expect(contentParam?.required).toBe(true);
    });
  });

  describe('flowchart generation', () => {
    it('should generate a simple flowchart', async () => {
      const result = await diagramTool.execute({
        type: 'flowchart',
        content: 'Start -> Process -> End',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('flowchart');
      expect(result.data.format).toBe('mermaid');
      expect(result.data.diagram).toContain('flowchart');
      expect(result.data.diagram).toContain('-->');
    });

    it('should respect direction parameter', async () => {
      const result = await diagramTool.execute({
        type: 'flowchart',
        content: 'A -> B',
        direction: 'LR',
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('flowchart LR');
    });

    it('should include title when provided', async () => {
      const result = await diagramTool.execute({
        type: 'flowchart',
        content: 'A -> B',
        title: 'My Flowchart',
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('title: My Flowchart');
    });

    it('should handle structured JSON input', async () => {
      const result = await diagramTool.execute({
        type: 'flowchart',
        content: JSON.stringify({
          nodes: [
            { id: 'A', label: 'Start', type: 'circle' },
            { id: 'B', label: 'Process' },
            { id: 'C', label: 'Decision', type: 'decision' },
          ],
          edges: [
            { from: 'A', to: 'B' },
            { from: 'B', to: 'C', label: 'next' },
          ],
        }),
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('flowchart');
    });
  });

  describe('sequence diagram generation', () => {
    it('should generate a sequence diagram', async () => {
      const result = await diagramTool.execute({
        type: 'sequence',
        content: 'Alice -> Bob: Hello\nBob -> Alice: Hi',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('sequence');
      expect(result.data.diagram).toContain('sequenceDiagram');
    });

    it('should handle async arrows', async () => {
      const result = await diagramTool.execute({
        type: 'sequence',
        content: 'Client ->> Server: Request\nServer ->> Client: Response',
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('->>');
    });
  });

  describe('class diagram generation', () => {
    it('should generate a class diagram from JSON', async () => {
      const result = await diagramTool.execute({
        type: 'class',
        content: JSON.stringify([
          {
            name: 'Animal',
            properties: ['+name: string', '+age: number'],
            methods: ['+speak(): void'],
          },
          {
            name: 'Dog',
            extends: 'Animal',
            methods: ['+bark(): void'],
          },
        ]),
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('class');
      expect(result.data.diagram).toContain('classDiagram');
    });
  });

  describe('state diagram generation', () => {
    it('should generate a state diagram', async () => {
      const result = await diagramTool.execute({
        type: 'state',
        content: '[*] --> Idle\nIdle --> Running: start\nRunning --> [*]: stop',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('state');
      expect(result.data.diagram).toContain('stateDiagram-v2');
    });
  });

  describe('ER diagram generation', () => {
    it('should generate an ER diagram from JSON', async () => {
      const result = await diagramTool.execute({
        type: 'er',
        content: JSON.stringify({
          entities: [
            {
              name: 'User',
              attributes: [
                { name: 'id', type: 'int', key: true },
                { name: 'name', type: 'string' },
              ],
            },
            {
              name: 'Order',
              attributes: [
                { name: 'id', type: 'int', key: true },
                { name: 'total', type: 'decimal' },
              ],
            },
          ],
          relationships: [{ from: 'User', to: 'Order', label: 'places' }],
        }),
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('er');
      expect(result.data.diagram).toContain('erDiagram');
    });
  });

  describe('gantt chart generation', () => {
    it('should generate a gantt chart', async () => {
      const result = await diagramTool.execute({
        type: 'gantt',
        content: 'Task 1: 2024-01-01, 5d\nTask 2: 2024-01-06, 3d',
        title: 'Project Timeline',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('gantt');
      expect(result.data.diagram).toContain('gantt');
      expect(result.data.diagram).toContain('title Project Timeline');
    });
  });

  describe('pie chart generation', () => {
    it('should generate a pie chart from simple format', async () => {
      const result = await diagramTool.execute({
        type: 'pie',
        content: 'TypeScript: 60\nJavaScript: 30\nOther: 10',
        title: 'Language Usage',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('pie');
      expect(result.data.diagram).toContain('pie');
    });

    it('should generate a pie chart from JSON array', async () => {
      const result = await diagramTool.execute({
        type: 'pie',
        content: JSON.stringify([
          { label: 'A', value: 50 },
          { label: 'B', value: 30 },
          { label: 'C', value: 20 },
        ]),
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('"A"');
      expect(result.data.diagram).toContain('50');
    });

    it('should generate a pie chart from JSON object', async () => {
      const result = await diagramTool.execute({
        type: 'pie',
        content: JSON.stringify({
          Red: 40,
          Blue: 35,
          Green: 25,
        }),
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('"Red"');
    });
  });

  describe('mindmap generation', () => {
    it('should generate a mindmap', async () => {
      const result = await diagramTool.execute({
        type: 'mindmap',
        content: 'Topic\n  Subtopic 1\n  Subtopic 2\n    Detail',
        title: 'Central Idea',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('mindmap');
      expect(result.data.diagram).toContain('mindmap');
    });
  });

  describe('ASCII box generation', () => {
    it('should generate an ASCII box', async () => {
      const result = await diagramTool.execute({
        type: 'ascii-box',
        content: 'Line 1\nLine 2\nLine 3',
        title: 'Box Title',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('ascii-box');
      expect(result.data.format).toBe('ascii');
      expect(result.data.diagram).toContain('Box Title');
      expect(result.data.diagram).toContain('+');
      expect(result.data.diagram).toContain('|');
    });

    it('should handle single line content', async () => {
      const result = await diagramTool.execute({
        type: 'ascii-box',
        content: 'Single line content',
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('Single line content');
    });
  });

  describe('ASCII tree generation', () => {
    it('should generate an ASCII tree from indented text', async () => {
      const result = await diagramTool.execute({
        type: 'ascii-tree',
        content: 'Root\n  Child 1\n  Child 2\n    Grandchild',
        title: 'Directory Structure',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('ascii-tree');
      expect(result.data.format).toBe('ascii');
    });
  });

  describe('ASCII table generation', () => {
    it('should generate an ASCII table from JSON', async () => {
      const result = await diagramTool.execute({
        type: 'ascii-table',
        content: JSON.stringify({
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['Alice', '30', 'NYC'],
            ['Bob', '25', 'LA'],
          ],
        }),
        title: 'Users Table',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('ascii-table');
      expect(result.data.diagram).toContain('Name');
      expect(result.data.diagram).toContain('Alice');
      expect(result.data.diagram).toContain('+');
      expect(result.data.diagram).toContain('|');
    });

    it('should generate an ASCII table from CSV format', async () => {
      const result = await diagramTool.execute({
        type: 'ascii-table',
        content: 'Col1,Col2,Col3\nA,B,C\nD,E,F',
      });

      expect(result.success).toBe(true);
      expect(result.data.diagram).toContain('Col1');
    });
  });

  describe('error handling', () => {
    it('should return error for unknown diagram type', async () => {
      const result = await diagramTool.execute({
        type: 'unknown',
        content: 'some content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown diagram type');
    });

    it('should return error for missing type', async () => {
      const result = await diagramTool.execute({
        content: 'some content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return error for missing content', async () => {
      const result = await diagramTool.execute({
        type: 'flowchart',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase type names', async () => {
      const result = await diagramTool.execute({
        type: 'FLOWCHART',
        content: 'A -> B',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('flowchart');
    });

    it('should handle mixed case type names', async () => {
      const result = await diagramTool.execute({
        type: 'ASCII-Box',
        content: 'content',
      });

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('ascii-box');
    });
  });
});
