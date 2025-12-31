import { SessionExporter, ExportFormat } from '../utils/SessionExporter.js';
import { SessionState } from '../utils/SessionManager.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SessionExporter', () => {
  let sessionExporter: SessionExporter;
  let mockSession: SessionState;

  beforeEach(() => {
    sessionExporter = new SessionExporter();

    mockSession = {
      id: 'session_test_123',
      name: 'Test Session',
      description: 'A test session for export',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T12:00:00.000Z',
      provider: 'openai',
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: new Date('2024-01-15T10:30:00.000Z'),
        },
        {
          role: 'assistant',
          content: 'I am doing well, thank you for asking!',
          timestamp: new Date('2024-01-15T10:31:00.000Z'),
        },
        {
          role: 'user',
          content: 'Can you help me with some code?',
          timestamp: new Date('2024-01-15T10:32:00.000Z'),
        },
        {
          role: 'assistant',
          content: 'Of course! Here is an example:\n```javascript\nconsole.log("Hello");\n```',
          timestamp: new Date('2024-01-15T10:33:00.000Z'),
        },
      ],
      fileContext: [
        {
          path: '/src/index.ts',
          content: 'export const main = () => {};',
          lastModified: '2024-01-15T09:00:00.000Z',
          attached: true,
        },
      ],
      toolState: {
        commandsRun: [
          {
            command: 'npm install',
            timestamp: '2024-01-15T10:35:00.000Z',
            exitCode: 0,
            output: 'added 100 packages',
          },
          {
            command: 'npm test',
            timestamp: '2024-01-15T10:36:00.000Z',
            exitCode: 1,
            output: 'FAIL: 2 tests failed',
          },
        ],
        filesModified: ['/src/index.ts', '/src/utils.ts'],
        lastWorkingDirectory: '/project',
      },
      metadata: {
        version: '1.0.0',
        workingDirectory: '/project',
        totalTokensUsed: 1500,
        tags: ['test', 'export'],
      },
    };
  });

  describe('export to Markdown', () => {
    it('should export session to markdown format', () => {
      const result = sessionExporter.export(mockSession, { format: 'markdown' });

      expect(result.format).toBe('markdown');
      expect(result.filename).toMatch(/session_Test_Session_.*\.md$/);
      expect(result.content).toContain('# Test Session');
      expect(result.content).toContain('> A test session for export');
      expect(result.content).toContain('**Provider:** openai');
      expect(result.content).toContain('**Model:** gpt-4');
    });

    it('should include conversation in markdown', () => {
      const result = sessionExporter.export(mockSession, { format: 'markdown' });

      expect(result.content).toContain('## Conversation');
      expect(result.content).toContain('### User');
      expect(result.content).toContain('Hello, how are you?');
      expect(result.content).toContain('### Assistant');
      expect(result.content).toContain('I am doing well, thank you for asking!');
    });

    it('should include file context in markdown', () => {
      const result = sessionExporter.export(mockSession, { format: 'markdown' });

      expect(result.content).toContain('## Files');
      expect(result.content).toContain('/src/index.ts');
      expect(result.content).toContain('export const main = () => {};');
    });

    it('should include commands in markdown', () => {
      const result = sessionExporter.export(mockSession, { format: 'markdown' });

      expect(result.content).toContain('## Commands Executed');
      expect(result.content).toContain('npm install');
      expect(result.content).toContain('Exit code: 0');
      expect(result.content).toContain('npm test');
      expect(result.content).toContain('Exit code: 1');
    });

    it('should exclude file context when option is false', () => {
      const result = sessionExporter.export(mockSession, {
        format: 'markdown',
        includeFileContext: false,
      });

      expect(result.content).not.toContain('## Files');
      // Note: /src/index.ts may still appear in modified files section
      expect(result.content).not.toContain('export const main = () => {};');
    });

    it('should exclude commands when option is false', () => {
      const result = sessionExporter.export(mockSession, {
        format: 'markdown',
        includeCommands: false,
      });

      expect(result.content).not.toContain('## Commands Executed');
      expect(result.content).not.toContain('npm install');
    });

    it('should exclude timestamps when option is false', () => {
      const result = sessionExporter.export(mockSession, {
        format: 'markdown',
        includeTimestamps: false,
      });

      // Timestamps in the format (date string) should not appear
      expect(result.content).not.toMatch(/\*\(\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('export to JSON', () => {
    it('should export session to valid JSON format', () => {
      const result = sessionExporter.export(mockSession, { format: 'json' });

      expect(result.format).toBe('json');
      expect(result.filename).toMatch(/session_Test_Session_.*\.json$/);

      const parsed = JSON.parse(result.content);
      expect(parsed.id).toBe('session_test_123');
      expect(parsed.name).toBe('Test Session');
      expect(parsed.provider).toBe('openai');
    });

    it('should include messages in JSON export', () => {
      const result = sessionExporter.export(mockSession, { format: 'json' });
      const parsed = JSON.parse(result.content);

      expect(parsed.messages).toHaveLength(4);
      expect(parsed.messages[0].role).toBe('user');
      expect(parsed.messages[0].content).toBe('Hello, how are you?');
    });

    it('should include file context in JSON export', () => {
      const result = sessionExporter.export(mockSession, { format: 'json' });
      const parsed = JSON.parse(result.content);

      expect(parsed.fileContext).toHaveLength(1);
      expect(parsed.fileContext[0].path).toBe('/src/index.ts');
    });

    it('should include tool state in JSON export', () => {
      const result = sessionExporter.export(mockSession, { format: 'json' });
      const parsed = JSON.parse(result.content);

      expect(parsed.toolState.commandsRun).toHaveLength(2);
      expect(parsed.toolState.filesModified).toHaveLength(2);
    });

    it('should exclude file context when option is false', () => {
      const result = sessionExporter.export(mockSession, {
        format: 'json',
        includeFileContext: false,
      });
      const parsed = JSON.parse(result.content);

      expect(parsed.fileContext).toBeUndefined();
    });
  });

  describe('export to HTML', () => {
    it('should export session to valid HTML format', () => {
      const result = sessionExporter.export(mockSession, { format: 'html' });

      expect(result.format).toBe('html');
      expect(result.filename).toMatch(/session_Test_Session_.*\.html$/);
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('<html');
      expect(result.content).toContain('</html>');
    });

    it('should include title in HTML', () => {
      const result = sessionExporter.export(mockSession, { format: 'html' });

      expect(result.content).toContain('<title>Test Session - fosscode Session</title>');
      expect(result.content).toContain('<h1>Test Session</h1>');
    });

    it('should include messages with proper styling', () => {
      const result = sessionExporter.export(mockSession, { format: 'html' });

      expect(result.content).toContain('class="message user"');
      expect(result.content).toContain('class="message assistant"');
      expect(result.content).toContain('Hello, how are you?');
    });

    it('should escape HTML characters in content', () => {
      const sessionWithHtml: SessionState = {
        ...mockSession,
        messages: [
          {
            role: 'user',
            content: '<script>alert("xss")</script>',
            timestamp: new Date(),
          },
        ],
      };

      const result = sessionExporter.export(sessionWithHtml, { format: 'html' });

      expect(result.content).not.toContain('<script>alert("xss")</script>');
      expect(result.content).toContain('&lt;script&gt;');
    });

    it('should include metadata section', () => {
      const result = sessionExporter.export(mockSession, { format: 'html' });

      expect(result.content).toContain('<dt>Provider</dt>');
      expect(result.content).toContain('<dd>openai</dd>');
      expect(result.content).toContain('<dt>Model</dt>');
      expect(result.content).toContain('<dd>gpt-4</dd>');
    });

    it('should include commands section', () => {
      const result = sessionExporter.export(mockSession, { format: 'html' });

      expect(result.content).toContain('class="commands"');
      expect(result.content).toContain('npm install');
      expect(result.content).toContain('class="exit-code success"');
      expect(result.content).toContain('class="exit-code error"');
    });
  });

  describe('export to file', () => {
    it('should write export to file', async () => {
      const tempDir = path.join(os.tmpdir(), `fosscode-export-test-${Date.now()}`);

      try {
        const filePath = await sessionExporter.exportToFile(
          mockSession,
          { format: 'markdown' },
          tempDir
        );

        expect(filePath).toContain(tempDir);
        expect(filePath).toMatch(/\.md$/);

        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain('# Test Session');
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true }).catch(() => {});
      }
    });

    it('should use current directory when no output dir specified', async () => {
      const filePath = await sessionExporter.exportToFile(mockSession, { format: 'json' });

      try {
        expect(filePath).toContain(process.cwd());

        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        expect(parsed.name).toBe('Test Session');
      } finally {
        // Cleanup
        await fs.unlink(filePath).catch(() => {});
      }
    });
  });

  describe('format validation', () => {
    it('should throw error for unsupported format', () => {
      expect(() => {
        sessionExporter.export(mockSession, { format: 'xml' as ExportFormat });
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('edge cases', () => {
    it('should handle session with no messages', () => {
      const emptySession: SessionState = {
        ...mockSession,
        messages: [],
      };

      const result = sessionExporter.export(emptySession, { format: 'markdown' });

      expect(result.content).toContain('## Conversation');
      expect(result.content).not.toContain('### User');
    });

    it('should handle session with no file context', () => {
      const noFilesSession: SessionState = {
        ...mockSession,
        fileContext: [],
      };

      const result = sessionExporter.export(noFilesSession, { format: 'markdown' });

      expect(result.content).not.toContain('## Files');
    });

    it('should handle session with no commands', () => {
      const noCommandsSession: SessionState = {
        ...mockSession,
        toolState: {
          ...mockSession.toolState,
          commandsRun: [],
          filesModified: [],
        },
      };

      const result = sessionExporter.export(noCommandsSession, { format: 'markdown' });

      expect(result.content).not.toContain('## Commands Executed');
    });

    it('should handle special characters in session name', () => {
      const specialSession: SessionState = {
        ...mockSession,
        name: 'Test/Session:With"Special<Chars>',
      };

      const result = sessionExporter.export(specialSession, { format: 'markdown' });

      // Filename should have special chars replaced
      expect(result.filename).toMatch(/session_Test_Session_With_Special_Chars_/);
    });
  });
});
