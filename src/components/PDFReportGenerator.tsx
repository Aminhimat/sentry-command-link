import { jsPDF } from 'jspdf';
import { imageOptimizer } from '@/utils/imageOptimization';
import { compressImageForPDF, preloadAndCompressImages } from '@/utils/pdfImageCompression';
import { saveCompressedPDF } from '@/utils/pdfCompression';

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
  private margin: number = 10;
  private lineHeight: number = 6;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true, // Enable built-in compression
      precision: 2    // Lower precision for smaller file size
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.currentY = this.margin;
  }

  // Sanitize text to prevent WinAnsi encoding errors
  private sanitizeText(text: string): string {
    if (!text) return '';
    // Replace newlines with spaces and remove other problematic characters
    return text
      .replace(/[\n\r]/g, ' ') // Replace newlines with spaces
      .replace(/[\t]/g, ' ')    // Replace tabs with spaces
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .trim();
  }

  private addPageIfNeeded(requiredHeight: number = 30) {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
      return true; // Indicate that a new page was added
    }
    return false; // No new page was added
  }

  private addPageNumber() {
    const currentPage = this.doc.getCurrentPageInfo().pageNumber;
    const totalPages = this.doc.getNumberOfPages();
    this.doc.setFontSize(11); // Increased from 9 for better mobile clarity
    this.doc.setFont('helvetica', 'bold'); // Bold for better visibility
    this.doc.setTextColor(80, 80, 80); // Slightly darker gray for better contrast
    const pageText = `Page ${currentPage} of ${totalPages}`;
    const textWidth = this.doc.getTextWidth(pageText);
    this.doc.text(pageText, (this.pageWidth - textWidth) / 2, this.pageHeight - 5);
    this.doc.setTextColor(0, 0, 0); // Reset to black
    this.doc.setFont('helvetica', 'normal'); // Reset to normal
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
    const companyName = this.sanitizeText(company?.name || 'Security Company');
    
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

  private async addReportEntry(report: Report, index: number, company: Company | null, compressedImages?: Map<string, string>) {
    const entryHeight = 50; // Reduced to minimize bottom spacing and fit 5 reports per page
    // No automatic page addition here since we handle it manually in generateReport

    const reportDate = new Date(report.created_at);
    const guardName = this.sanitizeText(report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard');
    
    // Extract severity level from report text to determine header color
    let severityLevel = 'none';
    if (report.report_text) {
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      const severityLine = lines.find(line => line.startsWith('Severity:'));
      if (severityLine) {
        severityLevel = severityLine.replace('Severity:', '').trim().toLowerCase();
      }
    }
    
    // Clean white background with subtle border and improved header styling - extended to cover all elements
    this.doc.setFillColor(255, 255, 255);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - this.margin + 8, entryHeight - 2, 'F'); // Extended to cover image
    this.doc.setDrawColor(220, 220, 220);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - this.margin + 8, entryHeight - 2, 'S'); // Extended to cover image
    
    // Add dynamic header background based on severity level
    let headerColor = [31, 41, 55]; // Default professional dark blue-gray
    let borderColor = [55, 65, 81]; // Default border color
    
    if (severityLevel === 'none' || severityLevel === 'low') {
      headerColor = [211, 211, 211]; // Light grey
      borderColor = [169, 169, 169]; // Medium grey border
    } else if (severityLevel === 'medium') {
      headerColor = [234, 179, 8]; // Yellow
      borderColor = [202, 138, 4]; // Darker yellow border
    } else if (severityLevel === 'high') {
      headerColor = [249, 115, 22]; // Orange
      borderColor = [234, 88, 12]; // Darker orange border
    } else if (severityLevel === 'critical') {
      headerColor = [239, 68, 68]; // Red
      borderColor = [220, 38, 38]; // Darker red border
    }
    
    this.doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - this.margin + 3, 7, 'F'); // Extended to end of image
    this.doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    this.doc.rect(this.margin, this.currentY, this.pageWidth - this.margin + 3, 7, 'S'); // Extended to end of image
    
    // Main content area - more compact
    const contentY = this.currentY + 4;
    const leftColumnX = this.margin + 5;
    const middleColumnX = this.margin + 50;
    const rightColumnX = this.pageWidth - this.margin - 30;
    
    // Header row with improved styling: Date/Time on left, Report ID on right - smaller header
    const headerY = this.currentY + 6;
    
    // Left: Date and Time with better formatting - adjust text color based on background
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    // Use black text for light grey headers, white for dark headers
    if (severityLevel === 'none' || severityLevel === 'low') {
      this.doc.setTextColor(0, 0, 0); // Black text for light grey background
    } else {
      this.doc.setTextColor(255, 255, 255); // White text for dark backgrounds
    }
    this.doc.text(`${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`, leftColumnX, headerY);
    
    // Right: Report ID with consistent styling
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    if (severityLevel === 'none' || severityLevel === 'low') {
      this.doc.setTextColor(0, 0, 0); // Black text for light grey background
    } else {
      this.doc.setTextColor(220, 220, 220); // Light gray for secondary text on dark background
    }
    const reportIdText = `Issue ID: ${report.id.substring(0, 8)}`;
    const reportIdWidth = this.doc.getTextWidth(reportIdText);
    this.doc.text(reportIdText, this.pageWidth - this.margin - 5 - reportIdWidth, headerY);
    
    // Reset text color for body content
    this.doc.setTextColor(0, 0, 0);
    
    // Guard Information (improved positioning after header)
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Guard: ${guardName}`, leftColumnX, contentY + 12);
    
    // Location Information (compact with better spacing and text wrapping)
    if (report.location_address) {
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      
      // Define maximum width for location text to prevent overflow
      // Keep it within left column, leaving space for description box
      const maxLocationWidth = 80; // Constrain to left side of page
      
      // Sanitize and wrap location text if it's too long
      const locationText = this.sanitizeText(`Location: ${report.location_address}`);
      const wrappedLocation = this.doc.splitTextToSize(locationText, maxLocationWidth);
      
      // Display wrapped location text (up to 2 lines to keep compact)
      const maxLocationLines = 2;
      for (let i = 0; i < Math.min(wrappedLocation.length, maxLocationLines); i++) {
        this.doc.text(wrappedLocation[i], leftColumnX, contentY + 17 + (i * 4));
      }
    }
    
    // Report Content - Display Task in middle column and other fields at bottom
    if (report.report_text) {
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      
      // Split report text into separate lines
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      
      // Display Description in middle column with rectangle box
      const descriptionLine = lines.find(line => line.startsWith('Description:'));
      
      let displayText = '';
      if (descriptionLine) {
        const descriptionValue = descriptionLine.replace('Description:', '').trim();
        displayText = this.sanitizeText(descriptionValue);
      } else if (report.report_text) {
        // If no formatted description, use the entire report text as description
        displayText = this.sanitizeText(report.report_text.trim());
      }
      
      // Use default if still empty
      if (!displayText) {
        displayText = 'Security Patrol';
      }
      
      // Calculate box dimensions - positioned properly within table boundaries
      const boxWidth = 60; // Width for description box
      const boxHeight = 35; // Reduced height to fit within table
      const boxX = this.pageWidth - this.margin - 125; // Positioned within table boundaries
      const boxY = this.currentY + 9; // Moved up for better positioning
      
      // Draw rectangle border only (no fill)
      this.doc.setDrawColor(200, 200, 200); // Gray border
      this.doc.rect(boxX, boxY, boxWidth, boxHeight, 'S'); // S = stroke only
      
      // Add text inside the box with better sizing
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7);
      this.doc.setTextColor(0, 0, 0);
      
      // Wrap text if it's too long with more padding
      const maxWidth = boxWidth - 6; // More padding inside box
      const wrappedText = this.doc.splitTextToSize(displayText, maxWidth);
      
      // Fit up to 3 lines in the box
      const maxLines = 3;
      const lineSpacing = 4;
      const totalTextHeight = Math.min(wrappedText.length, maxLines) * lineSpacing;
      const startY = boxY + 4; // Top-left alignment with small padding
      
      for (let j = 0; j < Math.min(wrappedText.length, maxLines); j++) {
        const textX = boxX + 3; // Left align with padding
        this.doc.text(wrappedText[j], textX, startY + (j * lineSpacing));
      }
      this.doc.setFont('helvetica', 'normal'); // Reset to normal
      this.doc.setFontSize(7);
      
      // Display Task in the middle area
      let bottomY = contentY + 25;
      lines.forEach((line) => {
        if (line.startsWith('Task:')) {
          this.doc.text(line.trim(), leftColumnX, bottomY);
          bottomY += 6;
        }
      });
      
      // Display Severity label at the very bottom of the table entry
      const severityLine = lines.find(line => line.startsWith('Severity:'));
      if (severityLine) {
        const severityValue = this.sanitizeText(severityLine.replace('Severity:', '').trim().toLowerCase());
        const severityText = `Severity: ${severityValue.charAt(0).toUpperCase() + severityValue.slice(1)}`;
        
        // Determine label color based on severity level
        let labelColor = [156, 163, 175]; // Default light gray
        let labelBorderColor = [107, 114, 128]; // Default border
        
        if (severityValue === 'none' || severityValue === 'low') {
          labelColor = [22, 163, 74]; // Dark green
          labelBorderColor = [21, 128, 61]; // Darker green border
        } else if (severityValue === 'medium') {
          labelColor = [234, 179, 8]; // Yellow
          labelBorderColor = [202, 138, 4]; // Darker yellow border
        } else if (severityValue === 'high') {
          labelColor = [249, 115, 22]; // Orange
          labelBorderColor = [234, 88, 12]; // Darker orange border
        } else if (severityValue === 'critical') {
          labelColor = [239, 68, 68]; // Red
          labelBorderColor = [220, 38, 38]; // Darker red border
        }
        
        // Position at bottom of table entry (entryHeight is 50)
        const labelBottomY = this.currentY + entryHeight - 7;
        const labelWidth = this.doc.getTextWidth(severityText) + 40;
        const labelHeight = 6;
        
        // Draw colored label background
        this.doc.setFillColor(labelColor[0], labelColor[1], labelColor[2]);
        this.doc.rect(leftColumnX, labelBottomY - 3.5, labelWidth, labelHeight, 'F');
        this.doc.setDrawColor(labelBorderColor[0], labelBorderColor[1], labelBorderColor[2]);
        this.doc.rect(leftColumnX, labelBottomY - 3.5, labelWidth, labelHeight, 'S');
        
        // Draw white text on colored background
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(severityText, leftColumnX + 2, labelBottomY);
        
        // Reset styling
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
      }
    }
    
    // Right side - Image with compression
    if (report.image_url) {
      // Watermark text: Company name + Guard name + timestamp (will be truncated to fit)
      const companyName = this.sanitizeText(company?.name || 'Security Co');
      const wmText = `${companyName} • ${guardName} • ${reportDate.toLocaleString()}`;

      // Image positioned with small space after description box - on right side
      const imageX = this.pageWidth - this.margin - 52; // Adjusted for larger image
      
      const compressedImageData = compressedImages?.get(report.image_url);
      if (compressedImageData) {
        // Use the pre-compressed image data directly (faster)
        this.doc.addImage(compressedImageData, 'JPEG', imageX, this.currentY + 8, 60, 40, undefined, 'FAST');
        
        // Add watermark overlay
        if (wmText) {
          const imgX = imageX;
          const imgY = this.currentY + 8;
          const imgWidth = 60;
          const imgHeight = 40;
          const barHeight = 6;
          const offsetUp = 1;
          
          // Background bar (solid black)
          this.doc.setFillColor(0, 0, 0);
          this.doc.rect(imgX, imgY + imgHeight - barHeight - offsetUp, imgWidth, barHeight, 'F');
          
          // White text
          this.doc.setTextColor(255, 255, 255);
          this.doc.setFont('helvetica', 'bold');
          this.doc.setFontSize(6);
          
          const maxTextWidth = imgWidth - 2;
          let text = this.sanitizeText(wmText);
          while (this.doc.getTextWidth(text) > maxTextWidth && text.length > 1) {
            text = text.slice(0, -2) + '…';
          }
          
          // Position text in the center of the bar
          const textY = imgY + imgHeight - barHeight / 2 + 1 - offsetUp;
          this.doc.text(text, imgX + 1, textY);
          this.doc.setTextColor(0, 0, 0);
          this.doc.setFont('helvetica', 'normal');
        }
      } else {
        // Fallback: compress on the fly
        await this.addImageToEntry(report.image_url, imageX, this.currentY + 12, 60, 40, wmText);
      }
    }
    
    this.currentY += entryHeight;
  }

  private async addImageToEntry(imageUrl: string, x: number, y: number, width: number, height: number, watermarkText?: string): Promise<void> {
    try {
      // For multi-image reports, use smaller size for faster downloads
      const targetMaxPx = 800;

      console.log('Compressing image on-the-fly:', imageUrl.substring(0, 50));
      
      // Use browser-image-compression for optimal size reduction
      const compressedImageData = await compressImageForPDF(imageUrl, targetMaxPx);
      
      this.doc.addImage(compressedImageData, 'JPEG', x, y, width, height, undefined, 'FAST');
      
      console.log('Image added to PDF successfully');
    } catch (error) {
      console.error('Error adding image to entry:', error);
    }
  }

  private async processImageToPDF(img: HTMLImageElement, x: number, y: number, width: number, height: number, watermarkText?: string): Promise<void> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.warn('Canvas context not available');
        return;
      }

      // High DPI for maximum image clarity and visibility
      const targetDPI = 200; // High DPI for sharp, crisp pictures
      const mmToIn = 1 / 25.4;
      const placedWIn = width * mmToIn;
      const placedHIn = height * mmToIn;

      const originalW = img.naturalWidth || img.width;
      const originalH = img.naturalHeight || img.height;

      // Ideal pixel dimensions for the placed size
      const idealPxW = Math.round(placedWIn * targetDPI);
      const idealPxH = Math.round(placedHIn * targetDPI);

      // Scale down preserving aspect ratio; never upscale beyond original
      const scale = Math.min(idealPxW / originalW, idealPxH / originalH, 1);
      const canvasW = Math.max(1, Math.round(originalW * scale));
      const canvasH = Math.max(1, Math.round(originalH * scale));

      canvas.width = canvasW;
      canvas.height = canvasH;

      // Draw image with high-quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvasW, canvasH);

      // Use Blob for better memory efficiency and JPEG compression (quality 0.82)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.82);  // Smart compression: sharp but light
      });
      
      // Convert blob to base64 for jsPDF
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
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

        // Sanitize and truncate text to fit available width
        const maxTextWidth = width - padding * 2;
        let text = this.sanitizeText(watermarkText);
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

  private async preloadAllImages(reports: Report[]): Promise<Map<string, string>> {
    const imageUrls = reports
      .map(r => r.image_url)
      .filter((url): url is string => !!url);

    if (imageUrls.length === 0) return new Map();

    console.log(`Preloading and compressing ${imageUrls.length} images with browser-image-compression...`);

    // Use the new compression utility with batching
    const compressedImages = await preloadAndCompressImages(imageUrls, 10);

    console.log(`Successfully compressed ${compressedImages.size} images`);
    return compressedImages;
  }

  public async generateReport(reports: Report[], company: Company | null, reportFilters: any): Promise<void> {
    console.log('Starting PDF generation with', reports.length, 'reports');
    console.log('Using browser-image-compression for optimal file size...');
    
    // Preload and compress all images first
    const compressedImages = await this.preloadAllImages(reports);

    // Add header to first page
    await this.drawHeader(company, reportFilters);

    // Add each report with exactly 5 reports per page
    for (let i = 0; i < reports.length; i++) {
      // Add new page and header after every 5 reports (except the first page)
      if (i > 0 && i % 5 === 0) {
        // Page number will be added in a single final pass
        this.doc.addPage();
        this.currentY = this.margin;
        await this.drawHeader(company, reportFilters);
      }
      
      await this.addReportEntry(reports[i], i, company, compressedImages);
    }

    // Add page number to the last page
    

    // Update all page numbers to show total with better clarity
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(11); // Increased from 9 for better mobile clarity
      this.doc.setFont('helvetica', 'bold'); // Bold for better visibility
      this.doc.setTextColor(80, 80, 80); // Slightly darker gray for better contrast
      const pageText = `Page ${i} of ${totalPages}`;
      const textWidth = this.doc.getTextWidth(pageText);
      this.doc.text(pageText, (this.pageWidth - textWidth) / 2, this.pageHeight - 5);
    }
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('helvetica', 'normal');

    // Generate filename
    const startDate = new Date(reportFilters.startDate);
    const endDate = new Date(reportFilters.endDate);
    const dateStr = reportFilters.reportType === 'daily' 
      ? startDate.toISOString().split('T')[0]
      : `${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`;
    
    const filename = `security_report_${dateStr}.pdf`;

    // Save with advanced compression for faster downloads
    console.log(`Generating compressed PDF: ${filename}`);
    console.log(`Total reports: ${reports.length}, Total pages: ${totalPages}`);
    
    await saveCompressedPDF(this.doc, filename);
    
    console.log(`PDF generated and compressed successfully`);
  }
}

export const generatePDFReport = async (reports: Report[], company: Company | null, reportFilters: any) => {
  const generator = new PDFReportGenerator();
  await generator.generateReport(reports, company, reportFilters);
};