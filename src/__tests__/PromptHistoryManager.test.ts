import { PromptHistoryManager } from '../utils/PromptHistoryManager.js';

describe('PromptHistoryManager', () => {
  let promptHistory: PromptHistoryManager;

  beforeEach(() => {
    // Create a new instance for each test
    promptHistory = new PromptHistoryManager();
  });

  describe('basic functionality', () => {
    it('should start with empty history', () => {
      expect(promptHistory.getHistorySize()).toBe(0);
      expect(promptHistory.getHistory()).toEqual([]);
    });

    it('should add prompts to history', async () => {
      const prompt = 'Test prompt';
      await promptHistory.addPrompt(prompt);

      expect(promptHistory.getHistorySize()).toBe(1);
      expect(promptHistory.getHistory()).toEqual([prompt]);
    });

    it('should not add empty prompts', async () => {
      await promptHistory.addPrompt('');
      await promptHistory.addPrompt('   ');

      expect(promptHistory.getHistorySize()).toBe(0);
    });

    it('should not add duplicate consecutive prompts', async () => {
      const prompt = 'Duplicate prompt';
      await promptHistory.addPrompt(prompt);
      await promptHistory.addPrompt(prompt);

      expect(promptHistory.getHistorySize()).toBe(1);
      expect(promptHistory.getHistory()).toEqual([prompt]);
    });

    it('should trim whitespace from prompts', async () => {
      const prompt = '  Test prompt with spaces  ';
      await promptHistory.addPrompt(prompt);

      expect(promptHistory.getHistory()).toEqual(['Test prompt with spaces']);
    });
  });

  describe('history retrieval', () => {
    it('should return all prompts in order', async () => {
      const prompts = ['First', 'Second', 'Third'];
      for (const prompt of prompts) {
        await promptHistory.addPrompt(prompt);
      }

      expect(promptHistory.getHistory()).toEqual(prompts);
    });

    it('should return history entries with timestamps', async () => {
      const prompt = 'Timestamp test';
      const beforeTime = new Date();

      await promptHistory.addPrompt(prompt);

      const afterTime = new Date();
      const historyWithTimestamps = promptHistory.getHistoryWithTimestamps();

      expect(historyWithTimestamps).toHaveLength(1);
      expect(historyWithTimestamps[0].prompt).toBe(prompt);
      expect(historyWithTimestamps[0].timestamp).toBeDefined();

      const entryTime = new Date(historyWithTimestamps[0].timestamp);
      expect(entryTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(entryTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should return the most recent prompts up to the specified count', async () => {
      const prompts = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
      for (const prompt of prompts) {
        await promptHistory.addPrompt(prompt);
      }

      const latest3 = await promptHistory.getLatestPrompts(3);
      expect(latest3).toEqual(['Third', 'Fourth', 'Fifth']);
    });

    it('should return prompt at specified index', async () => {
      const prompts = ['Zero', 'One', 'Two'];
      for (const prompt of prompts) {
        await promptHistory.addPrompt(prompt);
      }

      expect(await promptHistory.getPromptAt(0)).toBe('Zero');
      expect(await promptHistory.getPromptAt(1)).toBe('One');
      expect(await promptHistory.getPromptAt(2)).toBe('Two');
    });

    it('should return null for invalid indices', async () => {
      await promptHistory.addPrompt('Test');

      expect(await promptHistory.getPromptAt(-1)).toBeNull();
      expect(await promptHistory.getPromptAt(5)).toBeNull();
    });
  });

  describe('history management', () => {
    it('should clear all history', async () => {
      await promptHistory.addPrompt('Test prompt');
      expect(promptHistory.getHistorySize()).toBe(1);

      await promptHistory.clearHistory();
      expect(promptHistory.getHistorySize()).toBe(0);
      expect(promptHistory.getHistory()).toEqual([]);
    });

    it('should maintain maximum history size', async () => {
      const maxSize = 5;
      const smallHistory = new PromptHistoryManager(maxSize);

      // Add more prompts than the maximum
      for (let i = 0; i < maxSize + 3; i++) {
        await smallHistory.addPrompt(`Prompt ${i}`);
      }

      expect(smallHistory.getHistorySize()).toBe(maxSize);
    });
  });
});
