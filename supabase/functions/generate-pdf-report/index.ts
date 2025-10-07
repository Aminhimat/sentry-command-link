import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"

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
    
    console.log('Starting background generation for:', filename)
    
    // Start background processing
    generateReportBackground(reports, company, reportFilters, filename, userId, supabase)
    
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

async function generateReportBackground(
  reports: any[], 
  company: any, 
  reportFilters: any, 
  filename: string,
  userId: string,
  supabase: any
) {
  try {
    console.log('Background generation started for:', filename)
    
    // Insert processing status
    await supabase
      .from('pdf_generation_status')
      .insert({
        user_id: userId,
        filename: filename,
        status: 'processing'
      })
    
    // Generate PDF report
    const pdfDoc = generatePDFReport(reports, company, reportFilters)
    
    console.log('PDF generated successfully')
    
    // Convert to blob
    const reportBlob = pdfDoc.output('arraybuffer')
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('guard-reports')
      .upload(`reports/${filename.replace('.txt', '.pdf')}`, reportBlob, {
        contentType: 'application/pdf',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }
    
    console.log('File uploaded successfully')
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('guard-reports')
      .getPublicUrl(`reports/${filename.replace('.txt', '.pdf')}`)
    
    console.log('Public URL generated:', urlData.publicUrl)
    
    // Update status to completed
    await supabase
      .from('pdf_generation_status')
      .update({
        status: 'completed',
        download_url: urlData.publicUrl
      })
      .eq('filename', filename)
      .eq('user_id', userId)
    
    console.log('Status updated to completed')
    
  } catch (error) {
    console.error('Background generation failed:', error)
    
    // Update status to failed
    await supabase
      .from('pdf_generation_status')
      .upsert({
        user_id: userId,
        filename: filename,
        status: 'failed',
        error_message: error.message
      })
  }
}

function generatePDFReport(reports: any[], company: any, reportFilters: any): any {
  console.log('Generating PDF report for', reports.length, 'reports')
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })
  
  const reportDate = new Date(reportFilters.startDate)
  const endDate = new Date(reportFilters.endDate)
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20
  
  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('SECURITY REPORT', pageWidth / 2, yPos, { align: 'center' })
  
  yPos += 15
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Company: ${company?.name || 'Security Company'}`, 20, yPos)
  
  yPos += 7
  doc.text(`Period: ${reportDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 20, yPos)
  
  yPos += 7
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPos)
  
  yPos += 7
  doc.text(`Total Reports: ${reports.length}`, 20, yPos)
  
  yPos += 15
  
  // Reports
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('DETAILED REPORTS', 20, yPos)
  yPos += 10
  
  reports.forEach((report, index) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    
    const reportTime = new Date(report.created_at)
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard'
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`Report #${index + 1}`, 20, yPos)
    yPos += 6
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Date: ${reportTime.toLocaleDateString()} ${reportTime.toLocaleTimeString()}`, 20, yPos)
    yPos += 5
    
    doc.text(`Guard: ${guardName}`, 20, yPos)
    yPos += 5
    
    if (report.location_address) {
      const addressLines = doc.splitTextToSize(`Location: ${report.location_address}`, pageWidth - 40)
      doc.text(addressLines, 20, yPos)
      yPos += 5 * addressLines.length
    }
    
    if (report.report_text) {
      const textLines = doc.splitTextToSize(`Details: ${report.report_text}`, pageWidth - 40)
      doc.text(textLines, 20, yPos)
      yPos += 5 * textLines.length
    }
    
    yPos += 5
    doc.setDrawColor(200)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 8
  })
  
  // Summary
  if (yPos > 240) {
    doc.addPage()
    yPos = 20
  }
  
  yPos += 5
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SUMMARY', 20, yPos)
  yPos += 10
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Reports: ${reports.length}`, 20, yPos)
  yPos += 6
  doc.text(`Period: ${reportDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 20, yPos)
  yPos += 6
  doc.text(`Generated by: ${company?.name || 'Security System'}`, 20, yPos)
  
  return doc
}