// Edge runtime via Deno.serve is used; no need to import serve
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb } from 'npm:pdf-lib'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
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
    EdgeRuntime.waitUntil(generateReportBackground(reports, company, reportFilters, filename, userId, supabase))
    
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
  console.log('Starting PDF generation with pdf-lib...')
  console.time('pdf_generation_total')
  
  const pdfDoc = await PDFDocument.create()
  const margin = 20
  const fontSize = 12
  const titleFontSize = 20
  const captionSize = 10
  
  // Memory-safe approach: no global preloading; fetch per image just-in-time
  console.log('Preparing image transform settings...')
  const reportsWithImages = reports.filter((report) => report.image_url)

  // Ultra-conservative settings to avoid OOM with 280+ images
  const transform = { width: 512, quality: 50 }
  console.log('Transform settings:', transform, 'totalImages:', totalImages)

  // Process 2 images per page instead of 5 to reduce memory pressure
  const perPage = 2
  const cols = 1
  const rows = 2

  // Create header page
  let page = pdfDoc.addPage([595, 842]) // A4 size
  const pageWidth = 595
  const pageHeight = 842
  let yPosition = pageHeight - margin
  
  page.drawText('SECURITY REPORT', {
    x: margin,
    y: yPosition,
    size: titleFontSize,
    color: rgb(0, 0, 0),
  })
  yPosition -= 40

  page.drawText(`Company: ${company?.name || 'Security Company'}`, {
    x: margin,
    y: yPosition,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  yPosition -= 20
  
  const startDate = new Date(reportFilters.startDate)
  const endDate = new Date(reportFilters.endDate)
  page.drawText(`Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, {
    x: margin,
    y: yPosition,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  yPosition -= 20
  
  page.drawText(`Total Reports: ${reports.length}`, {
    x: margin,
    y: yPosition,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  yPosition -= 40

  // Layout already configured above (2 images per page, 1 column, 2 rows)
  const slotW = (pageWidth - margin * (cols + 1)) / cols
  const slotH = (pageHeight - margin * (rows + 1)) / rows

  // Process images in batches (sequential fetch to keep memory low)
  console.log(`Processing ${reportsWithImages.length} images, ${perPage} per page...`)
  for (let i = 0; i < reportsWithImages.length; i += perPage) {
    if (i % 20 === 0) {
      console.log(`Progress: ${i}/${reportsWithImages.length} images processed`)
    }
    page = pdfDoc.addPage([pageWidth, pageHeight])

    const batch = reportsWithImages.slice(i, i + perPage)

    for (let j = 0; j < batch.length; j++) {
      const report = batch[j]
      const col = j % cols
      const row = Math.floor(j / cols)
      const x = margin + col * (slotW + margin)
      const y = pageHeight - margin - (row + 1) * (slotH + margin)

      try {
        const imgBytes = await fetchImageAsBytes(report.image_url, transform.width, transform.quality)
        let image
        try {
          image = await pdfDoc.embedJpg(imgBytes)
        } catch {
          image = await pdfDoc.embedPng(imgBytes)
        }

        // Draw image with 15% space reserved for caption
        const imgHeight = slotH * 0.85
        page.drawImage(image, {
          x,
          y: y + 15,
          width: slotW,
          height: imgHeight,
        })

        // Add caption below image
        const reportTime = new Date(report.created_at)
        const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown'
        const caption = `${reportTime.toLocaleDateString()} ${reportTime.toLocaleTimeString()} - ${guardName}`

        page.drawText(caption, {
          x,
          y,
          size: captionSize,
          color: rgb(0.2, 0.2, 0.2),
          maxWidth: slotW,
        })
      } catch (err) {
        console.error('Error adding image to grid:', err)
        page.drawText('Image unavailable', {
          x,
          y: y + slotH / 2,
          size: captionSize,
          color: rgb(0.5, 0, 0),
        })
      }
    }
  }

  console.timeEnd('pdf_generation_total')
  return await pdfDoc.save()
}

async function fetchImageAsBytes(url: string, width = 512, quality = 50): Promise<Uint8Array> {
  // Use Supabase render CDN with JPEG conversion to reduce memory
  let fetchUrl = url
  try {
    if (url.includes('/storage/v1/object/public/')) {
      const u = new URL(url)
      const marker = '/storage/v1/object/public/'
      const idx = u.pathname.indexOf(marker)
      if (idx !== -1) {
        const after = u.pathname.slice(idx + marker.length)
        fetchUrl = `${u.origin}/storage/v1/render/image/public/${after}?width=${width}&quality=${quality}&resize=contain&format=jpeg`
      }
    }
  } catch (_) {
    fetchUrl = url
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Accept: 'image/jpeg,image/png,*/*' },
    })

    if (!response.ok) {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'image/*' },
      })
      return new Uint8Array(await resp.arrayBuffer())
    }

    return new Uint8Array(await response.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}
