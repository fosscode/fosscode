import { useState, useCallback, useEffect } from 'react';
import { ImageHandler, ProcessedImage, SUPPORTED_IMAGE_FORMATS } from '../../utils/ImageHandler.js';

export interface AttachedImage {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  processedImage: ProcessedImage;
}

export interface UseImagePasteResult {
  attachedImages: AttachedImage[];
  setAttachedImages: React.Dispatch<React.SetStateAction<AttachedImage[]>>;
  isProcessingImage: boolean;
  imageError: string | null;
  clearImageError: () => void;
  addImageFromPath: (imagePath: string) => Promise<boolean>;
  addImagesFromPaths: (imagePaths: string[]) => Promise<ProcessedImage[]>;
  removeImage: (index: number) => void;
  clearImages: () => void;
  detectAndProcessImages: (text: string) => Promise<{
    images: ProcessedImage[];
    cleanedText: string;
    errors: string[];
  }>;
  getImagesSummary: () => string;
}

/**
 * Hook for managing image attachments in the interactive chat
 * Supports:
 * - Adding images from file paths
 * - Auto-detecting image paths in text
 * - Managing attached images state
 */
export function useImagePaste(verbose: boolean = false): UseImagePasteResult {
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageHandler] = useState(() => new ImageHandler({ verbose }));

  // Clear error after 5 seconds
  useEffect(() => {
    if (imageError) {
      const timer = setTimeout(() => {
        setImageError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [imageError]);

  const clearImageError = useCallback(() => {
    setImageError(null);
  }, []);

  const addImageFromPath = useCallback(
    async (imagePath: string): Promise<boolean> => {
      setIsProcessingImage(true);
      setImageError(null);

      try {
        const processed = await imageHandler.processImage(imagePath);

        setAttachedImages(prev => [
          ...prev,
          {
            fileName: processed.fileName,
            sizeBytes: processed.sizeBytes,
            mimeType: processed.mimeType,
            processedImage: processed,
          },
        ]);

        if (verbose) {
          console.log(`Added image: ${processed.fileName}`);
        }

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setImageError(errorMessage);
        return false;
      } finally {
        setIsProcessingImage(false);
      }
    },
    [imageHandler, verbose]
  );

  const addImagesFromPaths = useCallback(
    async (imagePaths: string[]): Promise<ProcessedImage[]> => {
      setIsProcessingImage(true);
      setImageError(null);

      try {
        const processed = await imageHandler.processImages(imagePaths);

        const newImages: AttachedImage[] = processed.map(img => ({
          fileName: img.fileName,
          sizeBytes: img.sizeBytes,
          mimeType: img.mimeType,
          processedImage: img,
        }));

        setAttachedImages(prev => [...prev, ...newImages]);

        if (verbose) {
          console.log(`Added ${processed.length} image(s)`);
        }

        return processed;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setImageError(errorMessage);
        return [];
      } finally {
        setIsProcessingImage(false);
      }
    },
    [imageHandler, verbose]
  );

  const removeImage = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setAttachedImages([]);
  }, []);

  const detectAndProcessImages = useCallback(
    async (
      text: string
    ): Promise<{
      images: ProcessedImage[];
      cleanedText: string;
      errors: string[];
    }> => {
      setIsProcessingImage(true);

      try {
        const result = await imageHandler.extractImagesFromInput(text, { autoProcess: true });

        if (result.images.length > 0) {
          const newImages: AttachedImage[] = result.images.map(img => ({
            fileName: img.fileName,
            sizeBytes: img.sizeBytes,
            mimeType: img.mimeType,
            processedImage: img,
          }));

          setAttachedImages(prev => [...prev, ...newImages]);
        }

        if (result.errors.length > 0) {
          setImageError(result.errors.join('; '));
        }

        return result;
      } finally {
        setIsProcessingImage(false);
      }
    },
    [imageHandler]
  );

  const getImagesSummary = useCallback((): string => {
    if (attachedImages.length === 0) {
      return '';
    }

    const totalSize = attachedImages.reduce((sum, img) => sum + img.sizeBytes, 0);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    if (attachedImages.length === 1) {
      return `1 image (${(attachedImages[0].sizeBytes / 1024).toFixed(1)}KB)`;
    }

    return `${attachedImages.length} images (${sizeMB}MB total)`;
  }, [attachedImages]);

  return {
    attachedImages,
    setAttachedImages,
    isProcessingImage,
    imageError,
    clearImageError,
    addImageFromPath,
    addImagesFromPaths,
    removeImage,
    clearImages,
    detectAndProcessImages,
    getImagesSummary,
  };
}

/**
 * Check if a string looks like an image file path
 */
export function looksLikeImagePath(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return SUPPORTED_IMAGE_FORMATS.some(format => trimmed.endsWith(format));
}

/**
 * Extract potential image paths from clipboard text
 * This is a heuristic for detecting pasted file paths
 */
export function extractPotentialImagePaths(text: string): string[] {
  const paths: string[] = [];

  // Look for file:// URLs
  const fileUrlPattern = /file:\/\/([^\s]+\.(png|jpg|jpeg|gif|webp))/gi;
  let match;
  while ((match = fileUrlPattern.exec(text)) !== null) {
    paths.push(match[1]);
  }

  // Look for absolute paths
  const absolutePathPattern = /(?:\/[^\s]+|[A-Za-z]:\\[^\s]+)\.(png|jpg|jpeg|gif|webp)/gi;
  while ((match = absolutePathPattern.exec(text)) !== null) {
    paths.push(match[0]);
  }

  return paths;
}
