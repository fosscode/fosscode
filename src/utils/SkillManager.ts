/**
 * SkillManager - Manages skill definitions, loading, and invocation
 *
 * Skills are reusable instruction bundles that can be:
 * - Explicitly invoked via $skill-name syntax
 * - Auto-selected based on prompt analysis
 * - Stored as YAML/JSON files in user config or built-in directories
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  Skill,
  SkillFile,
  SkillParseResult,
  SkillMatch,
  SkillExport,
  SkillImportOptions,
  SkillImportResult,
  SkillManagerConfig,
} from '../types/skills.js';

// Built-in skills are defined inline for easier bundling
import { getBuiltinSkills } from '../skills/index.js';

/**
 * Default configuration for SkillManager
 */
const DEFAULT_CONFIG: SkillManagerConfig = {
  autoSelectEnabled: true,
  maxAutoSelectSkills: 3,
  minConfidenceThreshold: 0.5,
  userSkillsDir: path.join(os.homedir(), '.config', 'fosscode', 'skills'),
};

/**
 * Regex pattern to match $skill-name syntax in user input
 * Matches: $skill-name, $skill_name, $skillName
 */
const SKILL_INVOCATION_PATTERN = /\$([a-zA-Z][a-zA-Z0-9_-]*)/g;

export class SkillManager {
  private skills: Map<string, Skill> = new Map();
  private config: SkillManagerConfig;
  private initialized: boolean = false;

  constructor(config: Partial<SkillManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the skill manager by loading built-in and user skills
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load built-in skills first
    await this.loadBuiltinSkills();

    // Then load user skills (which can override built-ins)
    await this.loadUserSkills();

    this.initialized = true;
  }

  /**
   * Load built-in skills from the skills directory
   */
  private async loadBuiltinSkills(): Promise<void> {
    const builtinSkills = getBuiltinSkills();
    for (const skill of builtinSkills) {
      this.skills.set(skill.name, { ...skill, source: 'builtin' });
    }
  }

  /**
   * Load user-defined skills from ~/.config/fosscode/skills/
   */
  private async loadUserSkills(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.config.userSkillsDir, { recursive: true });

      const files = await fs.readdir(this.config.userSkillsDir);
      const skillFiles = files.filter(
        f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
      );

