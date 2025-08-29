import * as fs from 'fs';
import * as path from 'path';
import { ToolParameter, ToolResult } from '../types/index.js';

/**
 * Tool Utilities
 * Common helper functions and utilities for tool development
 * Provides shared patterns, validation, and formatting utilities
 */
export class ToolUtilities {
  /**
   * Validate required parameters
   */
  static validateRequiredParams(
    params: Record<string, any>,
    requiredParams: string[]
  ): {
    valid: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    for (const param of requiredParams) {
      if (!(param in params) || params[param] === null || params[param] === undefined) {
        missing.push(param);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Validate parameter types
   */
  static validateParamTypes(
    params: Record<string, any>,
    paramDefinitions: ToolParameter[]
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const def of paramDefinitions) {
      const value = params[def.name];

      // Skip validation if parameter is not provided and not required
      if (value === undefined && !def.required) {
        continue;
      }

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== def.type) {
        errors.push(
          `Parameter '${def.name}' should be of type '${def.type}' but got '${actualType}'`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply default values to parameters
   */
  static applyDefaults(
    params: Record<string, any>,
    paramDefinitions: ToolParameter[]
  ): Record<string, any> {
    const result = { ...params };

    for (const def of paramDefinitions) {
      if (!(def.name in result) && def.defaultValue !== undefined) {
        result[def.name] = def.defaultValue;
      }
    }

    return result;
  }

  /**
   * Sanitize file paths for security
   */
  static sanitizePath(inputPath: string): string {
    // Remove any path traversal attempts
    const normalized = path.normalize(inputPath).replace(/^(\.\.[/\\])+/, '');

    // Normalize path separators to forward slashes for consistent behavior
    const sanitized = normalized.replace(/\\/g, '/');

    // Define system directories for both Unix and Windows
    const systemDirs = [
      '/etc',
      '/bin',
      '/usr',
      '/sys',
      '/proc',
      '/dev',
      'C:/Windows',
      'C:/Program Files',
      'C:/Program Files (x86)',
      '/System',
      '/Library',
      '/usr/local',
    ];

    // Check if path starts with any system directory
    for (const dir of systemDirs) {
      if (sanitized.startsWith(dir)) {
        throw new Error('Access to system directories is not allowed');
      }
    }

    return sanitized;
  }

  /**
   * Check if a file path is safe to access
   */
  static isPathSafe(filePath: string, allowedExtensions: string[] = []): boolean {
    try {
      // Check if path contains suspicious patterns before sanitizing
      const suspiciousPatterns = [
        /\.\./, // Path traversal
        /[<>"|?*]/, // Invalid filename characters
        /^[/\\]/, // Absolute paths (depending on context)
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(filePath)) {
          return false;
        }
      }

      const sanitized = this.sanitizePath(filePath);
      const ext = path.extname(sanitized).toLowerCase();

      // Check if file extension is allowed (if restrictions are specified)
      if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get file information safely
   */
  static getFileInfo(filePath: string): {
    exists: boolean;
    size?: number;
    modified?: Date;
    isDirectory?: boolean;
    error?: string;
  } {
    try {
      if (!this.isPathSafe(filePath)) {
        return { exists: false, error: 'Unsafe file path' };
      }

      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a standardized error result
   */
  static createErrorResult(error: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: false,
      error,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Create a standardized success result
   */
  static createSuccessResult(data: any, metadata?: Record<string, any>): ToolResult {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Parse JSON safely
   */
  static safeJsonParse(jsonString: string): { success: boolean; data?: any; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown parsing error'}`,
      };
    }
  }

  /**
   * Escape shell arguments for safe execution
   */
  static escapeShellArg(arg: string): string {
    // Basic shell escaping - replace single quotes with quoted version
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }

  /**
   * Generate a unique identifier
   */
  static generateId(prefix: string = 'tool'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Debounce function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  }

  /**
   * Throttle function calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }

  /**
   * Deep clone an object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  /**
   * Check if two objects are deeply equal
   */
  static deepEqual(a: any, b: any): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      return false;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    if (Array.isArray(a)) {
      if (a.length !== b.length) {
        return false;
      }

      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) {
          return false;
        }
      }

      return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (!this.deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }
}
