/**
 * Advanced image compression for PDF generation
 * Uses browser-image-compression for optimal size reduction
 */
import imageCompression from 'browser-image-compression';

interface PDFCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  alwaysKeepResolution?: boolean;
}

/**
 * Compress an image for PDF embedding with optimal settings
 * @param imageUrl - URL of the image to compress
 * @param targetMaxPx - Optional max dimension in pixels based on on-page size
 * @returns Compressed image as base64 data URL
 */
export async function compressImageForPDF(imageUrl: string, targetMaxPx?: number): Promise<string> {
  try {
    // Fetch the image as a blob
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type });

    // Smart compression settings from Amin's guide
    const options: PDFCompressionOptions = {
      maxSizeMB: 0.4,              // 0.3-0.6 is ideal balance
      maxWidthOrHeight: targetMaxPx ?? 2000, // Derive from on-page size when provided
      useWebWorker: true,          // Faster compression
      initialQuality: 0.82,        // Keeps visual clarity
      alwaysKeepResolution: false
    };

    console.log('Compressing image:', imageUrl.substring(0, 50) + '...');
    console.log('Original size:', (file.size / 1024).toFixed(2), 'KB');

    // Compress the image
    const compressedFile = await imageCompression(file, options);
    
    console.log('Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');
    console.log('Compression ratio:', ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%');

    // Convert to base64 for PDF embedding
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    // Fallback to original image
    return imageUrl;
  }
}

/**
 * Check if browser supports WebP format
 */
export function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Preload and compress multiple images in parallel with batching
 * @param imageUrls - Array of image URLs to compress
 * @param batchSize - Number of images to process at once (default: 10)
 */
export async function preloadAndCompressImages(
  imageUrls: string[], 
  batchSize: number = 10
): Promise<Map<string, string>> {
  const imageCache = new Map<string, string>();
  
  console.log(`Preloading and compressing ${imageUrls.length} images in batches of ${batchSize}...`);
  
  // Process in batches to avoid overwhelming the browser
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const compressed = await compressImageForPDF(url);
        return { url, compressed };
      })
    );
    
    // Store successful compressions
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        imageCache.set(result.value.url, result.value.compressed);
      }
    });
    
    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageUrls.length / batchSize)}`);
  }
  
  return imageCache;
}
