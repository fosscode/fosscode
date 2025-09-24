import { PromptHistoryManager } from '../utils/PromptHistoryManager.js';
import { fileTrackerManager } from '../utils/FileTrackerManager.js';
import { generate as generateSystemPrompt } from '../prompts/SystemPrompt.js';
import { initializeTools, getTool } from '../tools/init.js';
import { toolRegistry } from '../tools/ToolRegistry.js';
import * as fs from 'fs';
import * as path from 'path';

describe('System Integration Tests', () => {
  let promptHistory: PromptHistoryManager;
  let testDir: string;

  beforeEach(() => {
    // Create test directory
    testDir = path.join(process.cwd(), 'test-integration-dir');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(path.join(testDir, 'test1.txt'), 'Test content 1');
    fs.writeFileSync(path.join(testDir, 'test2.txt'), 'Test content 2');

    promptHistory = new PromptHistoryManager();
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Context Integration', () => {
    it('should integrate prompt history into system prompt generation', async () => {
      // Add some prompts to history
      await promptHistory.addPrompt('First test prompt');
      await promptHistory.addPrompt('Second test prompt');

      // Generate system prompt
      const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

      // Verify prompt history is included
      expect(systemPrompt).toContain('## Recent Prompt History');
      expect(systemPrompt).toContain('First test prompt');
      expect(systemPrompt).toContain('Second test prompt');
    });

    it('should integrate file tracking into system prompt generation', async () => {
      const fileTracker = fileTrackerManager.getFileTracker();

      // Track some file accesses
      fileTracker.trackFileAccess(path.join(testDir, 'test1.txt'), 'read', 'read');
      fileTracker.trackFileAccess(path.join(testDir, 'test2.txt'), 'write', 'edit');

      // Generate system prompt
      const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

      // Verify file context is included
      expect(systemPrompt).toContain('## Recently Accessed Files');
      expect(systemPrompt).toContain('test1.txt');
      expect(systemPrompt).toContain('test2.txt');
    });

    it('should combine all context sources in system prompt', async () => {
      // Setup all context sources
      await promptHistory.addPrompt('Integration test prompt');

      const fileTracker = fileTrackerManager.getFileTracker();
      fileTracker.trackFileAccess(path.join(testDir, 'test1.txt'), 'read', 'read');

      // Generate system prompt
      const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

      // Verify all context types are present
      expect(systemPrompt).toContain('## Recent Prompt History');
      expect(systemPrompt).toContain('Integration test prompt');
      expect(systemPrompt).toContain('## Recently Accessed Files');
      expect(systemPrompt).toContain('test1.txt');
      expect(systemPrompt).toContain('## Available Tools');
    });
  });

  describe('Tool Execution Integration', () => {
    beforeEach(() => {
      toolRegistry.clear();
      initializeTools();
    });

    it('should execute read tool and track file access', async () => {
      const readTool = getTool('read');
      expect(readTool).toBeDefined();

      const testFile = path.join(testDir, 'test1.txt');
      const result = await readTool!.execute({
        filePath: testFile,
        withLineNumbers: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toContain('Test content 1');

      // Verify file was tracked
      const fileTracker = fileTrackerManager.getFileTracker();
      const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
      expect(recentFiles.some(file => file.filePath.includes('test1.txt'))).toBe(true);
    });

    it('should execute grep tool and track file access', async () => {
      const grepTool = getTool('grep');
      expect(grepTool).toBeDefined();

      const result = await grepTool!.execute({
        pattern: 'Test',
        path: testDir,
      });

      expect(result.success).toBe(true);
      expect(result.data.results).toBeDefined();
      expect(result.data.results.length).toBeGreaterThan(0);

      // Verify files were tracked
      const fileTracker = fileTrackerManager.getFileTracker();
      const recentFiles = fileTracker.getRecentlyAccessedFiles(5);
      expect(recentFiles.length).toBeGreaterThan(0);
    });

    it('should handle tool execution errors gracefully', async () => {
      const readTool = getTool('read');
      expect(readTool).toBeDefined();

      const result = await readTool!.execute({
        filePath: '/non/existent/file.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Cross-Component Integration', () => {
    it('should maintain consistent state across components', async () => {
      // Setup initial state
      await promptHistory.addPrompt('Initial prompt');

      const fileTracker = fileTrackerManager.getFileTracker();
      fileTracker.trackFileAccess(path.join(testDir, 'test1.txt'), 'read', 'read');

      // Execute a tool
      const readTool = getTool('read');
      await readTool!.execute({
        filePath: path.join(testDir, 'test1.txt'),
      });

      // Generate system prompt and verify all state is reflected
      const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

      expect(systemPrompt).toContain('Initial prompt');
      expect(systemPrompt).toContain('test1.txt');
      expect(systemPrompt).toContain('## Available Tools');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle tool execution failures without breaking context tracking', async () => {
      const readTool = getTool('read');
      expect(readTool).toBeDefined();

      // Execute with invalid file
      const result = await readTool!.execute({
        filePath: '/invalid/path/file.txt',
      });

      expect(result.success).toBe(false);

      // Verify system can still generate prompts and track files
      await promptHistory.addPrompt('Error handling test');

      const fileTracker = fileTrackerManager.getFileTracker();
      fileTracker.trackFileAccess(path.join(testDir, 'test1.txt'), 'read', 'read');

      const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');
      expect(systemPrompt).toContain('Error handling test');
      expect(systemPrompt).toContain('test1.txt');
    });
  });
});
