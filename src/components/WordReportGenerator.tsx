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

  private async createHeaderSection(company: Company | null, reportFilters: any): Promise<Paragraph[]> {
    const headerParagraphs: Paragraph[] = [];

    // Company logo if available
    if (company?.logo_url) {
      try {
        const logoBuffer = await this.getImageBuffer(company.logo_url);
        if (logoBuffer) {
          headerParagraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: new Uint8Array(logoBuffer),
                  transformation: {
                    width: 120,
                    height: 80,
                  },
                  type: 'png',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            })
          );
        }
      } catch (error) {
        console.error('Error adding logo to Word document:', error);
      }
    }

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
        spacing: { after: 200 },
      })
    );

    // Date range
    headerParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: this.getReportPeriodText(reportFilters),
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    return headerParagraphs;
  }

  private getReportPeriodText(reportFilters: any): string {
    const startDate = new Date(reportFilters.startDate);
    const endDate = new Date(reportFilters.endDate);
    const startTime = reportFilters.startTime || '00:00';
    const endTime = reportFilters.endTime || '23:59';
    
    if (reportFilters.reportType === 'daily') {
      return `Report Period: ${startDate.toLocaleDateString()} from ${startTime} to ${endTime}`;
    } else {
      return `Report Period: ${startDate.toLocaleDateString()} ${startTime} - ${endDate.toLocaleDateString()} ${endTime}`;
    }
  }

  private async createReportEntry(report: Report): Promise<(Paragraph | Table)[]> {
    const elements: (Paragraph | Table)[] = [];
    const reportDate = new Date(report.created_at);
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard';

    // Extract severity level from report text
    let severityLevel = 'none';
    let severityColor = 'D3D3D3'; // Light grey default
    if (report.report_text) {
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      const severityLine = lines.find(line => line.startsWith('Severity:'));
      if (severityLine) {
        severityLevel = severityLine.replace('Severity:', '').trim().toLowerCase();
        // Set color based on severity
        if (severityLevel === 'low') severityColor = 'D3D3D3'; // Light grey
        else if (severityLevel === 'medium') severityColor = 'EAB308'; // Yellow
        else if (severityLevel === 'high') severityColor = 'F97316'; // Orange
        else if (severityLevel === 'critical') severityColor = 'EF4444'; // Red
      }
    }

    // Create table for report entry
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: 'single', size: 1, color: 'DCDCDC' },
        bottom: { style: 'single', size: 1, color: 'DCDCDC' },
        left: { style: 'single', size: 1, color: 'DCDCDC' },
        right: { style: 'single', size: 1, color: 'DCDCDC' },
      },
      rows: [
        // Header row with colored background
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`,
                      bold: true,
                      size: 20,
                      color: severityLevel === 'none' || severityLevel === 'low' ? '000000' : 'FFFFFF',
                    }),
                  ],
                }),
              ],
              shading: { fill: severityColor },
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Issue ID: ${report.id.substring(0, 8).toUpperCase()}`,
                      size: 18,
                      color: severityLevel === 'none' || severityLevel === 'low' ? '000000' : 'DCDCDC',
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: { fill: severityColor },
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        // Guard and Location row
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Guard: ${guardName}`,
                      size: 18,
                    }),
                  ],
                  spacing: { before: 100, after: 50 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: report.location_address ? `Location: ${report.location_address}` : 'Location: Not specified',
                      size: 18,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
              ],
              columnSpan: 2,
              shading: { fill: 'FFFFFF' },
            }),
          ],
        }),
        // Description and Task row
        new TableRow({
          children: [
            new TableCell({
              children: this.getReportContentParagraphs(report),
              columnSpan: 2,
              shading: { fill: 'FFFFFF' },
            }),
          ],
        }),
      ],
    });

    elements.push(table);

    // Add spacing paragraph
    elements.push(
      new Paragraph({
        text: '',
        spacing: { after: 300 },
      })
    );

    // Add image if available
    if (report.image_url) {
      try {
        const imageBuffer = await this.getImageBuffer(report.image_url);
        if (imageBuffer) {
          elements.push(
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
              spacing: { before: 200, after: 400 },
            })
          );
        }
      } catch (error) {
        console.error('Error adding image to Word document:', error);
      }
    }

    return elements;
  }

  private getReportContentParagraphs(report: Report): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    if (report.report_text) {
      const lines = report.report_text.split('\n').filter(line => line.trim() !== '');
      
      lines.forEach(line => {
        if (line.startsWith('Description:')) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  size: 20,
                }),
              ],
              spacing: { before: 100, after: 100 },
            })
          );
        } else if (line.startsWith('Task:')) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.trim(),
                  bold: true,
                  size: 20,
                }),
              ],
              spacing: { before: 100, after: 100 },
            })
          );
        } else if (line.startsWith('Severity:')) {
          const severityValue = line.replace('Severity:', '').trim();
          let badgeColor = 'D3D3D3'; // Light grey
          if (severityValue.toLowerCase() === 'low') badgeColor = '16A34A'; // Green
          else if (severityValue.toLowerCase() === 'medium') badgeColor = 'EAB308'; // Yellow
          else if (severityValue.toLowerCase() === 'high') badgeColor = 'F97316'; // Orange
          else if (severityValue.toLowerCase() === 'critical') badgeColor = 'EF4444'; // Red
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: ` ${severityValue.toUpperCase()} `,
                  size: 18,
                  bold: true,
                  color: 'FFFFFF',
                  shading: { fill: badgeColor },
                }),
              ],
              spacing: { before: 100, after: 100 },
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
    const children: (Paragraph | Table)[] = [];

    // Add header (now async)
    const headerParagraphs = await this.createHeaderSection(company, reportFilters);
    children.push(...headerParagraphs);

    // Add each report
    for (const report of reports) {
      const reportElements = await this.createReportEntry(report);
      children.push(...reportElements);
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
    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
  }
}

export const generateWordReport = async (reports: Report[], company: Company | null, reportFilters: any) => {
  const generator = new WordReportGenerator();
  await generator.generateReport(reports, company, reportFilters);
};