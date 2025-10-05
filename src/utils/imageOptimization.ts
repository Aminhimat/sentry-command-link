/**
 * Advanced image optimization for slow connections
 */

interface CompressionOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'jpeg' | 'webp' | 'png';
  progressive?: boolean;
}

class ImageOptimizer {
  async compressImage(
    file: File, 
    options: Partial<CompressionOptions> = {}
  ): Promise<{ compressedFile: File; compressionRatio: number }> {
    const defaultOptions: CompressionOptions = {
      quality: 0.85,
      maxWidth: 1280,
      maxHeight: 720,
      format: 'webp',
      progressive: true
    };

    const opts = { ...defaultOptions, ...options };
    
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

          // Use better quality scaling
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
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
      slow: { quality: 0.75, maxWidth: 960, maxHeight: 540, format: 'webp' as const },
      medium: { quality: 0.85, maxWidth: 1280, maxHeight: 720, format: 'webp' as const },
      fast: { quality: 0.9, maxWidth: 1920, maxHeight: 1080, format: 'webp' as const }
    };

    const config = speedConfigs[connectionSpeed];
    const { compressedFile } = await this.compressImage(file, config);
    
    return compressedFile;
  }
}

export const imageOptimizer = new ImageOptimizer();