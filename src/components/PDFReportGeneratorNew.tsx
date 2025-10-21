import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import imageCompression from 'browser-image-compression';

interface Report {
  id: string;
  guard_id: string;
  company_id: string;
  report_text: string;
  image_url: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
  incident_type?: string;
  guard?: {
    first_name: string;
    last_name: string;
  };
}

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

class FastPDFGenerator {
  private pdfDoc: PDFDocument | null = null;
  private currentPage: any = null;
  private pageWidth: number = 595;
  private pageHeight: number = 842;
  private margin: number = 50;
  private currentY: number = 0;
  private font: any = null;

  async initialize() {
    this.pdfDoc = await PDFDocument.create();
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.currentPage = this.pdfDoc.addPage([this.pageWidth, this.pageHeight]);
    this.currentY = this.pageHeight - this.margin;
  }

  private addPageIfNeeded(requiredHeight: number): void {
    if (this.currentY - requiredHeight < this.margin) {
      this.currentPage = this.pdfDoc!.addPage([this.pageWidth, this.pageHeight]);
      this.currentY = this.pageHeight - this.margin;
    }
  }

  private async drawHeader(
    company: Company | null,
    reportFilters: any
  ): Promise<void> {
    this.currentPage.drawText(company?.name || 'Security Report', {
      x: this.margin,
      y: this.currentY,
      size: 24,
      font: this.font,
      color: rgb(0, 0, 0)
    });
    
    this.currentY -= 40;
    
    this.currentPage.drawText('Security Report', {
      x: this.margin,
      y: this.currentY,
      size: 16,
      font: this.font,
      color: rgb(0.3, 0.3, 0.3)
    });
    
    this.currentY -= 25;
    
    if (reportFilters?.startDate || reportFilters?.endDate) {
      const startDate = reportFilters.startDate ? new Date(reportFilters.startDate).toLocaleDateString() : 'Start';
      const endDate = reportFilters.endDate ? new Date(reportFilters.endDate).toLocaleDateString() : 'End';
      
      this.currentPage.drawText(`Period: ${startDate} - ${endDate}`, {
        x: this.margin,
        y: this.currentY,
        size: 12,
        font: this.font,
        color: rgb(0.4, 0.4, 0.4)
      });
      this.currentY -= 20;
    }
    
    this.currentPage.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: this.margin,
      y: this.currentY,
      size: 10,
      font: this.font,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    this.currentY -= 40;
  }

  private async addReportEntry(
    report: Report,
    index: number,
    compressedImages: Map<string, Uint8Array>
  ): Promise<void> {
    this.addPageIfNeeded(200);
    
    // Report header
    this.currentPage.drawText(`Report #${index + 1}`, {
      x: this.margin,
      y: this.currentY,
      size: 14,
      font: this.font,
      color: rgb(0, 0, 0)
    });
    
    this.currentY -= 25;
    
    // Date
    this.currentPage.drawText(`Date: ${new Date(report.created_at).toLocaleString()}`, {
      x: this.margin,
      y: this.currentY,
      size: 10,
      font: this.font,
      color: rgb(0.2, 0.2, 0.2)
    });
    
    this.currentY -= 20;
    
    // Guard and location
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard';
    
    if (guardName) {
      this.currentPage.drawText(`Guard: ${guardName}`, {
        x: this.margin,
        y: this.currentY,
        size: 10,
        font: this.font,
        color: rgb(0.2, 0.2, 0.2)
      });
      this.currentY -= 20;
    }
    
    if (report.location_address) {
      this.currentPage.drawText(`Location: ${report.location_address}`, {
        x: this.margin,
        y: this.currentY,
        size: 10,
        font: this.font,
        color: rgb(0.2, 0.2, 0.2)
      });
      this.currentY -= 20;
    }
    
    // Description with text wrapping
    if (report.report_text) {
      const maxWidth = this.pageWidth - 2 * this.margin;
      const words = report.report_text.split(' ');
      let line = '';
      
      for (const word of words) {
        const testLine = line + word + ' ';
        const textWidth = this.font.widthOfTextAtSize(testLine, 9);
        
        if (textWidth > maxWidth && line) {
          this.currentPage.drawText(line.trim(), {
            x: this.margin,
            y: this.currentY,
            size: 9,
            font: this.font,
            color: rgb(0.3, 0.3, 0.3)
          });
          this.currentY -= 15;
          line = word + ' ';
          
          // Stop after 5 lines
          if (line.split('\n').length > 5) break;
        } else {
          line = testLine;
        }
      }
      
      if (line.trim()) {
        this.currentPage.drawText(line.trim(), {
          x: this.margin,
          y: this.currentY,
          size: 9,
          font: this.font,
          color: rgb(0.3, 0.3, 0.3)
        });
        this.currentY -= 15;
      }
    }
    
    this.currentY -= 10;
    
    // Add compressed image
    if (report.image_url && compressedImages.has(report.image_url)) {
      await this.addImageToEntry(report.image_url, compressedImages);
    }
    
    this.currentY -= 20;
  }

