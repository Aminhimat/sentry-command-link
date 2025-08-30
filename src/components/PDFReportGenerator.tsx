import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

interface PDFReportGeneratorProps {
  reports: Report[];
  company: Company | null;
  reportFilters: {
    startDate: Date | string;
    endDate: Date | string;
    guardId: string;
    reportType: string;
  };
}

export class PDFReportGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private currentY: number;
  private margin: number = 20;
  private lineHeight: number = 6;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
      precision: 2
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.currentY = this.margin;
  }

  private addPageIfNeeded(requiredHeight: number = 30) {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
      return true; // Indicate that a new page was added
    }
    return false; // No new page was added
  }

  private async drawHeader(company: Company | null, reportFilters: any) {
    // Company logo and name on top row
    if (company?.logo_url) {
      try {
        await this.addImageToEntry(company.logo_url, this.margin, this.currentY - 5, 20, 15);
      } catch (error) {
        console.error('Error loading company logo:', error);
      }
    }

    // Company name next to logo or on left if no logo - with full width available
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    const companyNameX = company?.logo_url ? this.margin + 25 : this.margin;
    
    // Use full available width for company name (from logo to right margin)
    const availableWidth = this.pageWidth - companyNameX - this.margin - 10;
    const companyName = company?.name || 'Security Company';
    
    // Use splitTextToSize to handle long company names
    const wrappedName = this.doc.splitTextToSize(companyName, availableWidth);
    
    // Display company name (potentially on multiple lines)
    let maxCompanyNameLines = 0;
    if (Array.isArray(wrappedName)) {
      wrappedName.forEach((line, index) => {
        this.doc.text(line, companyNameX, this.currentY + (index * 5));
      });
      maxCompanyNameLines = wrappedName.length;
    } else {
      this.doc.text(wrappedName, companyNameX, this.currentY);
      maxCompanyNameLines = 1;
    }

    // Move to next line after company name
    this.currentY += Math.max(15, maxCompanyNameLines * 5 + 5);

    // Title centered on its own line
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    const title = 'Daily Activity Report';
    const titleWidth = this.doc.getTextWidth(title);
    const titleX = (this.pageWidth - titleWidth) / 2;
    this.doc.text(title, titleX, this.currentY);

    // Start/End times on the right side of title line
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    const startDate = new Date(reportFilters.startDate);
    const endDate = new Date(reportFilters.endDate);
    const startTime = reportFilters.startTime || '00:00';
    const endTime = reportFilters.endTime || '23:59';
    
    let startText, endText;
    if (reportFilters.reportType === 'daily') {
      startText = `Date: ${startDate.toLocaleDateString()}`;
      endText = `Time: ${startTime} - ${endTime}`;
    } else {
      startText = `Start: ${startDate.toLocaleDateString()} ${startTime}`;
      endText = `End: ${endDate.toLocaleDateString()} ${endTime}`;
    }
    
    this.doc.text(startText, this.pageWidth - this.margin - this.doc.getTextWidth(startText), this.currentY - 6);
    this.doc.text(endText, this.pageWidth - this.margin - this.doc.getTextWidth(endText), this.currentY);

    this.currentY += 15;
  }

  private async addReportEntry(report: Report, index: number, company: Company | null, preloadedImages?: Map<string, HTMLImageElement>) {
    const entryHeight = 50; // Reduced from 80 to fit 5 reports per page
    // No automatic page addition here since we handle it manually in generateReport

    const reportDate = new Date(report.created_at);
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard';
    
    // Clean white background with subtle border
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - (this.margin * 2), entryHeight - 2, 'F');
    this.doc.setDrawColor(220, 220, 220);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - (this.margin * 2), entryHeight - 2, 'S');
    
    // Main content area - more compact
    const contentY = this.currentY + 4;
    const leftColumnX = this.margin + 5;
    const middleColumnX = this.margin + 50;
    const rightColumnX = this.pageWidth - this.margin - 30;
    
    // Header: Date and Time (smaller font)
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(`${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`, leftColumnX, contentY);
    
    // Guard Information (more compact with better spacing)
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Guard: ${guardName}`, leftColumnX, contentY + 8); // Increased spacing from 6 to 8
    
    // Location Information (compact with better spacing)
    if (report.location_address) {
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(`Location: ${report.location_address}`, leftColumnX, contentY + 13); // Increased spacing from 10 to 13
    }
    
    // Report Content - Display Task in middle column and other fields at bottom
    if (report.report_text) {
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      
      // Split report text into separate lines
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      
      // Display Description in middle column with rectangle box - show "Security Patrol" if empty
      const descriptionLine = lines.find(line => line.startsWith('Description:'));
      
      let displayText = 'Security Patrol'; // Default value
      if (descriptionLine) {
        const descriptionValue = descriptionLine.replace('Description:', '').trim();
        if (descriptionValue) {
          displayText = descriptionValue;
        }
      }
      
      // Calculate bigger box dimensions (similar to picture size)
      const boxWidth = 70;
      const boxHeight = 30;
      const boxX = middleColumnX - 5;
      const boxY = contentY;
      
      // Draw rectangle border only (no fill)
      this.doc.setDrawColor(200, 200, 200); // Gray border
      this.doc.rect(boxX, boxY, boxWidth, boxHeight, 'S'); // S = stroke only
      
      // Add centered text inside the box
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      this.doc.setTextColor(0, 0, 0);
      
      // Wrap text if it's too long
      const maxWidth = boxWidth - 4; // Leave padding inside box
      const wrappedText = this.doc.splitTextToSize(displayText, maxWidth);
      
      // Center the text vertically and horizontally
      const totalTextHeight = Math.min(wrappedText.length, 2) * 5;
      const startY = boxY + (boxHeight - totalTextHeight) / 2 + 4;
      
      for (let j = 0; j < Math.min(wrappedText.length, 2); j++) { // Limit to 2 lines to fit in box
        const textWidth = this.doc.getTextWidth(wrappedText[j]);
        const centeredX = boxX + (boxWidth - textWidth) / 2;
        this.doc.text(wrappedText[j], centeredX, startY + (j * 5));
      }
      this.doc.setFont('helvetica', 'normal'); // Reset to normal
      this.doc.setFontSize(7);
      
      // Display Task and Severity at the bottom with better spacing (exclude Description and Site)
      let bottomY = contentY + 20; // Increased spacing from 16 to 20 to give more space after Location
      lines.forEach((line) => {
        if (line.startsWith('Task:')) {
          this.doc.text(line.trim(), leftColumnX, bottomY);
          bottomY += 5; // Increased spacing from 3 to 5
        } else if (line.startsWith('Severity:')) {
          // Extract severity value and set color
          const severityValue = line.replace('Severity:', '').trim().toLowerCase();
          
          // Set color based on severity level
          if (severityValue === 'none' || severityValue === 'low') {
            this.doc.setTextColor(0, 128, 0); // Green
          } else if (severityValue === 'medium') {
            this.doc.setTextColor(255, 193, 7); // Yellow
          } else if (severityValue === 'high') {
            this.doc.setTextColor(255, 140, 0); // Orange
          } else if (severityValue === 'critical') {
            this.doc.setTextColor(255, 0, 0); // Red
          } else {
            this.doc.setTextColor(0, 0, 0); // Default black
          }
          
          this.doc.text(line.trim(), leftColumnX, bottomY);
          bottomY += 5; // Increased spacing from 3 to 5
          
          // Reset color to black for other text
          this.doc.setTextColor(0, 0, 0);
        }
      });
    }
    
    // Right side - Issue ID directly attached to smaller image
    if (report.image_url) {
      // Issue ID positioned directly above image (smaller)
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      const issueIdText = `${report.id.substring(0, 8)}`;
      const issueIdWidth = this.doc.getTextWidth(issueIdText);
      this.doc.text(issueIdText, rightColumnX + (25 - issueIdWidth) / 2, contentY - 1);

      // Watermark text: Company name + Guard name + timestamp (will be truncated to fit)
      const companyName = company?.name || 'Security Co';
      const wmText = `${companyName} • ${guardName} • ${reportDate.toLocaleString()}`;

      // Larger landscape image positioned right below the ID with watermark overlay at bottom
      await this.addImageToEntry(report.image_url, rightColumnX - 15, contentY + 2, 50, 35, wmText, preloadedImages?.get(report.image_url));
    } else {
      // Show issue ID even without image
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Report ID: ${report.id.substring(0, 10)}`, rightColumnX, contentY + 10);
    }
    
    this.currentY += entryHeight;
  }

  private async addImageToEntry(imageUrl: string, x: number, y: number, width: number, height: number, watermarkText?: string, preloadedImage?: HTMLImageElement): Promise<void> {
    return new Promise((resolve) => {
      // Use preloaded image if available, otherwise load normally
      if (preloadedImage) {
        this.processImageToPDF(preloadedImage, x, y, width, height, watermarkText);
        resolve();
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.processImageToPDF(img, x, y, width, height, watermarkText);
        resolve();
      };

      img.onerror = (error) => {
        console.error('Failed to load image:', imageUrl, error);
        resolve();
      };

      img.src = imageUrl;
    });
  }

  private processImageToPDF(img: HTMLImageElement, x: number, y: number, width: number, height: number, watermarkText?: string): void {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.warn('Canvas context not available');
        return;
      }

      // Optimized canvas size for smaller PDF while maintaining quality
      const maxWidth = 200;
      const maxHeight = 200;
      
      let { width: imgWidth, height: imgHeight } = img;
      
      // Calculate scaled dimensions
      if (imgWidth > maxWidth || imgHeight > maxHeight) {
        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
        imgWidth = imgWidth * ratio;
        imgHeight = imgHeight * ratio;
      }

      canvas.width = imgWidth;
      canvas.height = imgHeight;
      
      // Draw and compress image
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
      
      // Convert to JPEG with higher quality
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      this.doc.addImage(imageData, 'JPEG', x, y, width, height, undefined, 'FAST');

      // Draw watermark overlay (bottom of picture) if provided
      if (watermarkText) {
        const padding = 1.2;
        const barHeight = Math.max(3, Math.min(6, height * 0.2));

        // Background bar
        this.doc.setFillColor(0, 0, 0);
        this.doc.rect(x, y + height - barHeight, width, barHeight, 'F');

        // Text settings
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFont('helvetica', 'bold');
        const fontSize = Math.max(3, Math.min(5, barHeight - 1));
        this.doc.setFontSize(fontSize);

        // Truncate text to fit available width
        const maxTextWidth = width - padding * 2;
        let text = watermarkText;
        while (this.doc.getTextWidth(text) > maxTextWidth && text.length > 1) {
          text = text.slice(0, -2) + '…';
        }

        const textX = x + padding;
        const textY = y + height - barHeight + (barHeight / 2) + (fontSize / 2) - 1;
        this.doc.text(text, textX, textY);

        // Reset
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
      }
      
    } catch (error) {
      console.error('Error processing image:', error);
    }
  }

  private addSummary(reports: Report[]) {
    this.addPageIfNeeded(30);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Summary', this.margin, this.currentY);
    this.currentY += 10;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(`Total Reports: ${reports.length}`, this.margin, this.currentY);
    this.currentY += this.lineHeight;

    // Count reports by guard
    const guardCounts: { [key: string]: number } = {};
    reports.forEach(report => {
      const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown';
      guardCounts[guardName] = (guardCounts[guardName] || 0) + 1;
    });

    this.doc.text('Reports by Guard:', this.margin, this.currentY);
    this.currentY += this.lineHeight;

    Object.entries(guardCounts).forEach(([guard, count]) => {
      this.doc.text(`• ${guard}: ${count} reports`, this.margin + 5, this.currentY);
      this.currentY += this.lineHeight;
    });
  }

  private async preloadAllImages(reports: Report[]): Promise<Map<string, HTMLImageElement>> {
    const imageMap = new Map<string, HTMLImageElement>();
    const imagePromises: Promise<void>[] = [];

    reports.forEach(report => {
      if (report.image_url) {
        const promise = new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            imageMap.set(report.image_url!, img);
            resolve();
          };
          
          img.onerror = () => {
            console.warn('Failed to preload image:', report.image_url);
            resolve(); // Don't block on failed images
          };
          
          // Remove cache-busting for better performance
          img.src = report.image_url!;
        });
        imagePromises.push(promise);
      }
    });

    // Wait for all images to load (or fail) with 10s timeout
    await Promise.race([
      Promise.all(imagePromises),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    return imageMap;
  }

  public async generateReport(reports: Report[], company: Company | null, reportFilters: any): Promise<void> {
    // Preload all images in parallel first
    const preloadedImages = await this.preloadAllImages(reports);

    // Add header to first page
    await this.drawHeader(company, reportFilters);

    // Add each report with exactly 5 reports per page
    for (let i = 0; i < reports.length; i++) {
      // Add new page and header after every 5 reports (except the first page)
      if (i > 0 && i % 5 === 0) {
        this.doc.addPage();
        this.currentY = this.margin;
        await this.drawHeader(company, reportFilters);
      }
      
      await this.addReportEntry(reports[i], i, company, preloadedImages);
    }

    // Generate filename
    const startDate = new Date(reportFilters.startDate);
    const endDate = new Date(reportFilters.endDate);
    const dateStr = reportFilters.reportType === 'daily' 
      ? startDate.toISOString().split('T')[0]
      : `${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`;
    
    const filename = `security_report_${dateStr}.pdf`;

    // Save the PDF with compression
    this.doc.save(filename);
  }
}

export const generatePDFReport = async (reports: Report[], company: Company | null, reportFilters: any) => {
  const generator = new PDFReportGenerator();
  await generator.generateReport(reports, company, reportFilters);
};