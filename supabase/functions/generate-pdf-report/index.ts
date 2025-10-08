import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @deno-types="npm:@types/jspdf@^2.0.0"
import jsPDF from "npm:jspdf@^2.5.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('PDF generation request received:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { reports, company, reportFilters, userId } = await req.json()
    
    console.log('Received data:', {
      reportsCount: reports?.length || 0,
      companyName: company?.name,
      userId: userId
    })
    
    // Generate unique filename
    const dateStr = reportFilters.reportType === 'daily' 
      ? reportFilters.startDate.split('T')[0]
      : `${reportFilters.startDate.split('T')[0]}_to_${reportFilters.endDate.split('T')[0]}`;
    
    const filename = `security_report_${dateStr}_${Date.now()}.txt`;
    
    console.log('Generating PDF:', filename)
    
    // Generate PDF synchronously (fast on server)
    const downloadUrl = await generateReportBackground(reports, company, reportFilters, filename, userId, supabase)
    
    // Return download URL
    return new Response(JSON.stringify({ 
      message: 'PDF generated successfully',
      downloadUrl: downloadUrl,
      status: 'completed'
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

async function generateReportBackground(
  reports: any[], 
  company: any, 
  reportFilters: any, 
  filename: string,
  userId: string,
  supabase: any
) {
  try {
    console.log('Background PDF generation started for:', filename)
    
    // Generate PDF with optimized settings
    const pdfBytes = await generatePDFDocument(reports, company, reportFilters)
    
    console.log('PDF generated, size:', pdfBytes.length, 'bytes')
    
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('guard-reports')
      .upload(`reports/${filename.replace('.txt', '.pdf')}`, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }
    
    console.log('PDF uploaded successfully')
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('guard-reports')
      .getPublicUrl(`reports/${filename.replace('.txt', '.pdf')}`)
    
    console.log('Download URL:', urlData.publicUrl)
    
    // Return success (no need for status table)
    return urlData.publicUrl
    
  } catch (error) {
    console.error('PDF generation failed:', error)
    throw error
  }
}

async function generatePDFDocument(reports: any[], company: any, reportFilters: any): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true
  })
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  let currentY = margin
  
  // Helper: Add new page if needed
  const addPageIfNeeded = (requiredHeight: number) => {
    if (currentY + requiredHeight > pageHeight - margin) {
      doc.addPage()
      currentY = margin
      return true
    }
    return false
  }
  
  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Daily Activity Report', pageWidth / 2, currentY, { align: 'center' })
  currentY += 10
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(company?.name || 'Security Company', margin, currentY)
  currentY += 8
  
  // Date info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const startDate = new Date(reportFilters.startDate)
  const endDate = new Date(reportFilters.endDate)
  doc.text(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, margin, currentY)
  currentY += 6
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, currentY)
  currentY += 10
  
  // Reports
  reports.forEach((report: any, index: number) => {
    addPageIfNeeded(45)
    
    const reportDate = new Date(report.created_at)
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard'
    
    // Extract severity
    let severityLevel = 'none'
    if (report.report_text) {
      const lines = report.report_text.split('\n').filter((line: string) => line.trim() !== '')
      const severityLine = lines.find((line: string) => line.startsWith('Severity:'))
      if (severityLine) {
        severityLevel = severityLine.replace('Severity:', '').trim().toLowerCase()
      }
    }
    
    // Header background color based on severity
    let headerColor: [number, number, number] = [220, 220, 220]
    if (severityLevel === 'critical') headerColor = [239, 68, 68]
    else if (severityLevel === 'high') headerColor = [249, 115, 22]
    else if (severityLevel === 'medium') headerColor = [234, 179, 8]
    
    // Entry background
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, currentY, pageWidth - 2 * margin, 40, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.rect(margin, currentY, pageWidth - 2 * margin, 40, 'S')
    
    // Header
    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2])
    doc.rect(margin, currentY, pageWidth - 2 * margin, 7, 'F')
    
    // Header text
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(severityLevel === 'none' || severityLevel === 'low' ? 0 : 255)
    doc.text(`${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`, margin + 5, currentY + 5)
    
    const reportIdText = `Issue ID: ${report.id.substring(0, 8)}`
    doc.setFontSize(8)
    doc.text(reportIdText, pageWidth - margin - 5 - doc.getTextWidth(reportIdText), currentY + 5)
    
    currentY += 10
    
    // Body
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Guard: ${guardName}`, margin + 5, currentY)
    currentY += 5
    
    if (report.location_address) {
      const locationText = `Location: ${report.location_address}`
      const wrapped = doc.splitTextToSize(locationText, 80)
      doc.text(wrapped.slice(0, 2), margin + 5, currentY)
      currentY += 5
    }
    
    if (report.report_text) {
      const lines = report.report_text.split('\n').filter((line: string) => line.trim() !== '')
      const descLine = lines.find((line: string) => line.startsWith('Description:'))
      if (descLine) {
        const desc = descLine.replace('Description:', '').trim()
        const wrapped = doc.splitTextToSize(desc, 90)
        doc.text(wrapped.slice(0, 3), margin + 5, currentY)
      }
    }
    
    currentY += 35
  })
  
  // Get PDF as Uint8Array
  const pdfOutput = doc.output('arraybuffer')
  return new Uint8Array(pdfOutput)
}