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

  private drawHeader(company: Company | null, reportFilters: any) {
    // Company logo and header
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(company?.name || 'Security Company', this.margin, this.currentY);
    this.currentY += 10;

    // Report title
    this.doc.setFontSize(16);
    this.doc.text('Security Guard Reports', this.margin, this.currentY);
    this.currentY += 8;

    // Date range
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    const dateText = reportFilters.reportType === 'daily' 
      ? `Date: ${reportFilters.startDate.toLocaleDateString()}`
      : `Period: ${reportFilters.startDate.toLocaleDateString()} - ${reportFilters.endDate.toLocaleDateString()}`;
    this.doc.text(dateText, this.margin, this.currentY);
    this.currentY += 6;

    // Generated timestamp
    this.doc.text(`Generated: ${new Date().toLocaleString()}`, this.margin, this.currentY);
    this.currentY += 10;

    // Line separator
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 5;
  }

  private async addReportEntry(report: Report, index: number) {
    this.addPageIfNeeded(40);

    // Report header
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Report #${index + 1}`, this.margin, this.currentY);
    this.currentY += 8;

    // Guard info
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard';
    this.doc.text(`Guard: ${guardName}`, this.margin, this.currentY);
    this.currentY += this.lineHeight;

    // Date and time
    const reportDate = new Date(report.created_at);
    this.doc.text(`Date: ${reportDate.toLocaleDateString()}`, this.margin, this.currentY);
    this.doc.text(`Time: ${reportDate.toLocaleTimeString()}`, this.margin + 60, this.currentY);
    this.currentY += this.lineHeight;

    // Location
    if (report.location_address) {
      this.doc.text(`Location: ${report.location_address}`, this.margin, this.currentY);
      this.currentY += this.lineHeight;
    }

    // Report ID
    this.doc.text(`ID: ${report.id}`, this.margin, this.currentY);
    this.currentY += this.lineHeight + 2;

    // Report text
    if (report.report_text) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Report:', this.margin, this.currentY);
      this.currentY += this.lineHeight;

      this.doc.setFont('helvetica', 'normal');
      const splitText = this.doc.splitTextToSize(report.report_text, this.pageWidth - (this.margin * 2));
      this.doc.text(splitText, this.margin, this.currentY);
      this.currentY += splitText.length * this.lineHeight + 5;
    }

    // Add image if available
    if (report.image_url) {
      await this.addImage(report.image_url);
    }

    // Separator line
    this.currentY += 5;
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
  }

  private async addImage(imageUrl: string): Promise<void> {
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

          // Use original image dimensions for better quality
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          
          ctx.drawImage(img, 0, 0);
          
          const imageData = canvas.toDataURL('image/png');
          
          // Calculate dimensions to fit in PDF
          const maxWidth = this.pageWidth - (this.margin * 2);
          const maxHeight = 80;
          
          let imgWidth = maxWidth;
          let imgHeight = (img.naturalHeight / img.naturalWidth) * maxWidth;
          
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = (img.naturalWidth / img.naturalHeight) * maxHeight;
          }

          this.addPageIfNeeded(imgHeight + 10);
          
          this.doc.addImage(imageData, 'PNG', this.margin, this.currentY, imgWidth, imgHeight);
          this.currentY += imgHeight + 5;
          
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
    this.drawHeader(company, reportFilters);

    // Add each report
    for (let i = 0; i < reports.length; i++) {
      await this.addReportEntry(reports[i], i);
    }

    // Add summary
    this.addSummary(reports);

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