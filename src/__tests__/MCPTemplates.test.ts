import {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  searchTemplates,
  getTemplateCategories,
  validateTemplateEnvVars,
  serverTemplates,
} from '../mcp/templates/index.js';

describe('MCP Templates', () => {
  describe('getAllTemplates', () => {
    it('should return all templates', () => {
      const templates = getAllTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toEqual(serverTemplates);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates for filesystem category', () => {
      const templates = getTemplatesByCategory('filesystem');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === 'filesystem')).toBe(true);
    });

    it('should return templates for git category', () => {
      const templates = getTemplatesByCategory('git');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === 'git')).toBe(true);
    });

    it('should return templates for database category', () => {
      const templates = getTemplatesByCategory('database');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === 'database')).toBe(true);
    });

    it('should return templates for api category', () => {
      const templates = getTemplatesByCategory('api');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === 'api')).toBe(true);
    });

    it('should return templates for utility category', () => {
      const templates = getTemplatesByCategory('utility');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === 'utility')).toBe(true);
    });

    it('should return empty array for custom category with no templates', () => {
      const templates = getTemplatesByCategory('custom');
      expect(templates).toEqual([]);
    });
  });

  describe('getTemplateById', () => {
    it('should return template by id', () => {
      const template = getTemplateById('filesystem-local');
      expect(template).toBeDefined();
      expect(template?.id).toBe('filesystem-local');
      expect(template?.name).toBe('Local Filesystem');
    });

    it('should return undefined for unknown id', () => {
      const template = getTemplateById('unknown-template');
      expect(template).toBeUndefined();
    });

    it('should return git template', () => {
      const template = getTemplateById('git');
      expect(template).toBeDefined();
      expect(template?.category).toBe('git');
    });

    it('should return github template', () => {
      const template = getTemplateById('github');
      expect(template).toBeDefined();
      expect(template?.requiredEnvVars).toContain('GITHUB_TOKEN');
    });
  });

  describe('searchTemplates', () => {
    it('should find templates by name', () => {
      const results = searchTemplates('filesystem');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.name.toLowerCase().includes('filesystem'))).toBe(true);
    });

    it('should find templates by description', () => {
      const results = searchTemplates('database');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find templates by id', () => {
      const results = searchTemplates('sqlite');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.id === 'sqlite')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results1 = searchTemplates('git');
      const results2 = searchTemplates('GIT');
      expect(results1.length).toBe(results2.length);
    });

    it('should return empty array for no matches', () => {
      const results = searchTemplates('zzzznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('getTemplateCategories', () => {
    it('should return all categories', () => {
      const categories = getTemplateCategories();
      expect(categories).toContain('filesystem');
      expect(categories).toContain('git');
      expect(categories).toContain('database');
      expect(categories).toContain('api');
      expect(categories).toContain('utility');
      expect(categories).toContain('custom');
    });
  });

  describe('validateTemplateEnvVars', () => {
    it('should return valid for template without required env vars', () => {
      const template = getTemplateById('filesystem-local');
      expect(template).toBeDefined();
      const result = validateTemplateEnvVars(template!);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return missing env vars for templates that require them', () => {
      const template = getTemplateById('github');
      expect(template).toBeDefined();

      // Clear any existing env var
      const originalValue = process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_TOKEN;

      const result = validateTemplateEnvVars(template!);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('GITHUB_TOKEN');

      // Restore
      if (originalValue) {
        process.env.GITHUB_TOKEN = originalValue;
      }
    });

    it('should return valid when required env vars are set', () => {
      const template = getTemplateById('github');
      expect(template).toBeDefined();

      // Set the required env var
      const originalValue = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'test-token';

      const result = validateTemplateEnvVars(template!);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);

      // Restore
      if (originalValue) {
        process.env.GITHUB_TOKEN = originalValue;
      } else {
        delete process.env.GITHUB_TOKEN;
      }
    });
  });

  describe('template structure', () => {
    it('all templates should have required fields', () => {
      const templates = getAllTemplates();
      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.command).toBeDefined();
      }
    });

    it('all templates should have valid categories', () => {
      const templates = getAllTemplates();
      const validCategories = getTemplateCategories();
      for (const template of templates) {
        expect(validCategories).toContain(template.category);
      }
    });

    it('all templates should have unique ids', () => {
      const templates = getAllTemplates();
      const ids = templates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('templates with requiredEnvVars should have them as array', () => {
      const templates = getAllTemplates();
      for (const template of templates) {
        if (template.requiredEnvVars) {
          expect(Array.isArray(template.requiredEnvVars)).toBe(true);
        }
      }
    });
  });

  describe('specific templates', () => {
    it('should have filesystem-local template', () => {
      const template = getTemplateById('filesystem-local');
      expect(template).toBeDefined();
      expect(template?.command).toBe('npx');
      expect(template?.args).toContain('-y');
    });

    it('should have git template with documentation', () => {
      const template = getTemplateById('git');
      expect(template).toBeDefined();
      expect(template?.documentation).toBeDefined();
      expect(template?.documentation).toContain('git_status');
    });

    it('should have sqlite template with required env vars', () => {
      const template = getTemplateById('sqlite');
      expect(template).toBeDefined();
      expect(template?.requiredEnvVars).toContain('SQLITE_DB_PATH');
    });

    it('should have time template in utility category', () => {
      const template = getTemplateById('time');
      expect(template).toBeDefined();
      expect(template?.category).toBe('utility');
    });

    it('should have memory template with documentation', () => {
      const template = getTemplateById('memory');
      expect(template).toBeDefined();
      expect(template?.documentation).toContain('knowledge graph');
    });
  });
});
