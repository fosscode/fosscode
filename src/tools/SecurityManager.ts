import * as path from 'path';
import * as fs from 'fs';

/**
 * Security manager for tool operations
 * Handles path validation, file restrictions, and permission checking
 */
export class SecurityManager {
  private readonly maxFileSize: number = 10 * 1024 * 1024; // 10MB default
  private readonly allowedFileTypes: Set<string>;
  private readonly restrictedPaths: Set<string>;
  private readonly allowedPaths: Set<string>;

  constructor(options?: {
    maxFileSize?: number;
    allowedFileTypes?: string[];
    restrictedPaths?: string[];
    allowedPaths?: string[];
  }) {
    this.maxFileSize = options?.maxFileSize ?? this.maxFileSize;
    this.allowedFileTypes = new Set(
      options?.allowedFileTypes ?? [
        '.txt',
        '.md',
        '.json',
        '.ts',
        '.js',
        '.py',
        '.rs',
        '.go',
        '.java',
        '.cpp',
        '.c',
        '.h',
      ]
    );
    this.restrictedPaths = new Set(
      options?.restrictedPaths ?? ['/etc', '/usr', '/sys', '/proc', '/dev', '/root']
    );
    // Allow the current working directory and its subdirectories
    const cwd = process.cwd();
    this.allowedPaths = new Set([cwd, ...(options?.allowedPaths ?? [])]);
  }

  /**
   * Validate and sanitize a file path
   * @param inputPath The path to validate
   * @returns Sanitized absolute path
   * @throws Error if path is invalid or restricted
   */
  validatePath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    // Resolve to absolute path and normalize
    const absolutePath = path.resolve(inputPath);
    const normalizedPath = path.normalize(absolutePath);

    // Check for directory traversal attempts
    if (normalizedPath.includes('..') || normalizedPath !== absolutePath) {
      throw new Error('Invalid path: directory traversal detected');
    }

    // Check restricted paths
    for (const restrictedPath of this.restrictedPaths) {
      if (normalizedPath.startsWith(restrictedPath)) {
        throw new Error(`Access denied: path '${normalizedPath}' is in restricted area`);
      }
    }

    // If allowed paths are specified, check if path is within allowed areas
    if (this.allowedPaths.size > 0) {
      let isAllowed = false;
      for (const allowedPath of this.allowedPaths) {
        if (normalizedPath.startsWith(allowedPath)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed) {
        throw new Error(`Access denied: path '${normalizedPath}' is not in allowed areas`);
      }
    }

    return normalizedPath;
  }

  /**
   * Validate file type based on extension
   * @param filePath The file path to check
   * @throws Error if file type is not allowed
   */
  validateFileType(filePath: string): void {
    const extension = path.extname(filePath).toLowerCase();
    if (extension && !this.allowedFileTypes.has(extension)) {
      throw new Error(`File type '${extension}' is not allowed`);
    }
  }

  /**
   * Check if file size is within limits
   * @param filePath The file path to check
   * @throws Error if file is too large
   */
  async validateFileSize(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.maxFileSize) {
        throw new Error(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${this.maxFileSize} bytes)`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('exceeds maximum')) {
        throw error;
      }
      throw new Error(
        `Cannot access file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if file exists and is readable
   * @param filePath The file path to check
   * @throws Error if file doesn't exist or isn't readable
   */
  async validateFileAccess(filePath: string): Promise<void> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (_error) {
      throw new Error(`Cannot access file '${filePath}': file does not exist or is not readable`);
    }
  }

  /**
   * Check if directory exists and is accessible
   * @param dirPath The directory path to check
   * @throws Error if directory doesn't exist or isn't accessible
   */
  async validateDirectoryAccess(dirPath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path '${dirPath}' is not a directory`);
      }
      await fs.promises.access(dirPath, fs.constants.R_OK);
    } catch (error) {
      if (error instanceof Error && error.message.includes('is not a directory')) {
        throw error;
      }
      throw new Error(
        `Cannot access directory '${dirPath}': directory does not exist or is not accessible`
      );
    }
  }

  /**
   * Validate write permissions for a path
   * @param filePath The file path to check write permissions for
   * @throws Error if write permissions are denied
   */
  async validateWritePermissions(filePath: string): Promise<void> {
    const directory = path.dirname(filePath);
    try {
      await fs.promises.access(directory, fs.constants.W_OK);
    } catch (_error) {
      throw new Error(
        `Write permission denied for '${filePath}': cannot write to directory '${directory}'`
      );
    }
  }

  /**
   * Comprehensive validation for file operations
   * @param filePath The file path to validate
   * @param operation The operation type ('read' | 'write')
   * @throws Error if validation fails
   */
  async validateFileOperation(filePath: string, operation: 'read' | 'write'): Promise<string> {
    const validatedPath = this.validatePath(filePath);
    this.validateFileType(validatedPath);

    if (operation === 'read') {
      await this.validateFileAccess(validatedPath);
      await this.validateFileSize(validatedPath);
    } else if (operation === 'write') {
      await this.validateWritePermissions(validatedPath);
    }

    return validatedPath;
  }

  /**
   * Comprehensive validation for directory operations
   * @param dirPath The directory path to validate
   * @throws Error if validation fails
   */
  async validateDirectoryOperation(dirPath: string): Promise<string> {
    const validatedPath = this.validatePath(dirPath);
    await this.validateDirectoryAccess(validatedPath);
    return validatedPath;
  }
}

// Export singleton instance
export const securityManager = new SecurityManager();
