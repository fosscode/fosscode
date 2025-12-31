import * as fs from 'fs';
import * as path from 'path';

/**
 * Supported image formats for vision-capable LLM providers
 */
export const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'] as const;
export type SupportedImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];

/**
 * MIME types for supported image formats
 */
export const IMAGE_MIME_TYPES: Record<SupportedImageFormat, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * Providers that support vision/image inputs
 */
export const VISION_CAPABLE_PROVIDERS = ['openai', 'anthropic', 'openrouter'] as const;
export type VisionCapableProvider = (typeof VISION_CAPABLE_PROVIDERS)[number];

/**
 * Result of image processing
 */
export interface ProcessedImage {
  filePath: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
  format: SupportedImageFormat;
}

/**
 * Image content for LLM message format
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string; // data:image/png;base64,...
    detail?: 'low' | 'high' | 'auto';
  };
}

/**
 * Result of image path detection
 */
export interface DetectedImagePath {
  originalPath: string;
  absolutePath: string;
  isValid: boolean;
  format: SupportedImageFormat | null;
}

/**
 * ImageHandler - Utility for processing images for LLM vision capabilities
 *
 * Features:
 * - Validates and processes image files
 * - Converts images to base64 for LLM providers
 * - Detects image paths in user input
 * - Checks provider vision support
 */
export class ImageHandler {
  private maxImageSizeBytes: number;
  private verbose: boolean;

