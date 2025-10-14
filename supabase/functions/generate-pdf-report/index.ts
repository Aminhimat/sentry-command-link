import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsPDF } from 'https://esm.sh/jspdf@2.5.2'

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
    
    // Generate PDF with images on backend
    const pdfBlob = await generatePDFWithImages(reports, company, reportFilters)
    
    console.log('PDF generated, size:', pdfBlob.byteLength)
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('guard-reports')
      .upload(`reports/${filename.replace('.txt', '.pdf')}`, pdfBlob, {
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

async function generatePDFWithImages(reports: any[], company: any, reportFilters: any): Promise<Uint8Array> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let currentY = 20
  const margin = 10
  const lineHeight = 6

  // Header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('SECURITY REPORT', pageWidth / 2, currentY, { align: 'center' })
  currentY += 15

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Company: ${company?.name || 'Security Company'}`, margin, currentY)
  currentY += lineHeight
  
  const startDate = new Date(reportFilters.startDate)
  const endDate = new Date(reportFilters.endDate)
  doc.text(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, margin, currentY)
  currentY += lineHeight
  doc.text(`Total Reports: ${reports.length}`, margin, currentY)
  currentY += 15

  // Process each report
  for (let i = 0; i < reports.length; i++) {
    const report = reports[i]
    const reportTime = new Date(report.created_at)
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard'

    // Check if we need a new page
    if (currentY > pageHeight - 60) {
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`Report #${i + 1}`, margin, currentY)
    currentY += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${reportTime.toLocaleDateString()} ${reportTime.toLocaleTimeString()}`, margin, currentY)
    currentY += lineHeight
    doc.text(`Guard: ${guardName}`, margin, currentY)
    currentY += lineHeight

    if (report.location_address) {
      doc.text(`Location: ${report.location_address}`, margin, currentY)
      currentY += lineHeight
    }

    if (report.report_text) {
      const textLines = doc.splitTextToSize(report.report_text, pageWidth - 2 * margin)
      doc.text(textLines, margin, currentY)
      currentY += textLines.length * lineHeight
    }

    // Add image if exists
    if (report.image_url) {
      try {
        currentY += 5
        const imgData = await fetchImageAsBase64(report.image_url)
        const imgWidth = 80
        const imgHeight = 60
        
        if (currentY + imgHeight > pageHeight - margin) {
          doc.addPage()
          currentY = 20
        }
        
        doc.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight, undefined, 'FAST')
        currentY += imgHeight + 5
      } catch (err) {
        console.error('Error adding image:', err)
        doc.text('Image unavailable', margin, currentY)
        currentY += lineHeight
      }
    }

    currentY += 10
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:image/jpeg;base64,${btoa(binary)}`
}
