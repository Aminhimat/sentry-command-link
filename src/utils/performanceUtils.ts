/**
 * Performance utility functions
 */

// Debounce function for search inputs
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastExec = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastExec >= delay) {
      func(...args);
      lastExec = now;
    }
  };
};

// Optimize array operations
export const optimizeArrayOperations = {
  // Use Map for O(1) lookups instead of O(n) array.find()
  createLookupMap: <T>(array: T[], keyFn: (item: T) => string) => {
    return new Map(array.map(item => [keyFn(item), item]));
  },

  // Batch updates to avoid multiple re-renders
  batchUpdates: <T>(items: T[], batchSize: number = 50) => {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
};

// Image optimization utilities
export const imageUtils = {
  // Convert image to WebP if supported
  supportsWebP: (): boolean => {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  },

  // Get optimal image format
  getOptimalImageSrc: (baseSrc: string): string => {
    if (imageUtils.supportsWebP() && !baseSrc.includes('.webp')) {
      return baseSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }
    return baseSrc;
  }
};

// Memory management utilities
export const memoryUtils = {
  // Clean up large objects
  cleanupLargeData: <T extends Record<string, any>>(data: T): Partial<T> => {
    const cleaned: Partial<T> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip very large arrays or objects
      if (Array.isArray(value) && value.length > 1000) continue;
      if (typeof value === 'object' && value && Object.keys(value).length > 100) continue;
      cleaned[key as keyof T] = value;
    }
    return cleaned;
  }
};

// Network utilities
export const networkUtils = {
  // Detect user's network connection speed
  getConnectionSpeed: (): 'slow' | 'medium' | 'fast' => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const effectiveType = connection?.effectiveType;
      
      if (effectiveType === '4g') return 'fast';
      if (effectiveType === '3g') return 'medium';
      return 'slow';
    }
    
    return 'medium'; // Default fallback
  },

  // Check if user prefers reduced data usage
  preferReducedData: (): boolean => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.saveData === true;
    }
    return false;
  },

  // Check if device is on a slow connection
  isSlowConnection: (): boolean => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.saveData || 
             connection?.effectiveType === 'slow-2g' || 
             connection?.effectiveType === '2g';
    }
    return false;
  }
};

// Resource loading utilities
export const resourceUtils = {
  // Preload critical resources
  preloadResource: (url: string, as: string): void => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
  },

  // Defer non-critical JavaScript
  deferScript: (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
};

// Performance monitoring
export const performanceMonitoring = {
  // Measure and log page load performance
  measurePageLoad: (): void => {
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const connectTime = perfData.responseEnd - perfData.requestStart;
        const renderTime = perfData.domComplete - perfData.domLoading;
        
        console.log('Performance Metrics:', {
          pageLoadTime: `${pageLoadTime}ms`,
          connectTime: `${connectTime}ms`,
          renderTime: `${renderTime}ms`,
        });
      });
    }
  },

  // Monitor Core Web Vitals (optional - requires web-vitals package)
  reportWebVitals: (onPerfEntry?: (metric: any) => void) => {
    if (onPerfEntry && onPerfEntry instanceof Function) {
      // Optional: Install web-vitals package to enable this feature
      // npm install web-vitals
      console.log('Web Vitals monitoring available with web-vitals package');
    }
  }
};