  private async addImageToEntry(
    imageUrl: string,
    compressedImages: Map<string, Uint8Array>
  ): Promise<void> {
    try {
      const imageBytes = compressedImages.get(imageUrl);
      if (!imageBytes) return;
      
      const image = await this.pdfDoc!.embedJpg(imageBytes);
      const imgDims = image.scale(0.4);
      
      const maxWidth = this.pageWidth - 2 * this.margin;
      const maxHeight = 400;
      
      let imgWidth = imgDims.width;
      let imgHeight = imgDims.height;
      
      if (imgWidth > maxWidth) {
        imgHeight = (imgHeight * maxWidth) / imgWidth;
        imgWidth = maxWidth;
      }
      
      if (imgHeight > maxHeight) {
        imgWidth = (imgWidth * maxHeight) / imgHeight;
        imgHeight = maxHeight;
      }
      
      this.addPageIfNeeded(imgHeight + 20);
      
      this.currentPage.drawImage(image, {
        x: (this.pageWidth - imgWidth) / 2,
        y: this.currentY - imgHeight,
        width: imgWidth,
        height: imgHeight
      });
      
      this.currentY -= imgHeight + 10;
    } catch (error) {
      console.error('Error adding image:', error);
    }
  }

  private addSummary(reports: Report[]): void {
    this.addPageIfNeeded(150);
    
    this.currentPage.drawText('Report Summary', {
      x: this.margin,
      y: this.currentY,
      size: 16,
      font: this.font,
      color: rgb(0, 0, 0)
    });
    
    this.currentY -= 30;
    
    this.currentPage.drawText(`Total Reports: ${reports.length}`, {
      x: this.margin,
      y: this.currentY,
      size: 12,
      font: this.font,
      color: rgb(0.2, 0.2, 0.2)
    });
    
    this.currentY -= 25;
    
    const guardStats = new Map<string, number>();
    reports.forEach(report => {
      const guardName = report.guard 
        ? `${report.guard.first_name} ${report.guard.last_name}` 
        : 'Unknown';
      guardStats.set(guardName, (guardStats.get(guardName) || 0) + 1);
    });
    
    if (guardStats.size > 0) {
      this.currentPage.drawText('Reports by Guard:', {
        x: this.margin,
        y: this.currentY,
        size: 12,
        font: this.font,
        color: rgb(0.2, 0.2, 0.2)
      });
      
      this.currentY -= 20;
      
      guardStats.forEach((count, guard) => {
        this.currentPage.drawText(`• ${guard}: ${count} reports`, {
          x: this.margin + 10,
          y: this.currentY,
          size: 10,
          font: this.font,
          color: rgb(0.3, 0.3, 0.3)
        });
        this.currentY -= 18;
      });
    }
  }

  private async compressAndLoadImages(reports: Report[]): Promise<Map<string, Uint8Array>> {
    const imageMap = new Map<string, Uint8Array>();
    const reportsWithImages = reports.filter(r => r.image_url);
    
    console.log(`⚡ Compressing ${reportsWithImages.length} images in parallel...`);
    
    const compressionPromises = reportsWithImages.map(async (report) => {
      try {
        const response = await fetch(report.image_url!);
        const blob = await response.blob();
        const file = new File([blob], 'image.jpg', { type: blob.type });
        
        // Fast compression with browser-image-compression
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/jpeg'
        });
        
        const bytes = new Uint8Array(await compressed.arrayBuffer());
        return { url: report.image_url!, bytes };
      } catch (error) {
        console.error(`Failed to compress image ${report.image_url}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(compressionPromises);
    results.forEach(result => {
      if (result) {
        imageMap.set(result.url, result.bytes);
      }
    });
    
    console.log(`✅ Compressed ${imageMap.size} images successfully`);
    return imageMap;
  }

  async generateReport(
    reports: Report[],
    company: Company | null,
    reportFilters: any,
    useWorker: boolean = false
  ): Promise<void> {
    // Use Web Worker for large reports (50+ images)
    if (useWorker && reports.filter(r => r.image_url).length >= 50) {
      return this.generateWithWorker(reports, company, reportFilters);
    }
    
    console.log('🚀 Starting fast PDF generation with pdf-lib...');
    const startTime = performance.now();
    
    await this.initialize();
    
    // Compress all images in parallel - this is the bottleneck
    const compressedImages = await this.compressAndLoadImages(reports);
    
    // Add header
    await this.drawHeader(company, reportFilters);
    
    // Add each report entry
    for (let i = 0; i < reports.length; i++) {
      await this.addReportEntry(reports[i], i, compressedImages);
    }
    
    // Add summary
    this.addSummary(reports);
    
    // Save with optimization for speed
    console.log('💾 Saving PDF...');
    const pdfBytes = await this.pdfDoc!.save({ useObjectStreams: false });
    
    // Fast download using blob with proper type casting
    const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Security_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    
    const endTime = performance.now();
    console.log(`✅ PDF generated in ${((endTime - startTime) / 1000).toFixed(2)}s`);
  }
  
  private async generateWithWorker(
    reports: Report[],
    company: Company | null,
    reportFilters: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔄 Using Web Worker for large PDF generation...');
      
      const worker = new Worker(
        new URL('../workers/pdfWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      worker.onmessage = (e) => {
        if (e.data.success) {
          const blob = new Blob([e.data.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Security_Report_${new Date().toISOString().split('T')[0]}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          worker.terminate();
          console.log('✅ Worker PDF generation complete!');
          resolve();
        } else {
          worker.terminate();
          reject(new Error(e.data.error));
        }
      };
      
      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };
      
      worker.postMessage({ reports, company, reportFilters });
    });
  }
}

export const generateFastPDFReport = async (
  reports: Report[],
  company: Company | null,
  reportFilters: any,
  useWorker: boolean = false
): Promise<void> => {
  const generator = new FastPDFGenerator();
  await generator.generateReport(reports, company, reportFilters, useWorker);
};
