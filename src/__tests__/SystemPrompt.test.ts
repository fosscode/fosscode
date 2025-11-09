import {
  generate as generateSystemPrompt,
  fileContext,
  promptHistoryContext,
} from '../prompts/SystemPrompt.js';
import { fileTrackerManager } from '../utils/FileTrackerManager.js';
import { promptHistoryManager } from '../utils/PromptHistoryManager.js';

describe('SystemPrompt', () => {
  describe('fileContext', () => {
    it('should return empty array when no files are tracked', () => {
      const result = fileContext();
      expect(result).toEqual([]);
    });

    it('should include recently accessed files in context', () => {
      // Get the file tracker and add some test data
      const fileTracker = fileTrackerManager.getFileTracker();

      // Mock some file accesses
      const testFile1 = '/tmp/test-context-1.txt';
      const testFile2 = '/tmp/test-context-2.txt';

      // Create test files
      const fs = require('fs');
      fs.writeFileSync(testFile1, 'test content 1');
      fs.writeFileSync(testFile2, 'test content 2');

      try {
        // Track file accesses
        fileTracker.trackFileAccess(testFile1, 'read', 'read');
        fileTracker.trackFileAccess(testFile2, 'write', 'edit');
        fileTracker.trackFileAccess(testFile1, 'search', 'grep');

        const result = fileContext();

        expect(result).toHaveLength(3); // Header with files + empty line + footer
        expect(result[0]).toContain('## Recently Accessed Files');
        expect(result[0]).toContain('test-context-1.txt');
        expect(result[0]).toContain('test-context-2.txt');
        expect(result[2]).toContain('These files have been accessed recently');
      } finally {
        // Clean up
        if (fs.existsSync(testFile1)) fs.unlinkSync(testFile1);
        if (fs.existsSync(testFile2)) fs.unlinkSync(testFile2);
      }
    });

    it('should limit to 10 most recent files', () => {
      const fileTracker = fileTrackerManager.getFileTracker();

      // Create and track 15 files
      const fs = require('fs');
      const testFiles: string[] = [];

      for (let i = 0; i < 15; i++) {
        const testFile = `/tmp/test-limit-${i}.txt`;
        testFiles.push(testFile);
        fs.writeFileSync(testFile, `content ${i}`);
        fileTracker.trackFileAccess(testFile, 'read', 'read');
      }

      try {
        const result = fileContext();

        // Should contain header with files, empty line, and footer
        expect(result).toHaveLength(3); // header with files + empty line + footer
        expect(result[0]).toContain('## Recently Accessed Files');

        // Check that we have 10 file entries in the first element
        const fileLines = result[0].split('\n').filter(line => line.includes('.txt'));
        expect(fileLines.length).toBe(10);
      } finally {
        // Clean up
        testFiles.forEach(file => {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        });
      }
    });
  });

  describe('promptHistoryContext', () => {
    beforeEach(async () => {
      await promptHistoryManager.initialize();
      await promptHistoryManager.clearHistory();
    });

    it('should return empty array when no prompts are tracked', async () => {
      const result = await promptHistoryContext();
      expect(result).toEqual([]);
    });

    it('should include recent prompts in context', async () => {
      try {
        // Add some test prompts
        await promptHistoryManager.addPrompt('What is the weather today?');
        await promptHistoryManager.addPrompt('Show me the project structure');
        await promptHistoryManager.addPrompt('Help me debug this error');

        const result = await promptHistoryContext();

        expect(result).toHaveLength(3); // Header with prompts + empty line + footer
        expect(result[0]).toContain('## Recent Prompt History');
        expect(result[0]).toContain('What is the weather today?');
        expect(result[0]).toContain('Show me the project structure');
        expect(result[0]).toContain('Help me debug this error');
        expect(result[2]).toContain('This shows your recent prompts in this session');
      } finally {
        await promptHistoryManager.clearHistory();
      }
    });

    it('should limit to 10 most recent prompts', async () => {
      // Add 15 prompts
      for (let i = 0; i < 15; i++) {
        await promptHistoryManager.addPrompt(`Test prompt ${i}`);
      }

      const result = await promptHistoryContext();

      // Should contain header with prompts, empty line, and footer
      expect(result).toHaveLength(3); // header with prompts + empty line + footer
      expect(result[0]).toContain('## Recent Prompt History');

      // Count the number of prompt lines in the first element
      const promptLines = result[0].split('\n').filter(line => /^\d+\./.test(line));
      expect(promptLines.length).toBe(10);
    });

    it('should handle prompt history errors gracefully', async () => {
      // Mock the promptHistoryManager to throw an error
      const originalInitialize = promptHistoryManager.initialize;
      promptHistoryManager.initialize = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await promptHistoryContext();

      // Should return empty array on error
      expect(result).toEqual([]);

      // Restore original method
      promptHistoryManager.initialize = originalInitialize;
    });
  });

  describe('generate system prompt', () => {
    it('should include file context in generated system prompt', async () => {
      // Get the file tracker and add some test data
      const fileTracker = fileTrackerManager.getFileTracker();

      const testFile = '/tmp/test-system-prompt.txt';

      // Create test file
      const fs = require('fs');
      fs.writeFileSync(testFile, 'test content');

      try {
        // Track file access
        fileTracker.trackFileAccess(testFile, 'read', 'read');

        const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

        expect(systemPrompt).toContain('## Recently Accessed Files');
        expect(systemPrompt).toContain('test-system-prompt.txt');
        expect(systemPrompt).toContain('These files have been accessed recently');
      } finally {
        // Clean up
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      }
    });

    it('should include prompt history in generated system prompt', async () => {
      await promptHistoryManager.initialize();
      await promptHistoryManager.clearHistory();

      try {
        // Add a test prompt
        await promptHistoryManager.addPrompt('Test prompt for system context');

        const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

        expect(systemPrompt).toContain('## Recent Prompt History');
        expect(systemPrompt).toContain('Test prompt for system context');
        expect(systemPrompt).toContain('This shows your recent prompts in this session');
      } finally {
        await promptHistoryManager.clearHistory();
      }
    });

    it('should generate complete system prompt with all components', async () => {
      const systemPrompt = await generateSystemPrompt('openai', 'gpt-4');

      // Check that all major components are present
      expect(systemPrompt).toContain('You are an interactive CLI tool');
      expect(systemPrompt).toContain('Available Tools');
      expect(systemPrompt).toContain('Project Structure');

      // Should contain environment information
      expect(systemPrompt).toContain('Working directory');
      expect(systemPrompt).toContain('Platform: darwin');
    });

    it('should include mode information when specified', async () => {
      const codeModePrompt = await generateSystemPrompt('openai', 'gpt-4', 'code');
      const thinkingModePrompt = await generateSystemPrompt('openai', 'gpt-4', 'thinking');

      expect(codeModePrompt).toContain('code mode');
      expect(codeModePrompt).toContain('You can use all available tools');

      expect(thinkingModePrompt).toContain('thinking mode');
      expect(thinkingModePrompt).toContain('read-only tools');
    });
  });
});
