/**
 * Advanced image optimization for slow connections
 */

interface CompressionOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'jpeg' | 'webp' | 'png';
  progressive?: boolean;
  useWebP?: boolean; // WebP is 30-40% smaller than JPEG
}

class ImageOptimizer {
  async compressImage(
    file: File, 
    options: Partial<CompressionOptions> = {}
  ): Promise<{ compressedFile: File; compressionRatio: number }> {
    const defaultOptions: CompressionOptions = {
      quality: 0.82,      // Optimal balance: keeps clarity, reduces size
      maxWidth: 2000,     // Perfect for A4 pages at 150-200 DPI
      maxHeight: 2000,
      format: 'jpeg',     // JPEG for photos (4-6× smaller than PNG)
      progressive: true,
      useWebP: false      // WebP gives 30-40% better compression
    };

    const opts = { ...defaultOptions, ...options };
    
    // Use WebP if supported and requested
    if (opts.useWebP && this.supportsWebP()) {
      opts.format = 'webp';
    }
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions maintaining aspect ratio
          let { width, height } = this.calculateDimensions(
            img.width, 
            img.height, 
            opts.maxWidth, 
            opts.maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Use better quality scaling and remove metadata
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            // Clear canvas to remove any metadata
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressionRatio = blob.size / file.size;
                  const compressedFile = new File(
                    [blob], 
                    file.name.replace(/\.[^/.]+$/, `.${opts.format}`),
                    { 
                      type: `image/${opts.format}`,
                      lastModified: Date.now()
                    }
                  );
                  resolve({ compressedFile, compressionRatio });
                } else {
                  reject(new Error('Failed to compress image'));
                }
              },
              `image/${opts.format}`,
              opts.quality
            );
          } else {
            reject(new Error('Failed to get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    // Scale down if needed
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  async createProgressiveJPEG(file: File): Promise<File> {
    // For progressive JPEG, we'll use a higher quality but add metadata
    const { compressedFile } = await this.compressImage(file, {
      quality: 0.8,
      format: 'jpeg',
      progressive: true
    });
    
    return compressedFile;
  }

  async createThumbnail(file: File, size: number = 150): Promise<File> {
    const { compressedFile } = await this.compressImage(file, {
      quality: 0.6,
      maxWidth: size,
      maxHeight: size,
      format: 'jpeg'
    });
    
    return compressedFile;
  }

  async optimizeForConnection(file: File, connectionSpeed: 'slow' | 'medium' | 'fast'): Promise<File> {
    const speedConfigs = {
      slow: { quality: 0.65, maxWidth: 1200, maxHeight: 1200, format: 'jpeg' as const, useWebP: true },
      medium: { quality: 0.75, maxWidth: 1600, maxHeight: 1600, format: 'jpeg' as const, useWebP: true },
      fast: { quality: 0.82, maxWidth: 2000, maxHeight: 2000, format: 'jpeg' as const, useWebP: false }
    };

    const config = speedConfigs[connectionSpeed];
    const { compressedFile } = await this.compressImage(file, config);
    
    return compressedFile;
  }

  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
}

export const imageOptimizer = new ImageOptimizer();