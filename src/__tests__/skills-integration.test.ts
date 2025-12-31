/**
 * Integration tests for the Skills System
 *
 * Tests the complete flow of skill invocation, from parsing user input
 * to injecting instructions into the conversation.
 */

import { SkillManager, resetSkillManager, getSkillManager } from '../utils/SkillManager';
import { SkillFile, SkillExport } from '../types/skills';

// Mock fs module for testing
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    readFile: jest.fn().mockResolvedValue(''),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock the builtin skills with all required skills
jest.mock('../skills/index.js', () => ({
  getBuiltinSkills: () => [
    {
      name: 'commit',
      description: 'Git commit workflow with best practices',
      version: '1.0.0',
      author: 'fosscode',
      instructions:
        'You are helping with a git commit workflow. Follow best practices for commits.',
      source: 'builtin',
      enabled: true,
      tags: ['git', 'version-control'],
      triggers: {
        keywords: ['commit', 'git commit', 'save changes'],
        patterns: ['\\bcommit\\b', '\\bgit\\s+add\\b'],
        confidenceThreshold: 0.6,
      },
    },
    {
      name: 'pr',
      description: 'Pull request creation and management workflow',
      version: '1.0.0',
      author: 'fosscode',
      instructions: 'You are helping create a pull request. Follow best practices.',
      source: 'builtin',
      enabled: true,
      tags: ['git', 'github'],
      triggers: {
        keywords: ['pull request', 'pr', 'merge request'],
        confidenceThreshold: 0.6,
      },
    },
    {
      name: 'test',
      description: 'Run and fix tests workflow',
      version: '1.0.0',
      author: 'fosscode',
      instructions: 'You are helping with running and fixing tests.',
      source: 'builtin',
      enabled: true,
      tags: ['testing'],
      triggers: {
        keywords: ['test', 'tests', 'run tests', 'fix tests'],
        confidenceThreshold: 0.5,
      },
    },
    {
      name: 'refactor',
      description: 'Code refactoring guidelines',
      version: '1.0.0',
      author: 'fosscode',
      instructions: 'You are helping with code refactoring.',
      source: 'builtin',
      enabled: true,
      tags: ['refactoring'],
      triggers: {
        keywords: ['refactor', 'clean up', 'improve code'],
        confidenceThreshold: 0.6,
      },
    },
    {
      name: 'debug',
      description: 'Debugging workflow and troubleshooting',
      version: '1.0.0',
      author: 'fosscode',
      instructions: 'You are helping debug an issue.',
      source: 'builtin',
      enabled: true,
      tags: ['debugging'],
      triggers: {
        keywords: ['debug', 'error', 'bug', 'fix', 'not working'],
        patterns: ['\\bdebug\\b', '\\berror\\b'],
        confidenceThreshold: 0.5,
      },
    },
  ],
}));

