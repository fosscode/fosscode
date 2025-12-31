import { SessionManager, SessionTemplate } from '../utils/SessionManager.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let testSessionsDir: string;
  let testTemplatesDir: string;

  beforeEach(async () => {
    sessionManager = new SessionManager();

    // Get the paths from the session manager
    testSessionsDir = sessionManager.getSessionsDir();
    testTemplatesDir = sessionManager.getTemplatesDir();

    // Clean up before each test
    await sessionManager.initialize();
  });

  afterEach(async () => {
    // Clean up test sessions
    try {
      const sessions = await sessionManager.listSessions();
      for (const session of sessions) {
        if (session.id.startsWith('session_')) {
          await sessionManager.deleteSession(session.id);
        }
      }

      const templates = await sessionManager.listTemplates();
      for (const template of templates) {
        if (template.id.startsWith('template_')) {
          await sessionManager.deleteTemplate(template.id);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize and create directories', async () => {
      await sessionManager.initialize();

      const sessionsDirExists = await fs
        .access(testSessionsDir)
        .then(() => true)
        .catch(() => false);
      const templatesDirExists = await fs
        .access(testTemplatesDir)
        .then(() => true)
        .catch(() => false);

      expect(sessionsDirExists).toBe(true);
      expect(templatesDirExists).toBe(true);
    });
  });

  describe('session creation', () => {
    it('should create a new session with basic properties', () => {
      const session = sessionManager.createSession('Test Session', 'openai', 'gpt-4');

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^session_/);
      expect(session.name).toBe('Test Session');
      expect(session.provider).toBe('openai');
      expect(session.model).toBe('gpt-4');
      expect(session.messages).toEqual([]);
      expect(session.fileContext).toEqual([]);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('should create a session with description', () => {
      const session = sessionManager.createSession('Test Session', 'openai', 'gpt-4', {
        description: 'A test session',
      });

      expect(session.description).toBe('A test session');
    });

    it('should set the current session when creating', () => {
      const session = sessionManager.createSession('Test Session', 'openai', 'gpt-4');

      expect(sessionManager.getCurrentSession()).toEqual(session);
    });
  });

  describe('session persistence', () => {
    it('should save a session to disk', async () => {
      const session = sessionManager.createSession('Persist Test', 'anthropic', 'claude-3');
      const sessionId = await sessionManager.saveSession(session);

      const sessionPath = path.join(testSessionsDir, `${sessionId}.json`);
      const exists = await fs
        .access(sessionPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it('should load a saved session', async () => {
      const originalSession = sessionManager.createSession('Load Test', 'openai', 'gpt-4');
      originalSession.messages.push({
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
      });

      await sessionManager.saveSession(originalSession);
      sessionManager.clearCurrentSession();

      const loadedSession = await sessionManager.loadSession(originalSession.id);

      expect(loadedSession.id).toBe(originalSession.id);
      expect(loadedSession.name).toBe('Load Test');
      expect(loadedSession.messages).toHaveLength(1);
      expect(loadedSession.messages[0].content).toBe('Hello');
    });

    it('should throw error when loading non-existent session', async () => {
      await expect(sessionManager.loadSession('non_existent_id')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should delete a session', async () => {
      const session = sessionManager.createSession('Delete Test', 'openai', 'gpt-4');
      await sessionManager.saveSession(session);

      await sessionManager.deleteSession(session.id);

      await expect(sessionManager.loadSession(session.id)).rejects.toThrow('Session not found');
    });
  });

  describe('session listing', () => {
    it('should list all sessions sorted by updated date', async () => {
      const session1 = sessionManager.createSession('Session 1', 'openai', 'gpt-4');
      await sessionManager.saveSession(session1);

      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      const session2 = sessionManager.createSession('Session 2', 'anthropic', 'claude-3');
      await sessionManager.saveSession(session2);

      const sessions = await sessionManager.listSessions();

      // Should be sorted by updatedAt (most recent first)
      const testSessions = sessions.filter(s => s.name.startsWith('Session '));
      expect(testSessions.length).toBeGreaterThanOrEqual(2);
      expect(testSessions[0].name).toBe('Session 2');
      expect(testSessions[1].name).toBe('Session 1');
    });

    it('should return empty array when no sessions exist', async () => {
      // Clean up all sessions
      const sessions = await sessionManager.listSessions();
      for (const session of sessions) {
        await sessionManager.deleteSession(session.id);
      }

      const result = await sessionManager.listSessions();
      expect(result).toEqual([]);
    });
  });

  describe('message management', () => {
    it('should update session messages', () => {
      sessionManager.createSession('Message Test', 'openai', 'gpt-4');

      const messages = [
        { role: 'user' as const, content: 'Hello', timestamp: new Date() },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: new Date() },
      ];

      sessionManager.updateMessages(messages);

      const session = sessionManager.getCurrentSession();
      expect(session?.messages).toHaveLength(2);
      expect(session?.messages[0].content).toBe('Hello');
    });
  });

  describe('tool state tracking', () => {
    it('should add commands to tool state', () => {
      sessionManager.createSession('Tool Test', 'openai', 'gpt-4');

      sessionManager.addCommand('npm install', 0, 'installed packages');

      const session = sessionManager.getCurrentSession();
      expect(session?.toolState.commandsRun).toHaveLength(1);
      expect(session?.toolState.commandsRun[0].command).toBe('npm install');
      expect(session?.toolState.commandsRun[0].exitCode).toBe(0);
    });

    it('should add modified files to tool state', () => {
      sessionManager.createSession('File Test', 'openai', 'gpt-4');

      sessionManager.addModifiedFile('/path/to/file.ts');
      sessionManager.addModifiedFile('/path/to/other.ts');
      sessionManager.addModifiedFile('/path/to/file.ts'); // Duplicate

      const session = sessionManager.getCurrentSession();
      expect(session?.toolState.filesModified).toHaveLength(2);
    });
  });

  describe('file context', () => {
    it('should attach files to session', async () => {
      sessionManager.createSession('File Context Test', 'openai', 'gpt-4');

      // Create a temp file to attach
      const tempFile = path.join(os.tmpdir(), `fosscode-test-${Date.now()}.txt`);
      await fs.writeFile(tempFile, 'Test content');

      try {
        await sessionManager.attachFile(tempFile);

        const session = sessionManager.getCurrentSession();
        expect(session?.fileContext).toHaveLength(1);
        expect(session?.fileContext[0].path).toBe(tempFile);
        expect(session?.fileContext[0].content).toBe('Test content');
        expect(session?.fileContext[0].attached).toBe(true);
      } finally {
        await fs.unlink(tempFile).catch(() => {});
      }
    });

    it('should detach files from session', async () => {
      sessionManager.createSession('Detach Test', 'openai', 'gpt-4');

      const tempFile = path.join(os.tmpdir(), `fosscode-test-${Date.now()}.txt`);
      await fs.writeFile(tempFile, 'Test content');

      try {
        await sessionManager.attachFile(tempFile);
        sessionManager.detachFile(tempFile);

        const session = sessionManager.getCurrentSession();
        expect(session?.fileContext[0].attached).toBe(false);
        expect(session?.fileContext[0].content).toBeUndefined();
      } finally {
        await fs.unlink(tempFile).catch(() => {});
      }
    });
  });

  describe('template management', () => {
    it('should save and load a template', async () => {
      const template: SessionTemplate = {
        id: `template_test_${Date.now()}`,
        name: 'Test Template',
        description: 'A test template',
        systemPrompt: 'You are a helpful assistant',
        initialFiles: ['/path/to/file.ts'],
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
      };

      await sessionManager.saveTemplate(template);
      const loadedTemplate = await sessionManager.loadTemplate(template.id);

      expect(loadedTemplate.name).toBe('Test Template');
      expect(loadedTemplate.systemPrompt).toBe('You are a helpful assistant');

      // Cleanup
      await sessionManager.deleteTemplate(template.id);
    });

    it('should create session from template', async () => {
      const template: SessionTemplate = {
        id: `template_create_${Date.now()}`,
        name: 'Create Template',
        description: 'For testing session creation',
        systemPrompt: 'You are a code assistant',
        initialFiles: [],
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3',
      };

      await sessionManager.saveTemplate(template);

      const session = sessionManager.createSession('From Template', 'openai', 'gpt-4', {
        template,
      });

      expect(session.provider).toBe('anthropic'); // From template
      expect(session.model).toBe('claude-3'); // From template
      expect(session.messages).toHaveLength(1); // System prompt
      expect(session.messages[0].role).toBe('system');
      expect(session.messages[0].content).toBe('You are a code assistant');

      // Cleanup
      await sessionManager.deleteTemplate(template.id);
    });

    it('should list all templates', async () => {
      const template1: SessionTemplate = {
        id: `template_list_1_${Date.now()}`,
        name: 'Template 1',
        description: 'First template',
        initialFiles: [],
      };

      const template2: SessionTemplate = {
        id: `template_list_2_${Date.now()}`,
        name: 'Template 2',
        description: 'Second template',
        initialFiles: [],
      };

      await sessionManager.saveTemplate(template1);
      await sessionManager.saveTemplate(template2);

      const templates = await sessionManager.listTemplates();
      const testTemplates = templates.filter(t => t.name.startsWith('Template '));

      expect(testTemplates.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await sessionManager.deleteTemplate(template1.id);
      await sessionManager.deleteTemplate(template2.id);
    });

    it('should create template from current session', async () => {
      sessionManager.createSession('Template Source', 'openai', 'gpt-4');

      sessionManager.updateMessages([
        { role: 'system', content: 'Custom system prompt', timestamp: new Date() },
      ]);

      const template = await sessionManager.createTemplateFromSession(
        'Generated Template',
        'Created from session'
      );

      expect(template.name).toBe('Generated Template');
      expect(template.systemPrompt).toBe('Custom system prompt');
      expect(template.defaultProvider).toBe('openai');

      // Cleanup
      await sessionManager.deleteTemplate(template.id);
    });
  });

  describe('resume session', () => {
    it('should resume session and restore file context', async () => {
      const tempFile = path.join(os.tmpdir(), `fosscode-resume-${Date.now()}.txt`);
      await fs.writeFile(tempFile, 'Resume test content');

      try {
        // Create and save session with file
        sessionManager.createSession('Resume Test', 'openai', 'gpt-4');
        await sessionManager.attachFile(tempFile);
        const originalSession = sessionManager.getCurrentSession()!;
        await sessionManager.saveSession();

        // Clear and resume
        sessionManager.clearCurrentSession();
        const resumedSession = await sessionManager.resumeSession(originalSession.id);

        expect(resumedSession.fileContext[0].content).toBe('Resume test content');
        expect(resumedSession.fileContext[0].attached).toBe(true);
      } finally {
        await fs.unlink(tempFile).catch(() => {});
      }
    });
  });
});
