import { SkillManager, resetSkillManager } from '../utils/SkillManager';
import { SkillFile, SkillExport } from '../types/skills';
import { promises as fs } from 'fs';

// Mock fs module
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

// Mock the builtin skills
jest.mock('../skills/index.js', () => ({
  getBuiltinSkills: () => [
    {
      name: 'commit',
      description: 'Git commit workflow',
      version: '1.0.0',
      instructions: 'Commit workflow instructions',
      source: 'builtin',
      enabled: true,
      triggers: {
        keywords: ['commit', 'git commit'],
        confidenceThreshold: 0.6,
      },
    },
    {
      name: 'debug',
      description: 'Debugging workflow',
      version: '1.0.0',
      instructions: 'Debug workflow instructions',
      source: 'builtin',
      enabled: true,
      triggers: {
        keywords: ['debug', 'error', 'bug'],
        confidenceThreshold: 0.5,
      },
    },
  ],
}));

describe('SkillManager', () => {
  let skillManager: SkillManager;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSkillManager();
    skillManager = new SkillManager({
      userSkillsDir: '/tmp/test-skills',
    });
  });

  describe('initialization', () => {
    it('should initialize and load built-in skills', async () => {
      await skillManager.initialize();

      const skills = skillManager.listSkills();
      expect(skills.length).toBeGreaterThanOrEqual(2);
      expect(skills.some(s => s.name === 'commit')).toBe(true);
      expect(skills.some(s => s.name === 'debug')).toBe(true);
    });

    it('should only initialize once', async () => {
      await skillManager.initialize();
      await skillManager.initialize();

      // Should not throw and skills should still be loaded
      const skills = skillManager.listSkills();
      expect(skills.length).toBeGreaterThanOrEqual(2);
    });

    it('should create user skills directory if it does not exist', async () => {
      await skillManager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith('/tmp/test-skills', { recursive: true });
    });
  });

  describe('getSkill', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should return a skill by name', () => {
      const skill = skillManager.getSkill('commit');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('commit');
      expect(skill?.description).toBe('Git commit workflow');
    });

    it('should return undefined for non-existent skill', () => {
      const skill = skillManager.getSkill('non-existent');

      expect(skill).toBeUndefined();
    });
  });

  describe('listSkills', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should list all skills', () => {
      const skills = skillManager.listSkills();

      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThanOrEqual(2);
    });

    it('should return skills with required properties', () => {
      const skills = skillManager.listSkills();

      for (const skill of skills) {
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('description');
        expect(skill).toHaveProperty('version');
        expect(skill).toHaveProperty('instructions');
        expect(skill).toHaveProperty('source');
      }
    });
  });

  describe('listEnabledSkills', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should list only enabled skills', () => {
      const enabledSkills = skillManager.listEnabledSkills();

      for (const skill of enabledSkills) {
        expect(skill.enabled).not.toBe(false);
      }
    });
  });

  describe('parseInput', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should parse $skill-name syntax', () => {
      const result = skillManager.parseInput('$commit please commit the changes');

      expect(result.invokedSkills).toContain('commit');
      expect(result.cleanedMessage).toBe('please commit the changes');
    });

    it('should parse multiple skill invocations', () => {
      const result = skillManager.parseInput('$commit $debug please help');

      expect(result.invokedSkills).toContain('commit');
      expect(result.invokedSkills).toContain('debug');
      expect(result.cleanedMessage).toBe('please help');
    });

    it('should ignore non-existent skills', () => {
      const result = skillManager.parseInput('$nonexistent please help');

      expect(result.invokedSkills).not.toContain('nonexistent');
      expect(result.cleanedMessage).toContain('$nonexistent');
    });

    it('should combine instructions from invoked skills', () => {
      const result = skillManager.parseInput('$commit please commit');

      expect(result.combinedInstructions).toContain('commit');
    });

    it('should auto-select skills based on keywords', () => {
      // Disable explicit invocation to test auto-selection
      // Use multiple keywords to ensure confidence threshold is met
      const result = skillManager.parseInput('I have a bug and error that needs debug');

      expect(result.autoSelectedSkills.length).toBeGreaterThan(0);
    });
  });

  describe('enableSkill / disableSkill', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should enable a skill', async () => {
      await skillManager.disableSkill('commit');
      const disabled = skillManager.getSkill('commit');
      expect(disabled?.enabled).toBe(false);

      await skillManager.enableSkill('commit');
      const enabled = skillManager.getSkill('commit');
      expect(enabled?.enabled).toBe(true);
    });

    it('should disable a skill', async () => {
      await skillManager.disableSkill('commit');

      const skill = skillManager.getSkill('commit');
      expect(skill?.enabled).toBe(false);
    });

    it('should return false for non-existent skill', async () => {
      const result = await skillManager.enableSkill('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('createSkill', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should create a new user skill', async () => {
      const skillData: SkillFile = {
        name: 'test-skill',
        description: 'Test skill',
        version: '1.0.0',
        instructions: 'Test instructions',
      };

      const skill = await skillManager.createSkill(skillData);

      expect(skill.name).toBe('test-skill');
      expect(skill.source).toBe('user');
      expect(skill.filePath).toBeDefined();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should set default values for optional fields', async () => {
      const skillData: SkillFile = {
        name: 'minimal-skill',
        description: 'Minimal skill',
        version: '1.0.0',
        instructions: 'Minimal instructions',
      };

      const skill = await skillManager.createSkill(skillData);

      expect(skill.enabled).toBe(true);
    });
  });

  describe('deleteSkill', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should not delete built-in skills', async () => {
      await expect(skillManager.deleteSkill('commit')).rejects.toThrow(
        'Cannot delete built-in skills'
      );
    });

    it('should return false for non-existent skill', async () => {
      const result = await skillManager.deleteSkill('non-existent');
      expect(result).toBe(false);
    });

    it('should delete user skills', async () => {
      // First create a user skill
      const skillData: SkillFile = {
        name: 'to-delete',
        description: 'Skill to delete',
        version: '1.0.0',
        instructions: 'Delete me',
      };
      await skillManager.createSkill(skillData);

      // Then delete it
      const result = await skillManager.deleteSkill('to-delete');

      expect(result).toBe(true);
      expect(skillManager.getSkill('to-delete')).toBeUndefined();
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe('exportSkills', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should export all skills', async () => {
      const exportData = await skillManager.exportSkills();

      expect(exportData.formatVersion).toBe('1.0');
      expect(exportData.exportedFrom).toBe('fosscode');
      expect(exportData.skills.length).toBeGreaterThanOrEqual(2);
    });

    it('should export specific skills', async () => {
      const exportData = await skillManager.exportSkills(['commit']);

      expect(exportData.skills.length).toBe(1);
      expect(exportData.skills[0].name).toBe('commit');
    });

    it('should include required fields in exported skills', async () => {
      const exportData = await skillManager.exportSkills(['commit']);
      const skill = exportData.skills[0];

      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('version');
      expect(skill).toHaveProperty('instructions');
    });
  });

  describe('importSkills', () => {
    beforeEach(async () => {
      await skillManager.initialize();
    });

    it('should import skills from export data', async () => {
      const exportData: SkillExport = {
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        exportedFrom: 'fosscode',
        skills: [
          {
            name: 'imported-skill',
            description: 'Imported skill',
            version: '1.0.0',
            instructions: 'Imported instructions',
          },
        ],
      };

      const result = await skillManager.importSkills(exportData);

      expect(result.imported).toBe(1);
      expect(result.importedNames).toContain('imported-skill');
      expect(skillManager.getSkill('imported-skill')).toBeDefined();
    });

    it('should skip existing skills without overwrite option', async () => {
      const exportData: SkillExport = {
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        exportedFrom: 'fosscode',
        skills: [
          {
            name: 'commit', // Already exists as built-in
            description: 'Duplicate skill',
            version: '1.0.0',
            instructions: 'Duplicate instructions',
          },
        ],
      };

      const result = await skillManager.importSkills(exportData);

      expect(result.skipped).toBe(1);
      expect(result.skippedNames).toContain('commit');
    });

    it('should add prefix to imported skills', async () => {
      const exportData: SkillExport = {
        formatVersion: '1.0',
        exportedAt: new Date().toISOString(),
        exportedFrom: 'fosscode',
        skills: [
          {
            name: 'test',
            description: 'Test skill',
            version: '1.0.0',
            instructions: 'Test instructions',
          },
        ],
      };

      const result = await skillManager.importSkills(exportData, { prefix: 'my-' });

      expect(result.imported).toBe(1);
      expect(result.importedNames).toContain('my-test');
      expect(skillManager.getSkill('my-test')).toBeDefined();
    });
  });

  describe('reload', () => {
    it('should reload skills from disk', async () => {
      await skillManager.initialize();
      const initialCount = skillManager.listSkills().length;

      await skillManager.reload();
      const afterReloadCount = skillManager.listSkills().length;

      expect(afterReloadCount).toBe(initialCount);
    });
  });

  describe('getUserSkillsDir', () => {
    it('should return the user skills directory path', () => {
      const dir = skillManager.getUserSkillsDir();

      expect(dir).toBe('/tmp/test-skills');
    });
  });

  describe('getConfig', () => {
    it('should return the current configuration', () => {
      const config = skillManager.getConfig();

      expect(config).toHaveProperty('autoSelectEnabled');
      expect(config).toHaveProperty('maxAutoSelectSkills');
      expect(config).toHaveProperty('minConfidenceThreshold');
      expect(config).toHaveProperty('userSkillsDir');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      skillManager.updateConfig({ autoSelectEnabled: false });

      const config = skillManager.getConfig();
      expect(config.autoSelectEnabled).toBe(false);
    });
  });

  describe('YAML parsing', () => {
    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue(['test.yaml'] as any);
      mockFs.readFile.mockResolvedValue(`
name: yaml-skill
description: "YAML skill"
version: "1.0.0"
instructions: |
  These are
  multiline
  instructions
tags: ["test", "yaml"]
`);
    });

    it('should parse YAML skill files', async () => {
      await skillManager.initialize();

      const skill = skillManager.getSkill('yaml-skill');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('yaml-skill');
      expect(skill?.description).toBe('YAML skill');
    });
  });

  describe('JSON parsing', () => {
    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue(['test.json'] as any);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          name: 'json-skill',
          description: 'JSON skill',
          version: '1.0.0',
          instructions: 'JSON instructions',
        })
      );
    });

    it('should parse JSON skill files', async () => {
      await skillManager.initialize();

      const skill = skillManager.getSkill('json-skill');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('json-skill');
      expect(skill?.description).toBe('JSON skill');
    });
  });
});
