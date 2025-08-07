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
    startDate: Date;
    endDate: Date;
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
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.currentY = this.margin;
  }

  private addPageIfNeeded(requiredHeight: number = 30) {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private async drawHeader(company: Company | null, reportFilters: any) {
    // Company logo on the left (if available)
    if (company?.logo_url) {
      try {
        await this.addImageToEntry(company.logo_url, this.margin, this.currentY - 5, 20, 15);
      } catch (error) {
        console.error('Error loading company logo:', error);
      }
    }

    // Company name next to logo or on left if no logo
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    const companyNameX = company?.logo_url ? this.margin + 25 : this.margin;
    this.doc.text(company?.name || 'Security Company', companyNameX, this.currentY);

    // Title centered
    this.doc.setFontSize(18);
    const title = 'Daily Activity Report';
    const titleWidth = this.doc.getTextWidth(title);
    const titleX = (this.pageWidth - titleWidth) / 2;
    this.doc.text(title, titleX, this.currentY);

    // Start/End times on the right
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const startText = `Start: ${reportFilters.startDate.toLocaleDateString()} ${reportFilters.startDate.toLocaleTimeString()}`;
    const endText = `End: ${reportFilters.endDate.toLocaleDateString()} ${reportFilters.endDate.toLocaleTimeString()}`;
    
    this.doc.text(startText, this.pageWidth - this.margin - this.doc.getTextWidth(startText), this.currentY - 6);
    this.doc.text(endText, this.pageWidth - this.margin - this.doc.getTextWidth(endText), this.currentY);

    this.currentY += 8;

    // Company subtitle centered
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    const subtitle = company?.name || 'Security Company';
    const subtitleWidth = this.doc.getTextWidth(subtitle);
    const subtitleX = (this.pageWidth - subtitleWidth) / 2;
    this.doc.text(subtitle, subtitleX, this.currentY);
    this.currentY += 15;
  }

  private async addReportEntry(report: Report, index: number) {
    const entryHeight = 50; // Reduced from 80 to fit 5 reports per page
    this.addPageIfNeeded(entryHeight);

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
    const rightColumnX = this.pageWidth - this.margin - 30;
    
    // Header: Date and Time (smaller font)
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(`${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`, leftColumnX, contentY);
    
    // Guard Information (more compact)
    this.doc.setTextColor(60, 60, 60);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Guard: ${guardName}`, leftColumnX, contentY + 8);
    
    // Location Information (compact)
    if (report.location_address) {
      this.doc.text(`Location: ${report.location_address}`, leftColumnX, contentY + 14);
    }
    
    // Report Content - Display Task, Site, Severity in one line
    if (report.report_text) {
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      
      // Split and join with separators for compact display
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      const compactText = lines.join(' | ');
      const textLines = this.doc.splitTextToSize(compactText, 90);
      this.doc.text(textLines.slice(0, 2), leftColumnX, contentY + 20);
    }
    
    // Right side - Issue ID directly attached to smaller image
    if (report.image_url) {
      // Issue ID positioned directly above image (smaller)
      this.doc.setTextColor(220, 20, 60);
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      const issueIdText = `${report.id.substring(0, 8)}`;
      const issueIdWidth = this.doc.getTextWidth(issueIdText);
      this.doc.text(issueIdText, rightColumnX + (25 - issueIdWidth) / 2, contentY - 1);
      
      // Smaller image positioned right below the ID
      await this.addImageToEntry(report.image_url, rightColumnX, contentY + 2, 25, 25);
    } else {
      // Show issue ID even without image
      this.doc.setTextColor(100, 100, 100);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Report ID: ${report.id.substring(0, 10)}`, rightColumnX, contentY + 10);
    }
    
    this.currentY += entryHeight;
  }

  private async addImageToEntry(imageUrl: string, x: number, y: number, width: number, height: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve();
            return;
          }

          // Set smaller canvas size for compression
          const maxWidth = 400;
          const maxHeight = 400;
          
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
          
          // Convert to JPEG with 0.3 quality for significant compression
          const imageData = canvas.toDataURL('image/jpeg', 0.3);
          this.doc.addImage(imageData, 'JPEG', x, y, width, height);
          
        } catch (error) {
          console.error('Error processing image:', error);
        }
        resolve();
      };

      img.onerror = () => {
        console.error('Failed to load image:', imageUrl);
        resolve();
      };

      img.src = imageUrl;
    });
  }

  private addSummary(reports: Report[]) {
    this.addPageIfNeeded(30);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Summary', this.margin, this.currentY);
    this.currentY += 10;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
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

  public async generateReport(reports: Report[], company: Company | null, reportFilters: any): Promise<void> {
    // Add header
    await this.drawHeader(company, reportFilters);

    // Add each report
    for (let i = 0; i < reports.length; i++) {
      await this.addReportEntry(reports[i], i);
    }

    // Generate filename
    const dateStr = reportFilters.reportType === 'daily' 
      ? reportFilters.startDate.toISOString().split('T')[0]
      : `${reportFilters.startDate.toISOString().split('T')[0]}_to_${reportFilters.endDate.toISOString().split('T')[0]}`;
    
    const filename = `security_report_${dateStr}.pdf`;

    // Save the PDF
    this.doc.save(filename);
  }
}

export const generatePDFReport = async (reports: Report[], company: Company | null, reportFilters: any) => {
  const generator = new PDFReportGenerator();
  await generator.generateReport(reports, company, reportFilters);
};