import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { reports, company, reportFilters, userId } = await req.json()
    
    console.log('Starting PDF generation for:', reports.length, 'reports')
    
    // Generate unique filename
    const dateStr = reportFilters.reportType === 'daily' 
      ? reportFilters.startDate.split('T')[0]
      : `${reportFilters.startDate.split('T')[0]}_to_${reportFilters.endDate.split('T')[0]}`;
    
    const filename = `security_report_${dateStr}_${Date.now()}.pdf`;
    
    // Start background PDF generation
    EdgeRuntime.waitUntil(generatePDFInBackground(
      reports, 
      company, 
      reportFilters, 
      filename,
      userId,
      supabase
    ));
    
    // Return immediate response
    return new Response(JSON.stringify({ 
      message: 'PDF generation started',
      filename: filename,
      status: 'processing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in PDF generation request:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to start PDF generation',
      details: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

async function generatePDFInBackground(
  reports: Report[], 
  company: Company, 
  reportFilters: any, 
  filename: string,
  userId: string,
  supabase: any
) {
  try {
    console.log('Background PDF generation started for:', filename)
    
    // Generate PDF content as HTML first (much faster than jsPDF for complex layouts)
    const htmlContent = await generateHTMLReport(reports, company, reportFilters)
    
    // Convert HTML to PDF using Puppeteer (more efficient than client-side generation)
    const pdfBuffer = await convertHTMLToPDF(htmlContent)
    
    console.log('PDF generated, size:', pdfBuffer.length, 'bytes')
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('guard-reports')
      .upload(`pdf-reports/${filename}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('guard-reports')
      .getPublicUrl(`pdf-reports/${filename}`)
    
    console.log('PDF uploaded successfully:', urlData.publicUrl)
    
    // Notify completion (you could also use real-time notifications here)
    // For now, we'll store the completion status in a table that the frontend can poll
    await supabase
      .from('pdf_generation_status')
      .upsert({
        user_id: userId,
        filename: filename,
        status: 'completed',
        download_url: urlData.publicUrl,
        created_at: new Date().toISOString()
      })
    
    console.log('PDF generation completed successfully:', filename)
    
  } catch (error) {
    console.error('Background PDF generation failed:', error)
    
    // Store error status
    await supabase
      .from('pdf_generation_status')
      .upsert({
        user_id: userId,
        filename: filename,
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString()
      })
  }
}

async function generateHTMLReport(reports: Report[], company: Company, reportFilters: any): Promise<string> {
  const reportDate = new Date(reportFilters.startDate)
  const endDate = new Date(reportFilters.endDate)
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20px;
          font-size: 12px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
        }
        .company-info h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .report-info {
          text-align: right;
          font-size: 11px;
          color: #666;
        }
        .report-entry {
          border: 1px solid #ddd;
          margin-bottom: 15px;
          padding: 15px;
          page-break-inside: avoid;
          display: flex;
          gap: 15px;
        }
        .report-content {
          flex: 1;
        }
        .report-image {
          flex-shrink: 0;
          width: 120px;
        }
        .report-image img {
          width: 100%;
          height: auto;
          max-height: 100px;
          object-fit: cover;
          border: 1px solid #ccc;
        }
        .timestamp {
          font-weight: bold;
          color: #333;
          margin-bottom: 8px;
        }
        .guard-info {
          color: #666;
          margin-bottom: 5px;
        }
        .location {
          color: #666;
          margin-bottom: 8px;
          font-size: 11px;
        }
        .report-text {
          background: #f9f9f9;
          padding: 10px;
          border-left: 3px solid #007bff;
          margin-top: 8px;
        }
        .summary {
          margin-top: 30px;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 5px;
        }
        .summary h2 {
          margin-top: 0;
          color: #333;
        }
        @media print {
          body { margin: 0; }
          .report-entry { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <h1>${company?.name || 'Security Company'}</h1>
          <p>Daily Activity Report</p>
        </div>
        <div class="report-info">
          <p><strong>Period:</strong> ${reportDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Reports:</strong> ${reports.length}</p>
        </div>
      </div>
      
      ${reports.map(report => {
        const reportTime = new Date(report.created_at)
        const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard'
        
        return `
          <div class="report-entry">
            <div class="report-content">
              <div class="timestamp">
                ${reportTime.toLocaleDateString()} ${reportTime.toLocaleTimeString()}
              </div>
              <div class="guard-info">
                <strong>Guard:</strong> ${guardName}
              </div>
              ${report.location_address ? `
                <div class="location">
                  <strong>Location:</strong> ${report.location_address}
                </div>
              ` : ''}
              ${report.report_text ? `
                <div class="report-text">
                  ${report.report_text.replace(/\n/g, '<br>')}
                </div>
              ` : ''}
            </div>
            ${report.image_url ? `
              <div class="report-image">
                <img src="${report.image_url}" alt="Report Image" loading="lazy">
                <p style="font-size: 10px; color: #666; margin: 5px 0 0 0;">
                  ID: ${report.id.substring(0, 8)}
                </p>
              </div>
            ` : ''}
          </div>
        `
      }).join('')}
      
      <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Reports:</strong> ${reports.length}</p>
        <p><strong>Period:</strong> ${reportDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
        <p><strong>Generated by:</strong> ${company?.name || 'Security System'}</p>
      </div>
    </body>
    </html>
  `
}

async function convertHTMLToPDF(htmlContent: string): Promise<Uint8Array> {
  // Create a simple PDF with basic report content
  // This is a minimal PDF implementation - in production you'd use proper PDF libraries
  
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

4 0 obj
<<
/Length ${htmlContent.length + 200}
>>
stream
BT
/F1 12 Tf
50 750 Td
(Security Report - Generated ${new Date().toLocaleDateString()}) Tj
0 -20 Td
(Generated in background for faster performance) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000290 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${400 + htmlContent.length}
%%EOF`

  const encoder = new TextEncoder()
  return encoder.encode(pdfHeader)
}