describe('Skills Integration Tests', () => {
  let skillManager: SkillManager;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSkillManager();
    skillManager = new SkillManager({
      userSkillsDir: '/tmp/test-skills-integration',
      autoSelectEnabled: true,
      maxAutoSelectSkills: 3,
      minConfidenceThreshold: 0.5,
    });
  });

  describe('Complete Skill Invocation Flow', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should parse and invoke $commit skill', async () => {
      const input = '$commit please commit these changes with a good message';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('commit');
      expect(result.cleanedMessage).toBe('please commit these changes with a good message');
      expect(result.combinedInstructions).toContain('git commit workflow');
    });

    it('should parse and invoke $pr skill', async () => {
      const input = '$pr create a pull request for the auth feature';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('pr');
      expect(result.cleanedMessage).toBe('create a pull request for the auth feature');
      expect(result.combinedInstructions).toContain('pull request');
    });

    it('should parse and invoke $test skill', async () => {
      const input = '$test run all the tests and fix any failures';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('test');
      expect(result.cleanedMessage).toBe('run all the tests and fix any failures');
    });

    it('should parse and invoke $refactor skill', async () => {
      const input = '$refactor clean up the authentication module';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('refactor');
      expect(result.cleanedMessage).toBe('clean up the authentication module');
    });

    it('should parse and invoke $debug skill', async () => {
      const input = '$debug there is an error when logging in';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('debug');
      expect(result.cleanedMessage).toBe('there is an error when logging in');
    });

    it('should invoke multiple skills in one message', async () => {
      const input = '$commit $test commit these changes and run tests';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('commit');
      expect(result.invokedSkills).toContain('test');
      expect(result.cleanedMessage).toBe('commit these changes and run tests');
      expect(result.combinedInstructions).toContain('## Skill: commit');
      expect(result.combinedInstructions).toContain('## Skill: test');
    });
  });

  describe('Auto-Skill Selection', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should auto-select debug skill for error messages', async () => {
      const input = 'I have an error in my code that needs debugging';
      const result = skillManager.parseInput(input);

      expect(result.autoSelectedSkills.length).toBeGreaterThan(0);
      expect(result.autoSelectedSkills).toContain('debug');
    });

    it('should auto-select test skill for test-related messages', async () => {
      const input = 'I need to run tests and fix the failing ones';
      const result = skillManager.parseInput(input);

      expect(result.autoSelectedSkills.length).toBeGreaterThan(0);
      expect(result.autoSelectedSkills).toContain('test');
    });

    it('should auto-select commit skill for commit-related messages', async () => {
      // Use multiple keywords to meet confidence threshold
      const input = 'I want to git commit my changes and save them';
      const result = skillManager.parseInput(input);

      expect(result.autoSelectedSkills.length).toBeGreaterThan(0);
      expect(result.autoSelectedSkills).toContain('commit');
    });

    it('should not auto-select when explicit skill is invoked', async () => {
      const input = '$commit commit these changes';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('commit');
      expect(result.autoSelectedSkills.length).toBe(0);
    });

    it('should limit auto-selected skills to maxAutoSelectSkills', async () => {
      const input = 'I need to debug an error, run tests, commit, and create a PR';
      const result = skillManager.parseInput(input);

      expect(result.autoSelectedSkills.length).toBeLessThanOrEqual(3);
    });

    it('should not auto-select disabled skills', async () => {
      await skillManager.disableSkill('debug');
      const input = 'I have an error that needs debugging';
      const result = skillManager.parseInput(input);

      expect(result.autoSelectedSkills).not.toContain('debug');
    });
  });

  describe('User Skill Creation and Management', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should create, invoke, and delete user skill', async () => {
      // Create skill
      const skillData: SkillFile = {
        name: 'deploy',
        description: 'Deployment workflow',
        version: '1.0.0',
        instructions: 'You are helping with deployment.',
        triggers: {
          keywords: ['deploy', 'deployment'],
          confidenceThreshold: 0.6,
        },
      };

      const skill = await skillManager.createSkill(skillData);
      expect(skill.name).toBe('deploy');

      // Invoke skill
      const input = '$deploy deploy to production';
      const result = skillManager.parseInput(input);

      expect(result.invokedSkills).toContain('deploy');
      expect(result.combinedInstructions).toContain('deployment');

      // Delete skill
      await skillManager.deleteSkill('deploy');
      expect(skillManager.getSkill('deploy')).toBeUndefined();
    });

    it('should enable and disable user skill', async () => {
      const skillData: SkillFile = {
        name: 'custom',
        description: 'Custom skill',
        version: '1.0.0',
        instructions: 'Custom instructions',
      };

      await skillManager.createSkill(skillData);

      // Disable
      await skillManager.disableSkill('custom');
      let skill = skillManager.getSkill('custom');
      expect(skill?.enabled).toBe(false);

      // Skill should not be invokable when disabled
      const result = skillManager.parseInput('$custom do something');
      expect(result.invokedSkills).not.toContain('custom');

      // Enable
      await skillManager.enableSkill('custom');
      skill = skillManager.getSkill('custom');
      expect(skill?.enabled).toBe(true);
    });
  });

  describe('Skill Import/Export Flow', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should export and import skills correctly', async () => {
      // Create a user skill
      await skillManager.createSkill({
        name: 'export-test',
        description: 'Export test skill',
        version: '1.0.0',
        instructions: 'Export test instructions',
      });

      // Export
      const exportData = await skillManager.exportSkills(['export-test']);
      expect(exportData.skills.length).toBe(1);
      expect(exportData.skills[0].name).toBe('export-test');

      // Delete the skill
      await skillManager.deleteSkill('export-test');
      expect(skillManager.getSkill('export-test')).toBeUndefined();

      // Import
      const importResult = await skillManager.importSkills(exportData);
      expect(importResult.imported).toBe(1);
      expect(skillManager.getSkill('export-test')).toBeDefined();
    });

    it('should handle import with prefix option', async () => {
      const exportData: SkillExport = {
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        exportedFrom: 'fosscode',
        skills: [
          {
            name: 'prefixed',
            description: 'Prefixed skill',
            version: '1.0.0',
            instructions: 'Prefixed instructions',
          },
        ],
      };

      const result = await skillManager.importSkills(exportData, { prefix: 'team-' });

      expect(result.imported).toBe(1);
      expect(result.importedNames).toContain('team-prefixed');
      expect(skillManager.getSkill('team-prefixed')).toBeDefined();
    });
  });

  describe('Skill Instruction Injection', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should combine instructions with proper formatting', async () => {
      const input = '$commit $debug help with this';
      const result = skillManager.parseInput(input);

      // Should have separators between skills
      expect(result.combinedInstructions).toContain('## Skill: commit');
      expect(result.combinedInstructions).toContain('## Skill: debug');
      expect(result.combinedInstructions).toContain('---');
    });

    it('should include full instructions from skills', async () => {
      const input = '$commit help';
      const result = skillManager.parseInput(input);

      expect(result.combinedInstructions).toContain('git commit workflow');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should handle empty input', async () => {
      const result = skillManager.parseInput('');

      expect(result.invokedSkills).toEqual([]);
      expect(result.cleanedMessage).toBe('');
    });

    it('should handle input with only skill tokens', async () => {
      const result = skillManager.parseInput('$commit');

      expect(result.invokedSkills).toContain('commit');
      expect(result.cleanedMessage).toBe('');
    });

    it('should handle non-existent skill gracefully', async () => {
      const result = skillManager.parseInput('$nonexistent do something');

      expect(result.invokedSkills).not.toContain('nonexistent');
      expect(result.cleanedMessage).toContain('$nonexistent');
    });

    it('should handle skill-like text in quotes', async () => {
      const result = skillManager.parseInput('The variable is named $commit');

      // Should still detect as skill since it matches
      expect(result.invokedSkills).toContain('commit');
    });

    it('should handle multiple spaces between skills', async () => {
      const result = skillManager.parseInput('$commit    $test    message');

      expect(result.invokedSkills).toContain('commit');
      expect(result.invokedSkills).toContain('test');
      expect(result.cleanedMessage).toBe('message');
    });
  });

  describe('Singleton Instance', () => {
    beforeEach(() => {
      resetSkillManager();
    });

    it('should return the same instance from getSkillManager', () => {
      const instance1 = getSkillManager();
      const instance2 = getSkillManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance correctly', () => {
      const instance1 = getSkillManager();
      resetSkillManager();
      const instance2 = getSkillManager();

      expect(instance1).not.toBe(instance2);
    });
  });
});
