import * as fs from 'fs';
import * as path from 'path';
import {
  ImageHandler,
  SUPPORTED_IMAGE_FORMATS,
  IMAGE_MIME_TYPES,
  VISION_CAPABLE_PROVIDERS,
} from '../utils/ImageHandler';

describe('ImageHandler', () => {
  let imageHandler: ImageHandler;
  let testImagePath: string;
  let testPngData: Buffer;

  beforeEach(() => {
    imageHandler = new ImageHandler({ verbose: false });

    // Create a minimal valid PNG file for testing
    // PNG header + IHDR chunk (minimum valid PNG)
    testPngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR length
      0x49, 0x48, 0x44, 0x52, // IHDR type
      0x00, 0x00, 0x00, 0x01, // width = 1
      0x00, 0x00, 0x00, 0x01, // height = 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc.
      0x90, 0x77, 0x53, 0xde, // CRC
      0x00, 0x00, 0x00, 0x0c, // IDAT length
      0x49, 0x44, 0x41, 0x54, // IDAT type
      0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01, 0x01, 0x00, 0x05, 0xfe,
      0xb0, 0x25, 0x00, 0x00, // IDAT data + CRC
      0x00, 0x00, 0x00, 0x00, // IEND length
      0x49, 0x45, 0x4e, 0x44, // IEND type
      0xae, 0x42, 0x60, 0x82, // IEND CRC
    ]);

    testImagePath = path.join(__dirname, 'test-image.png');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.promises.unlink(testImagePath);
    } catch {
      // File might not exist
    }
  });

  describe('constructor', () => {
    it('should create an ImageHandler with default options', () => {
      const handler = new ImageHandler();
      expect(handler).toBeInstanceOf(ImageHandler);
    });

    it('should create an ImageHandler with custom options', () => {
      const handler = new ImageHandler({ maxImageSizeMB: 10, verbose: true });
      expect(handler).toBeInstanceOf(ImageHandler);
    });
  });

  describe('isSupportedFormat', () => {
    it('should return true for supported formats', () => {
      expect(imageHandler.isSupportedFormat('image.png')).toBe(true);
      expect(imageHandler.isSupportedFormat('image.jpg')).toBe(true);
      expect(imageHandler.isSupportedFormat('image.jpeg')).toBe(true);
      expect(imageHandler.isSupportedFormat('image.gif')).toBe(true);
      expect(imageHandler.isSupportedFormat('image.webp')).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(imageHandler.isSupportedFormat('image.bmp')).toBe(false);
      expect(imageHandler.isSupportedFormat('image.svg')).toBe(false);
      expect(imageHandler.isSupportedFormat('image.tiff')).toBe(false);
      expect(imageHandler.isSupportedFormat('document.pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(imageHandler.isSupportedFormat('image.PNG')).toBe(true);
      expect(imageHandler.isSupportedFormat('image.JPG')).toBe(true);
      expect(imageHandler.isSupportedFormat('image.JPEG')).toBe(true);
    });
  });

  describe('getImageFormat', () => {
    it('should return the correct format for supported images', () => {
      expect(imageHandler.getImageFormat('test.png')).toBe('.png');
      expect(imageHandler.getImageFormat('test.jpg')).toBe('.jpg');
      expect(imageHandler.getImageFormat('test.gif')).toBe('.gif');
    });

    it('should return null for unsupported formats', () => {
      expect(imageHandler.getImageFormat('test.bmp')).toBe(null);
      expect(imageHandler.getImageFormat('test.txt')).toBe(null);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(imageHandler.getMimeType('test.png')).toBe('image/png');
      expect(imageHandler.getMimeType('test.jpg')).toBe('image/jpeg');
      expect(imageHandler.getMimeType('test.jpeg')).toBe('image/jpeg');
      expect(imageHandler.getMimeType('test.gif')).toBe('image/gif');
      expect(imageHandler.getMimeType('test.webp')).toBe('image/webp');
    });

    it('should return null for unsupported formats', () => {
      expect(imageHandler.getMimeType('test.bmp')).toBe(null);
    });
  });

  describe('isVisionCapableProvider', () => {
    it('should return true for vision-capable providers', () => {
      expect(imageHandler.isVisionCapableProvider('openai')).toBe(true);
      expect(imageHandler.isVisionCapableProvider('anthropic')).toBe(true);
      expect(imageHandler.isVisionCapableProvider('openrouter')).toBe(true);
    });

    it('should return false for non-vision providers', () => {
      expect(imageHandler.isVisionCapableProvider('grok')).toBe(false);
      expect(imageHandler.isVisionCapableProvider('lmstudio')).toBe(false);
      expect(imageHandler.isVisionCapableProvider('sonicfree')).toBe(false);
    });
  });

  describe('validateImage', () => {
    it('should validate an existing image file', async () => {
      await fs.promises.writeFile(testImagePath, testPngData);

      const result = await imageHandler.validateImage(testImagePath);

      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject non-existent files', async () => {
      const result = await imageHandler.validateImage('/non/existent/image.png');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject unsupported formats', async () => {
      const testBmpPath = path.join(__dirname, 'test-image.bmp');
      await fs.promises.writeFile(testBmpPath, Buffer.from('test'));

      try {
        const result = await imageHandler.validateImage(testBmpPath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unsupported image format');
      } finally {
        await fs.promises.unlink(testBmpPath);
      }
    });

    it('should reject files that are too large', async () => {
      const smallHandler = new ImageHandler({ maxImageSizeMB: 0.00001 }); // Very small limit
      await fs.promises.writeFile(testImagePath, testPngData);

      const result = await smallHandler.validateImage(testImagePath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('processImage', () => {
    it('should process a valid image and return base64 data', async () => {
      await fs.promises.writeFile(testImagePath, testPngData);

      const result = await imageHandler.processImage(testImagePath);

      expect(result.fileName).toBe('test-image.png');
      expect(result.mimeType).toBe('image/png');
      expect(result.format).toBe('.png');
      expect(result.base64Data).toBeDefined();
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('should throw error for invalid image', async () => {
      await expect(imageHandler.processImage('/non/existent/image.png')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('detectImagePaths', () => {
    it('should detect quoted image paths', () => {
      const text = 'Please analyze "screenshot.png"';
      const detected = imageHandler.detectImagePaths(text);

      // Find the quoted path (may have multiple detections due to regex patterns)
      const quotedPath = detected.find(d => d.originalPath === 'screenshot.png');
      expect(quotedPath).toBeDefined();
      expect(quotedPath!.isValid).toBe(true);
    });

    it('should detect absolute paths', () => {
      const text = 'Check this "/Users/test/screenshot.png" file';
      const detected = imageHandler.detectImagePaths(text);

      const absolutePath = detected.find(d => d.originalPath.includes('/Users/test/screenshot.png'));
      expect(absolutePath).toBeDefined();
    });

    it('should detect relative paths', () => {
      const text = 'Look at "./images/diagram.png"';
      const detected = imageHandler.detectImagePaths(text);

      const relativePath = detected.find(d => d.originalPath.includes('diagram.png'));
      expect(relativePath).toBeDefined();
    });

    it('should not duplicate identical paths', () => {
      const text = 'Compare "test.png" with "test.png"';
      const detected = imageHandler.detectImagePaths(text);

      // Count paths with test.png
      const testPaths = detected.filter(d => d.originalPath === 'test.png');
      expect(testPaths.length).toBe(1);
    });

    it('should detect common image formats', () => {
      const text = 'Files: "a.png" "b.jpg" "c.gif" "d.webp"';
      const detected = imageHandler.detectImagePaths(text);

      expect(detected.some(d => d.originalPath.endsWith('.png'))).toBe(true);
      expect(detected.some(d => d.originalPath.endsWith('.jpg'))).toBe(true);
      expect(detected.some(d => d.originalPath.endsWith('.gif'))).toBe(true);
      expect(detected.some(d => d.originalPath.endsWith('.webp'))).toBe(true);
    });
  });

  describe('formatForOpenAI', () => {
    it('should format text and images for OpenAI', async () => {
      await fs.promises.writeFile(testImagePath, testPngData);
      const processed = await imageHandler.processImage(testImagePath);

      const content = imageHandler.formatForOpenAI('Analyze this', [processed]);

      expect(content.length).toBe(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Analyze this' });
      expect(content[1].type).toBe('image_url');
    });

    it('should handle empty text', async () => {
      await fs.promises.writeFile(testImagePath, testPngData);
      const processed = await imageHandler.processImage(testImagePath);

      const content = imageHandler.formatForOpenAI('', [processed]);

      expect(content.length).toBe(1);
      expect(content[0].type).toBe('image_url');
    });
  });

  describe('formatForAnthropic', () => {
    it('should format images before text for Anthropic', async () => {
      await fs.promises.writeFile(testImagePath, testPngData);
      const processed = await imageHandler.processImage(testImagePath);

      const content = imageHandler.formatForAnthropic('Analyze this', [processed]);

      expect(content.length).toBe(2);
      expect(content[0].type).toBe('image');
      expect(content[1]).toEqual({ type: 'text', text: 'Analyze this' });
    });
  });

  describe('getVisionWarning', () => {
    it('should generate appropriate warning message', () => {
      const warning = imageHandler.getVisionWarning('grok', 3);

      expect(warning).toContain('grok');
      expect(warning).toContain('3 image');
      expect(warning).toContain('openai');
      expect(warning).toContain('anthropic');
    });
  });

  describe('constants', () => {
    it('should export supported image formats', () => {
      expect(SUPPORTED_IMAGE_FORMATS).toContain('.png');
      expect(SUPPORTED_IMAGE_FORMATS).toContain('.jpg');
      expect(SUPPORTED_IMAGE_FORMATS).toContain('.jpeg');
      expect(SUPPORTED_IMAGE_FORMATS).toContain('.gif');
      expect(SUPPORTED_IMAGE_FORMATS).toContain('.webp');
    });

    it('should export correct MIME types', () => {
      expect(IMAGE_MIME_TYPES['.png']).toBe('image/png');
      expect(IMAGE_MIME_TYPES['.jpg']).toBe('image/jpeg');
      expect(IMAGE_MIME_TYPES['.gif']).toBe('image/gif');
      expect(IMAGE_MIME_TYPES['.webp']).toBe('image/webp');
    });

    it('should export vision-capable providers', () => {
      expect(VISION_CAPABLE_PROVIDERS).toContain('openai');
      expect(VISION_CAPABLE_PROVIDERS).toContain('anthropic');
      expect(VISION_CAPABLE_PROVIDERS).toContain('openrouter');
    });
  });
});
