import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

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

interface WordReportGeneratorProps {
  reports: Report[];
  company: Company | null;
  reportFilters: {
    startDate: Date;
    endDate: Date;
    guardId: string;
    reportType: string;
  };
}

export class WordReportGenerator {
  private async getImageBuffer(imageUrl: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      return await response.arrayBuffer();
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  }

  private createHeaderSection(company: Company | null, reportFilters: any): Paragraph[] {
    const headerParagraphs: Paragraph[] = [];

    // Company name and title
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: company?.name || 'Security Company',
            size: 28,
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Report title
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Daily Activity Report',
            size: 36,
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    // Date range
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Report Period: ${reportFilters.startDate.toLocaleDateString()} - ${reportFilters.endDate.toLocaleDateString()}`,
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    return headerParagraphs;
  }

  private async createReportEntry(report: Report): Promise<Paragraph[]> {
    const paragraphs: Paragraph[] = [];
    const reportDate = new Date(report.created_at);
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard';

    // Report header with ID and date
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Report ID: ${report.id.substring(0, 8).toUpperCase()}`,
            bold: true,
            size: 24,
          }),
          new TextRun({
            text: ` | ${reportDate.toLocaleString()}`,
            size: 24,
          }),
        ],
        spacing: { before: 300, after: 100 },
      })
    );

    // Guard and location info
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Guard: ${guardName}`,
            size: 20,
          }),
        ],
        spacing: { after: 100 },
      })
    );

    if (report.location_address) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Location: ${report.location_address}`,
              size: 20,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    // Report content
    if (report.report_text) {
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      
      lines.forEach(line => {
        if (line.startsWith('Task:')) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  bold: true,
                  size: 22,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        } else {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      });
    }

    // Add image if available
    if (report.image_url) {
      try {
        const imageBuffer = await this.getImageBuffer(report.image_url);
        if (imageBuffer) {
          paragraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: new Uint8Array(imageBuffer),
                  transformation: {
                    width: 400,
                    height: 300,
                  },
                  type: 'png',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 300 },
            })
          );
        }
      } catch (error) {
        console.error('Error adding image to Word document:', error);
      }
    }

    // Add separator
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '─'.repeat(50),
            color: 'CCCCCC',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      })
    );

    return paragraphs;
  }

  private createSummarySection(reports: Report[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Summary title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Summary',
            size: 28,
            bold: true,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    // Total reports
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Total Reports: ${reports.length}`,
            size: 22,
          }),
        ],
        spacing: { after: 150 },
      })
    );

    // Count reports by guard
    const guardCounts: { [key: string]: number } = {};
    reports.forEach(report => {
      const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown';
      guardCounts[guardName] = (guardCounts[guardName] || 0) + 1;
    });

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Reports by Guard:',
            size: 22,
            bold: true,
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    Object.entries(guardCounts).forEach(([guard, count]) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${guard}: ${count} reports`,
              size: 20,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    });

    return paragraphs;
  }

  public async generateReport(reports: Report[], company: Company | null, reportFilters: any): Promise<void> {
    const children: Paragraph[] = [];

    // Add header
    children.push(...this.createHeaderSection(company, reportFilters));

    // Add each report
    for (const report of reports) {
      const reportParagraphs = await this.createReportEntry(report);
      children.push(...reportParagraphs);
    }

    // Add summary
    children.push(...this.createSummarySection(reports));

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    // Generate filename
    const dateStr = reportFilters.reportType === 'daily' 
      ? reportFilters.startDate.toISOString().split('T')[0]
      : `${reportFilters.startDate.toISOString().split('T')[0]}_to_${reportFilters.endDate.toISOString().split('T')[0]}`;
    
    const filename = `security_report_${dateStr}.docx`;

    // Save the document
    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    saveAs(blob, filename);
  }
}

export const generateWordReport = async (reports: Report[], company: Company | null, reportFilters: any) => {
  const generator = new WordReportGenerator();
  await generator.generateReport(reports, company, reportFilters);
};