      for (const file of skillFiles) {
        try {
          const filePath = path.join(this.config.userSkillsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const skillData = this.parseSkillFile(content, file);

          if (skillData) {
            const skill: Skill = {
              ...skillData,
              source: 'user',
              filePath,
              enabled: skillData.enabled ?? true,
            };
            this.skills.set(skill.name, skill);
          }
        } catch (error) {
          console.error(`Failed to load skill from ${file}:`, error);
        }
      }
    } catch (error) {
      // Directory might not exist yet, that's OK
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load user skills:', error);
      }
    }
  }

  /**
   * Parse a skill file (YAML or JSON)
   */
  private parseSkillFile(content: string, filename: string): SkillFile | null {
    try {
      if (filename.endsWith('.json')) {
        return JSON.parse(content) as SkillFile;
      } else {
        // Simple YAML parser for skill files
        return this.parseYaml(content);
      }
    } catch (error) {
      console.error(`Failed to parse skill file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Simple YAML parser for skill files
   * Supports basic YAML structure without external dependencies
   */
  private parseYaml(content: string): SkillFile {
    const result: Record<string, any> = {};
    const lines = content.split('\n');
    let currentKey: string | null = null;
    let multilineValue: string[] = [];
    let inMultiline = false;
    let multilineIndent = 0;

    for (const line of lines) {
      // Skip comments and empty lines at the top level
      if (line.trim().startsWith('#') || (line.trim() === '' && !inMultiline)) {
        continue;
      }

      // Handle multiline strings (literal block scalar |)
      if (inMultiline) {
        const currentIndent = line.search(/\S|$/);
        if (line.trim() === '' || currentIndent > multilineIndent) {
          multilineValue.push(line.slice(multilineIndent) || '');
          continue;
        } else {
          // End of multiline block
          if (currentKey) {
            result[currentKey] = multilineValue.join('\n').trimEnd();
          }
          inMultiline = false;
          multilineValue = [];
        }
      }

      // Parse key-value pairs
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();

        if (value === '|' || value === '|-') {
          // Start multiline string
          currentKey = key;
          inMultiline = true;
          multilineIndent = line.search(/\S|$/) + 2; // Standard YAML indentation
          multilineValue = [];
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array
          result[key] = value
            .slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(s => s);
        } else if (value === '') {
          // Could be a nested object or array, skip for now
          result[key] = {};
        } else {
          // Regular string value (remove quotes if present)
          result[key] = value.replace(/^['"]|['"]$/g, '');
        }
      }
    }

    // Handle any remaining multiline content
    if (inMultiline && currentKey) {
      result[currentKey] = multilineValue.join('\n').trimEnd();
    }

    return result as SkillFile;
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * List all available skills
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * List enabled skills only
   */
  listEnabledSkills(): Skill[] {
    return this.listSkills().filter(s => s.enabled !== false);
  }

  /**
   * Parse user input for skill invocations ($skill-name)
   * and auto-select skills based on prompt content
   */
  parseInput(input: string): SkillParseResult {
    const invokedSkills: string[] = [];
    let cleanedMessage = input;

    // Find explicit skill invocations ($skill-name)
    const matches = input.matchAll(SKILL_INVOCATION_PATTERN);
    for (const match of matches) {
      const skillName = match[1];
      const skill = this.skills.get(skillName);
      // Only invoke enabled skills
      if (skill && skill.enabled !== false) {
        invokedSkills.push(skillName);
        // Remove the skill token from the message
        cleanedMessage = cleanedMessage.replace(match[0], '').trim();
      }
    }

    // Clean up extra whitespace
    cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();

    // Auto-select skills based on prompt analysis
    const autoSelectedSkills: string[] = [];
    if (this.config.autoSelectEnabled && invokedSkills.length === 0) {
      const autoMatches = this.findAutoSkills(cleanedMessage);
      for (const match of autoMatches) {
        if (!invokedSkills.includes(match.skill.name)) {
          autoSelectedSkills.push(match.skill.name);
          if (autoSelectedSkills.length >= this.config.maxAutoSelectSkills) {
            break;
          }
        }
      }
    }

    // Combine instructions from all matched skills
    const allSkillNames = [...invokedSkills, ...autoSelectedSkills];
    const combinedInstructions = this.combineSkillInstructions(allSkillNames);

    return {
      invokedSkills,
      autoSelectedSkills,
      cleanedMessage,
      combinedInstructions,
    };
  }

  /**
   * Find skills that should be auto-selected based on prompt content
   */
  private findAutoSkills(input: string): SkillMatch[] {
    const matches: SkillMatch[] = [];
    const lowercaseInput = input.toLowerCase();

    for (const skill of this.listEnabledSkills()) {
      if (!skill.triggers) continue;

      let confidence = 0;
      const matchedKeywords: string[] = [];
      const matchedPatterns: string[] = [];

      // Check keywords
      if (skill.triggers.keywords) {
        for (const keyword of skill.triggers.keywords) {
          if (lowercaseInput.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword);
            confidence += 0.2; // Each keyword adds confidence
          }
        }
      }

      // Check regex patterns
      if (skill.triggers.patterns) {
        for (const pattern of skill.triggers.patterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(input)) {
              matchedPatterns.push(pattern);
              confidence += 0.3; // Patterns add more confidence
            }
          } catch {
            // Invalid regex, skip
          }
        }
      }

      // Cap confidence at 1.0
      confidence = Math.min(confidence, 1.0);

      // Check against threshold
      const threshold = skill.triggers.confidenceThreshold ?? this.config.minConfidenceThreshold;
      if (confidence >= threshold) {
        matches.push({
          skill,
          confidence,
          matchedKeywords,
          matchedPatterns,
        });
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Combine instructions from multiple skills
   */
  private combineSkillInstructions(skillNames: string[]): string {
    const instructions: string[] = [];

    for (const name of skillNames) {
      const skill = this.skills.get(name);
      if (skill && skill.enabled !== false) {
        instructions.push(`## Skill: ${skill.name}\n${skill.instructions}`);
      }
    }

    return instructions.join('\n\n---\n\n');
  }

  /**
   * Enable a skill by name
   */
  async enableSkill(name: string): Promise<boolean> {
    const skill = this.skills.get(name);
    if (!skill) return false;

    skill.enabled = true;

    // Persist for user skills
    if (skill.source === 'user' && skill.filePath) {
      await this.saveSkillFile(skill);
    }

    return true;
  }

  /**
   * Disable a skill by name
   */
  async disableSkill(name: string): Promise<boolean> {
    const skill = this.skills.get(name);
    if (!skill) return false;

    skill.enabled = false;

    // Persist for user skills
    if (skill.source === 'user' && skill.filePath) {
      await this.saveSkillFile(skill);
    }

    return true;
  }

  /**
   * Create a new user skill
   */
  async createSkill(skillData: SkillFile): Promise<Skill> {
    const skill: Skill = {
      ...skillData,
      source: 'user',
      enabled: skillData.enabled ?? true,
    };

    // Generate file path
    const filename = `${skill.name}.yaml`;
    const filePath = path.join(this.config.userSkillsDir, filename);
    skill.filePath = filePath;

    // Ensure directory exists
    await fs.mkdir(this.config.userSkillsDir, { recursive: true });

    // Save skill file
    await this.saveSkillFile(skill);

    // Add to registry
    this.skills.set(skill.name, skill);

    return skill;
  }

  /**
   * Delete a user skill
   */
  async deleteSkill(name: string): Promise<boolean> {
    const skill = this.skills.get(name);
    if (!skill) return false;

    // Cannot delete built-in skills
    if (skill.source === 'builtin') {
      throw new Error('Cannot delete built-in skills. Use disableSkill() instead.');
    }

    // Delete file
    if (skill.filePath) {
      await fs.unlink(skill.filePath);
    }

    // Remove from registry
    this.skills.delete(name);

    return true;
  }

  /**
   * Save a skill to its file
   */
  private async saveSkillFile(skill: Skill): Promise<void> {
    if (!skill.filePath) return;

    const content = this.formatSkillAsYaml(skill);
    await fs.writeFile(skill.filePath, content, 'utf-8');
  }

  /**
   * Format a skill as YAML content
   */
  private formatSkillAsYaml(skill: Skill): string {
    let yaml = `# ${skill.description}\n`;
    yaml += `name: ${skill.name}\n`;
    yaml += `description: "${skill.description}"\n`;
    yaml += `version: "${skill.version}"\n`;

    if (skill.author) {
      yaml += `author: "${skill.author}"\n`;
    }

    if (skill.tags && skill.tags.length > 0) {
      yaml += `tags: [${skill.tags.map(t => `"${t}"`).join(', ')}]\n`;
    }

    if (skill.enabled !== undefined) {
      yaml += `enabled: ${skill.enabled}\n`;
    }

    // Instructions as multiline
    yaml += `instructions: |\n`;
    const instructionLines = skill.instructions.split('\n');
    for (const line of instructionLines) {
      yaml += `  ${line}\n`;
    }

    // Triggers
    if (skill.triggers) {
      yaml += `triggers:\n`;
      if (skill.triggers.keywords && skill.triggers.keywords.length > 0) {
        yaml += `  keywords: [${skill.triggers.keywords.map(k => `"${k}"`).join(', ')}]\n`;
      }
      if (skill.triggers.patterns && skill.triggers.patterns.length > 0) {
        yaml += `  patterns: [${skill.triggers.patterns.map(p => `"${p}"`).join(', ')}]\n`;
      }
      if (skill.triggers.confidenceThreshold !== undefined) {
        yaml += `  confidenceThreshold: ${skill.triggers.confidenceThreshold}\n`;
      }
    }

    return yaml;
  }

  /**
   * Export skills to a portable format
   */
  async exportSkills(skillNames?: string[]): Promise<SkillExport> {
    const skills: SkillFile[] = [];

    const targetSkills = skillNames
      ? skillNames.map(n => this.skills.get(n)).filter((s): s is Skill => s !== undefined)
      : this.listSkills();

    for (const skill of targetSkills) {
      const skillFile: SkillFile = {
        name: skill.name,
        description: skill.description,
        version: skill.version,
        instructions: skill.instructions,
      };

      // Only add optional properties if they are defined
      if (skill.author !== undefined) {
        skillFile.author = skill.author;
      }
      if (skill.scripts !== undefined) {
        skillFile.scripts = skill.scripts;
      }
      if (skill.triggers !== undefined) {
        skillFile.triggers = skill.triggers;
      }
      if (skill.tags !== undefined) {
        skillFile.tags = skill.tags;
      }
      if (skill.enabled !== undefined) {
        skillFile.enabled = skill.enabled;
      }

      skills.push(skillFile);
    }

    return {
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),
      exportedFrom: 'fosscode',
      skills,
    };
  }

  /**
   * Import skills from exported format
   */
  async importSkills(
    exportData: SkillExport,
    options: SkillImportOptions = {}
  ): Promise<SkillImportResult> {
    const result: SkillImportResult = {
      imported: 0,
      skipped: 0,
      importedNames: [],
      skippedNames: [],
      errors: [],
    };

    for (const skillData of exportData.skills) {
      try {
        let name = skillData.name;

        // Add prefix if specified
        if (options.prefix) {
          name = `${options.prefix}${name}`;
        }

        // Check for existing skill
        if (this.skills.has(name)) {
          if (!options.overwrite) {
            result.skipped++;
            result.skippedNames.push(name);
            continue;
          }
          // Delete existing skill before overwriting
          if (this.skills.get(name)?.source === 'user') {
            await this.deleteSkill(name);
          }
        }

        // Create the skill
        await this.createSkill({
          ...skillData,
          name,
          enabled: options.enable ?? skillData.enabled ?? true,
        });

        result.imported++;
        result.importedNames.push(name);
      } catch (error) {
        result.errors.push(
          `Failed to import ${skillData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return result;
  }

  /**
   * Reload skills from disk
   */
  async reload(): Promise<void> {
    this.skills.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get the user skills directory path
   */
  getUserSkillsDir(): string {
    return this.config.userSkillsDir;
  }

  /**
   * Update skill manager configuration
   */
  updateConfig(config: Partial<SkillManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SkillManagerConfig {
    return { ...this.config };
  }
}

// Singleton instance for global access
let skillManagerInstance: SkillManager | null = null;

export function getSkillManager(): SkillManager {
  if (!skillManagerInstance) {
    skillManagerInstance = new SkillManager();
  }
  return skillManagerInstance;
}

export function resetSkillManager(): void {
  skillManagerInstance = null;
}
