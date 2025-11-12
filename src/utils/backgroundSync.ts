/**
 * Background sync service for report uploads
 */

import { supabase } from "@/integrations/supabase/client";
import { offlineStorage, type PendingReport } from "./offlineStorage";
import { imageOptimizer } from "./imageOptimization";

interface SyncOptions {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

class BackgroundSyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingReports();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Periodic sync every 30 seconds when online
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingReports();
      }
    }, 30000);
  }

  async saveReportForSync(reportData: {
    taskType: string;
    site: string;
    description: string;
    severity: string;
    location?: { latitude: number; longitude: number };
    image?: File;
  }): Promise<string> {
    let imageBlob: Blob | undefined;
    
    if (reportData.image) {
      const originalSize = reportData.image.size;
      const connectionSpeed = this.getConnectionSpeed();
      
      // Optimize image for storage based on connection speed
      const optimized = await imageOptimizer.optimizeForConnection(
        reportData.image, 
        connectionSpeed
      );
      imageBlob = optimized;
      
      const compressedSize = optimized.size;
      const savedBytes = originalSize - compressedSize;
      const savedPercent = Math.round((savedBytes / originalSize) * 100);
      
      console.log(`📦 Image optimized for ${connectionSpeed} connection:`, {
        original: `${(originalSize / 1024 / 1024).toFixed(2)}MB`,
        compressed: `${(compressedSize / 1024 / 1024).toFixed(2)}MB`,
        saved: `${savedPercent}% (${(savedBytes / 1024 / 1024).toFixed(2)}MB)`
      });
    }

    const reportId = await offlineStorage.saveReport({
      taskType: reportData.taskType,
      site: reportData.site,
      description: reportData.description,
      severity: reportData.severity,
      location: reportData.location,
      imageBlob
    });

    // Try immediate upload if online
    if (this.isOnline) {
      this.uploadSingleReport(reportId);
    }

    return reportId;
  }

  private getConnectionSpeed(): 'slow' | 'medium' | 'fast' {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!connection) return 'medium';
    
    const effectiveType = connection.effectiveType;
    
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        return 'slow';
      case '3g':
        return 'medium';
      case '4g':
      default:
        return 'fast';
    }
  }

  async syncPendingReports(options: Partial<SyncOptions> = {}): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    const defaultOptions: SyncOptions = {
      maxRetries: 3,
      retryDelay: 5000,
      batchSize: 5
    };

    const opts = { ...defaultOptions, ...options };
    this.syncInProgress = true;

    try {
      const pendingReports = await offlineStorage.getPendingReports();
      console.log(`Found ${pendingReports.length} pending reports to sync`);

      // Process in batches
      for (let i = 0; i < pendingReports.length; i += opts.batchSize) {
        const batch = pendingReports.slice(i, i + opts.batchSize);
        await Promise.allSettled(
          batch.map(report => this.uploadSingleReport(report.id, opts.maxRetries))
        );
      }
    } catch (error) {
      console.error('Error during background sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async uploadSingleReport(reportId: string, maxRetries: number = 3): Promise<void> {
    try {
      const report = await offlineStorage.getReportById(reportId);
      if (!report || report.status === 'completed') return;

      // Skip if already being uploaded or exceeded retries
      if (report.status === 'uploading' || report.retryCount >= maxRetries) return;

      await offlineStorage.updateReportStatus(reportId, 'uploading');

      // Convert blob back to File if needed
      let imageFile: File | undefined;
      if (report.imageBlob) {
        imageFile = new File([report.imageBlob], `report_${reportId}.jpg`, {
          type: 'image/jpeg',
          lastModified: report.timestamp
        });
      }

      // Prepare form data
      const formData = new FormData();
      if (imageFile) {
        formData.append('image', imageFile);
      }
      
      formData.append('reportData', JSON.stringify({
        taskType: report.taskType,
        site: report.site,
        severity: report.severity,
        description: report.description,
        location: report.location
      }));

      // Upload using edge function
      const { error } = await (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const options: any = { body: formData };
        if (token) options.headers = { Authorization: `Bearer ${token}` };
        return supabase.functions.invoke('upload-guard-image', options);
      })();

      if (error) {
        throw new Error(error.message);
      }

      // Mark as completed and clean up
      await offlineStorage.updateReportStatus(reportId, 'completed');
      
      // Clean up after successful upload
      setTimeout(() => {
        offlineStorage.deleteReport(reportId);
      }, 5000);

      console.log(`Successfully uploaded report ${reportId}`);

    } catch (error) {
      console.error(`Failed to upload report ${reportId}:`, error);
      
      const report = await offlineStorage.getReportById(reportId);
      if (report) {
        const newRetryCount = report.retryCount + 1;
        
        if (newRetryCount < maxRetries) {
          await offlineStorage.updateReportStatus(reportId, 'failed', newRetryCount);
          
          // Schedule retry with exponential backoff
          const delay = Math.min(5000 * Math.pow(2, newRetryCount), 60000);
          const timeoutId = setTimeout(() => {
            this.uploadSingleReport(reportId, maxRetries);
            this.retryTimeouts.delete(reportId);
          }, delay);
          
          this.retryTimeouts.set(reportId, timeoutId);
        } else {
          await offlineStorage.updateReportStatus(reportId, 'failed', newRetryCount);
        }
      }
    }
  }

  async getPendingCount(): Promise<number> {
    const reports = await offlineStorage.getPendingReports();
    return reports.length;
  }

  async clearFailedReports(): Promise<void> {
    // Implementation to clear reports that have exceeded retry limit
    // This could be called from the UI
  }

  cleanup() {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }
}

export const backgroundSync = new BackgroundSyncService();