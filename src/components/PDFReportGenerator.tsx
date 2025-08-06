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

  private drawHeader(company: Company | null, reportFilters: any) {
    // Company name on the left
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(company?.name || 'Security Company', this.margin, this.currentY);

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
    const entryHeight = 50;
    this.addPageIfNeeded(entryHeight);

    const reportDate = new Date(report.created_at);
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard';
    
    // Gray background for entry
    this.doc.setFillColor(245, 245, 245);
    this.doc.rect(this.margin, this.currentY - 2, this.pageWidth - (this.margin * 2), entryHeight - 10, 'F');
    
    // Left column - Date/time, Security Patrol, and Issue ID in one label
    const leftColumnX = this.margin + 5;
    
    // Combined label with date, time, security patrol, and issue ID
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    const dateTimeText = `${reportDate.toDateString()} ${reportDate.toLocaleTimeString()}`;
    this.doc.text(dateTimeText, leftColumnX, this.currentY + 5);
    
    // Security Patrol and Issue ID on same line
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    const patrolAndIdText = `(S) Security Patrol - ${report.id.substring(0, 10)}`;
    this.doc.text(patrolAndIdText, leftColumnX, this.currentY + 12);
    
    // Location venue name
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(report.location_address || 'Location Not Specified', leftColumnX, this.currentY + 19);
    
    // Address and Unit
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Location: Default', leftColumnX, this.currentY + 25);
    this.doc.text('Unit:', leftColumnX, this.currentY + 31);
    
    // Guard name
    this.doc.text(guardName, leftColumnX, this.currentY + 37);
    
    // Incident type badge (moved to center) - show actual incident type instead of Level 3
    const badgeX = leftColumnX + 100;
    const incidentType = report.incident_type || 'Security Patrol';
    const badgeWidth = Math.max(30, this.doc.getTextWidth(incidentType) + 4);
    
    this.doc.setFillColor(76, 175, 80);
    this.doc.rect(badgeX, this.currentY + 10, badgeWidth, 6, 'F');
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(incidentType, badgeX + 1, this.currentY + 14);
    
    // Right column - Image with Issue ID at top
    const rightColumnX = this.pageWidth - this.margin - 35;
    
    // Issue ID at top of image area
    this.doc.setTextColor(0, 0, 255);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(report.id.substring(0, 10), rightColumnX, this.currentY + 3);
    
    // Add image below the issue ID
    if (report.image_url) {
      await this.addImageToEntry(report.image_url, rightColumnX - 5, this.currentY + 6, 30, 30);
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

          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
          
          const imageData = canvas.toDataURL('image/png');
          this.doc.addImage(imageData, 'PNG', x, y, width, height);
          
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