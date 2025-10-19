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
  const margin = 50
  const fontSize = 12
  const titleFontSize = 20
  const reportTitleSize = 14
  
  // Preload images with optimized batching
  console.log('Preloading images...')
  console.time('image_preload_total')
  const reportsWithImages = reports.filter(report => report.image_url)
  const imageCache = new Map()
  
  // Higher quality settings: better resolution for sharper images
  const totalImages = reportsWithImages.length
  const transform = totalImages <= 10
    ? { width: 1600, quality: 95 }
    : totalImages <= 30
      ? { width: 1400, quality: 90 }
      : { width: 1200, quality: 85 }

  // Higher concurrency for faster batch processing
  const batchSize = totalImages > 50 ? 12 : 10

  for (let i = 0; i < reportsWithImages.length; i += batchSize) {
    const batch = reportsWithImages.slice(i, i + batchSize)
    const batchPromises = batch.map(async (report) => {
      try {
        const imgBytes = await fetchImageAsBytes(report.image_url, transform.width, transform.quality)
        return { url: report.image_url, bytes: imgBytes }
      } catch (err) {
        console.error('Error preloading image:', err)
        return { url: report.image_url, bytes: null }
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    batchResults.forEach(img => {
      if (img.bytes) imageCache.set(img.url, img.bytes)
    })

    console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reportsWithImages.length / batchSize)} complete`)
  }
  
  console.timeEnd('image_preload_total')
  console.log(`Cached ${imageCache.size} images`)

  // Create header page
  let page = pdfDoc.addPage([612, 792]) // Letter size
  let yPosition = page.getHeight() - margin
  
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

  // Process each report
  for (let i = 0; i < reports.length; i++) {
    const report = reports[i]
    const reportTime = new Date(report.created_at)
    const guardName = report.guard ? `${report.guard.first_name} ${report.guard.last_name}` : 'Unknown Guard'

    // Check if we need a new page for text
    if (yPosition < 200) {
      page = pdfDoc.addPage([612, 792])
      yPosition = page.getHeight() - margin
    }

    page.drawText(`Report #${i + 1}`, {
      x: margin,
      y: yPosition,
      size: reportTitleSize,
      color: rgb(0, 0, 0),
    })
    yPosition -= 25

    page.drawText(`Date: ${reportTime.toLocaleDateString()} ${reportTime.toLocaleTimeString()}`, {
      x: margin,
      y: yPosition,
      size: fontSize - 2,
      color: rgb(0.2, 0.2, 0.2),
    })
    yPosition -= 15
    
    page.drawText(`Guard: ${guardName}`, {
      x: margin,
      y: yPosition,
      size: fontSize - 2,
      color: rgb(0.2, 0.2, 0.2),
    })
    yPosition -= 15

    if (report.location_address) {
      page.drawText(`Location: ${report.location_address}`, {
        x: margin,
        y: yPosition,
        size: fontSize - 2,
        color: rgb(0.2, 0.2, 0.2),
      })
      yPosition -= 15
    }

    if (report.report_text) {
      // Split text into lines to fit page width
      const maxWidth = page.getWidth() - 2 * margin
      const words = report.report_text.split(' ')
      let line = ''
      
      for (const word of words) {
        const testLine = line + word + ' '
        const testWidth = (testLine.length * (fontSize - 2) * 0.5) // Approximate width
        
        if (testWidth > maxWidth && line.length > 0) {
          page.drawText(line, {
            x: margin,
            y: yPosition,
            size: fontSize - 2,
            color: rgb(0, 0, 0),
          })
          yPosition -= 15
          line = word + ' '
          
          if (yPosition < 150) {
            page = pdfDoc.addPage([612, 792])
            yPosition = page.getHeight() - margin
          }
        } else {
          line = testLine
        }
      }
      
      if (line.length > 0) {
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize - 2,
          color: rgb(0, 0, 0),
        })
        yPosition -= 20
      }
    }

    // Add image if exists (use cached version)
    if (report.image_url) {
      const imgBytes = imageCache.get(report.image_url)
      if (imgBytes) {
        try {
          // Embed image
          const image = report.image_url.toLowerCase().includes('.png')
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes)
          
          const imgDims = image.scale(0.4) // Higher quality source, smaller display
          const maxImgWidth = (page.getWidth() - 2 * margin) * 0.75 // 75% of page width
          const maxImgHeight = 350
          
          let imgWidth = imgDims.width
          let imgHeight = imgDims.height
          
          // Scale to fit page width
          if (imgWidth > maxImgWidth) {
            const scale = maxImgWidth / imgWidth
            imgWidth = maxImgWidth
            imgHeight = imgHeight * scale
          }
          
          // Scale to fit max height
          if (imgHeight > maxImgHeight) {
            const scale = maxImgHeight / imgHeight
            imgHeight = maxImgHeight
            imgWidth = imgWidth * scale
          }
          
          // New page for image if needed
          if (yPosition - imgHeight < margin) {
            page = pdfDoc.addPage([612, 792])
            yPosition = page.getHeight() - margin
          }
          
          page.drawImage(image, {
            x: margin,
            y: yPosition - imgHeight,
            width: imgWidth,
            height: imgHeight,
          })
          
          yPosition -= (imgHeight + 20)
        } catch (err) {
          console.error('Error adding image:', err)
          page.drawText('Image unavailable', {
            x: margin,
            y: yPosition,
            size: fontSize - 2,
            color: rgb(0.5, 0, 0),
          })
          yPosition -= 20
        }
      }
    }

    yPosition -= 30
  }

  console.timeEnd('pdf_generation_total')
  return await pdfDoc.save()
}

async function fetchImageAsBytes(url: string, width = 1400, quality = 90): Promise<Uint8Array> {
  // Use Supabase render CDN for optimized images
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
  const timeout = setTimeout(() => controller.abort(), 12000)
  
  try {
    const response = await fetch(fetchUrl, { 
      signal: controller.signal, 
      headers: { Accept: 'image/jpeg,image/png,*/*' } 
    })
    
    if (!response.ok) {
      // Fallback to original
      const resp = await fetch(url, { headers: { Accept: 'image/*' } })
      return new Uint8Array(await resp.arrayBuffer())
    }

    return new Uint8Array(await response.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}