  constructor(options?: { maxImageSizeMB?: number; verbose?: boolean }) {
    // Default max size is 20MB (OpenAI limit)
    this.maxImageSizeBytes = (options?.maxImageSizeMB ?? 20) * 1024 * 1024;
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Check if a file extension is a supported image format
   */
  isSupportedFormat(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase() as SupportedImageFormat;
    return SUPPORTED_IMAGE_FORMATS.includes(ext);
  }

  /**
   * Get the image format from a file path
   */
  getImageFormat(filePath: string): SupportedImageFormat | null {
    const ext = path.extname(filePath).toLowerCase() as SupportedImageFormat;
    return SUPPORTED_IMAGE_FORMATS.includes(ext) ? ext : null;
  }

  /**
   * Get MIME type for an image file
   */
  getMimeType(filePath: string): string | null {
    const format = this.getImageFormat(filePath);
    return format ? IMAGE_MIME_TYPES[format] : null;
  }

  /**
   * Check if a provider supports vision/image inputs
   */
  isVisionCapableProvider(provider: string): provider is VisionCapableProvider {
    return VISION_CAPABLE_PROVIDERS.includes(provider as VisionCapableProvider);
  }

  /**
   * Validate that an image file exists and meets requirements
   */
  async validateImage(filePath: string): Promise<{
    valid: boolean;
    error?: string;
    stats?: fs.Stats;
  }> {
    try {
      // Resolve to absolute path
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      // Check if file exists
      const stats = await fs.promises.stat(absolutePath);

      if (!stats.isFile()) {
        return { valid: false, error: `Path is not a file: ${filePath}` };
      }

      // Check format
      if (!this.isSupportedFormat(absolutePath)) {
        const ext = path.extname(absolutePath);
        return {
          valid: false,
          error: `Unsupported image format: ${ext}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`,
        };
      }

      // Check size
      if (stats.size > this.maxImageSizeBytes) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const maxMB = (this.maxImageSizeBytes / (1024 * 1024)).toFixed(0);
        return {
          valid: false,
          error: `Image too large: ${sizeMB}MB (max: ${maxMB}MB)`,
        };
      }

      return { valid: true, stats };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { valid: false, error: `Image file not found: ${filePath}` };
      }
      return {
        valid: false,
        error: `Error validating image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Process an image file and convert to base64
   */
  async processImage(filePath: string): Promise<ProcessedImage> {
    // Validate first
    const validation = await this.validateImage(filePath);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

    // Read file and convert to base64
    const imageBuffer = await fs.promises.readFile(absolutePath);
    const base64Data = imageBuffer.toString('base64');

    const format = this.getImageFormat(absolutePath)!;
    const mimeType = IMAGE_MIME_TYPES[format];

    if (this.verbose) {
      console.log(`Processed image: ${path.basename(absolutePath)} (${(validation.stats!.size / 1024).toFixed(1)}KB)`);
    }

    return {
      filePath: absolutePath,
      fileName: path.basename(absolutePath),
      mimeType,
      base64Data,
      sizeBytes: validation.stats!.size,
      format,
    };
  }

  /**
   * Process multiple images
   */
  async processImages(filePaths: string[]): Promise<ProcessedImage[]> {
    const results: ProcessedImage[] = [];
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        const processed = await this.processImage(filePath);
        results.push(processed);
      } catch (error) {
        errors.push(`${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0 && this.verbose) {
      console.warn('Some images could not be processed:', errors);
    }

    return results;
  }

  /**
   * Convert a processed image to LLM message content format
   */
  toImageContent(image: ProcessedImage, detail: 'low' | 'high' | 'auto' = 'auto'): ImageContent {
    return {
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64Data}`,
        detail,
      },
    };
  }

  /**
   * Detect image paths in user input text
   * Looks for file paths ending with supported image extensions
   */
  detectImagePaths(text: string): DetectedImagePath[] {
    const results: DetectedImagePath[] = [];

    // Patterns to match file paths
    const patterns = [
      // Quoted paths: "path/to/image.png" or 'path/to/image.png'
      /["']([^"']+\.(png|jpg|jpeg|gif|webp))["']/gi,
      // Absolute paths: /path/to/image.png or C:\path\to\image.png
      /(?:\/[^\s]+\.(png|jpg|jpeg|gif|webp))|(?:[A-Za-z]:\\[^\s]+\.(png|jpg|jpeg|gif|webp))/gi,
      // Relative paths: ./path/to/image.png or path/to/image.png (more conservative)
      /(?:\.\/)?[\w\-./]+\.(png|jpg|jpeg|gif|webp)(?=\s|$|[,;)}\]])/gi,
    ];

    const seenPaths = new Set<string>();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Get the path from the match
        let originalPath = match[1] || match[0];
        originalPath = originalPath.replace(/^["']|["']$/g, '').trim();

        // Skip if we've already seen this path
        if (seenPaths.has(originalPath)) {
          continue;
        }
        seenPaths.add(originalPath);

        // Resolve to absolute path
        const absolutePath = path.isAbsolute(originalPath)
          ? originalPath
          : path.resolve(process.cwd(), originalPath);

        const format = this.getImageFormat(absolutePath);
        const isValid = format !== null;

        results.push({
          originalPath,
          absolutePath,
          isValid,
          format,
        });
      }
    }

    return results;
  }

  /**
   * Extract and process images from user input
   * Returns processed images and cleaned input text
   */
  async extractImagesFromInput(
    text: string,
    options?: { autoProcess?: boolean }
  ): Promise<{
    images: ProcessedImage[];
    cleanedText: string;
    detectedPaths: DetectedImagePath[];
    errors: string[];
  }> {
    const detectedPaths = this.detectImagePaths(text);
    const images: ProcessedImage[] = [];
    const errors: string[] = [];
    let cleanedText = text;

    if (options?.autoProcess !== false) {
      for (const detected of detectedPaths) {
        if (detected.isValid) {
          try {
            const processed = await this.processImage(detected.absolutePath);
            images.push(processed);
            // Optionally remove the path from the text
            // cleanedText = cleanedText.replace(detected.originalPath, `[Image: ${processed.fileName}]`);
          } catch (error) {
            errors.push(`${detected.originalPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }

    return {
      images,
      cleanedText,
      detectedPaths,
      errors,
    };
  }

  /**
   * Format images for OpenAI-style message content
   */
  formatForOpenAI(
    textContent: string,
    images: ProcessedImage[],
    detail: 'low' | 'high' | 'auto' = 'auto'
  ): Array<{ type: 'text'; text: string } | ImageContent> {
    const content: Array<{ type: 'text'; text: string } | ImageContent> = [];

    // Add text content first
    if (textContent.trim()) {
      content.push({ type: 'text', text: textContent });
    }

    // Add images
    for (const image of images) {
      content.push(this.toImageContent(image, detail));
    }

    return content;
  }

  /**
   * Format images for Anthropic-style message content
   */
  formatForAnthropic(
    textContent: string,
    images: ProcessedImage[]
  ): Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> {
    const content: Array<
      { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    > = [];

    // Add images first (Anthropic preference)
    for (const image of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mimeType,
          data: image.base64Data,
        },
      });
    }

    // Add text content
    if (textContent.trim()) {
      content.push({ type: 'text', text: textContent });
    }

    return content;
  }

  /**
   * Generate a warning message for non-vision-capable providers
   */
  getVisionWarning(provider: string, imageCount: number): string {
    return `Warning: Provider '${provider}' does not support image inputs. ${imageCount} image(s) will be ignored. Vision-capable providers: ${VISION_CAPABLE_PROVIDERS.join(', ')}`;
  }
}

// Export singleton instance for convenience
export const imageHandler = new ImageHandler();
