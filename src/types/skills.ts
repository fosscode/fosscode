/**
 * Skill System Types
 *
 * Defines the schema and types for reusable instruction bundles (skills)
 * that can be invoked via $skill-name syntax or auto-selected based on prompts.
 */

/**
 * Trigger configuration for auto-skill selection
 */
export interface SkillTrigger {
  /** Keywords that trigger this skill */
  keywords: string[];
  /** Regex patterns to match against user input */
  patterns?: string[];
  /** Minimum confidence score (0-1) required to auto-select this skill */
  confidenceThreshold?: number;
}

/**
 * Optional script that can be run before or after skill execution
 */
export interface SkillScript {
  /** Script identifier */
  name: string;
  /** Shell command or inline script */
  command: string;
  /** When to run: before injecting instructions, after response, or on-demand */
  timing: 'before' | 'after' | 'on-demand';
  /** Optional working directory */
  workingDirectory?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Core skill definition schema
 */
export interface Skill {
  /** Unique skill name (used in $skill-name invocation) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Version string for compatibility tracking */
  version: string;
  /** Author information */
  author?: string;
  /** Detailed instructions injected into the system prompt */
  instructions: string;
  /** Optional setup/teardown scripts */
  scripts?: SkillScript[];
  /** Auto-selection trigger configuration */
  triggers?: SkillTrigger;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** Whether this skill is enabled */
  enabled?: boolean;
  /** Source of the skill: built-in or user-defined */
  source: 'builtin' | 'user';
  /** File path where the skill is stored (for user skills) */
  filePath?: string;
}

/**
 * Skill file format (YAML/JSON structure)
 */
export interface SkillFile {
  name: string;
  description: string;
  version: string;
  author?: string;
  instructions: string;
  scripts?: SkillScript[];
  triggers?: SkillTrigger;
  tags?: string[];
  enabled?: boolean;
}

/**
 * Result of parsing user input for skill invocations
 */
export interface SkillParseResult {
  /** Skills explicitly invoked via $skill-name syntax */
  invokedSkills: string[];
  /** Skills auto-selected based on prompt analysis */
  autoSelectedSkills: string[];
  /** The user message with skill tokens removed */
  cleanedMessage: string;
  /** Combined instructions from all matched skills */
  combinedInstructions: string;
}

/**
 * Skill match result with confidence score
 */
export interface SkillMatch {
  skill: Skill;
  confidence: number;
  matchedKeywords: string[];
  matchedPatterns: string[];
}

/**
 * Skill export format for sharing
 */
export interface SkillExport {
  /** Export format version */
  formatVersion: '1.0';
  /** Export timestamp */
  exportedAt: string;
  /** Source application and version */
  exportedFrom: string;
  /** Array of skills to export */
  skills: SkillFile[];
}

/**
 * Options for skill import
 */
export interface SkillImportOptions {
  /** Overwrite existing skills with same name */
  overwrite?: boolean;
  /** Prefix to add to imported skill names to avoid conflicts */
  prefix?: string;
  /** Enable imported skills immediately */
  enable?: boolean;
}

/**
 * Result of skill import operation
 */
export interface SkillImportResult {
  /** Number of skills successfully imported */
  imported: number;
  /** Number of skills skipped (e.g., already exist) */
  skipped: number;
  /** Names of imported skills */
  importedNames: string[];
  /** Names of skipped skills */
  skippedNames: string[];
  /** Any errors encountered */
  errors: string[];
}

/**
 * Skill manager configuration
 */
export interface SkillManagerConfig {
  /** Enable auto-skill selection */
  autoSelectEnabled: boolean;
  /** Maximum number of auto-selected skills per prompt */
  maxAutoSelectSkills: number;
  /** Minimum confidence threshold for auto-selection */
  minConfidenceThreshold: number;
  /** User skills directory path */
  userSkillsDir: string;
}
