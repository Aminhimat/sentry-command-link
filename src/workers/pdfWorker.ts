import { PDFDocument, rgb } from 'pdf-lib';
import imageCompression from 'browser-image-compression';

interface WorkerMessage {
  reports: any[];
  company: any;
  reportFilters: any;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const { reports, company, reportFilters } = e.data;
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Compress and process images in parallel
    const reportsWithImages = reports.filter(r => r.image_url);
    
    // Fetch and compress all images first
    const imagePromises = reportsWithImages.map(async (report) => {
      try {
        const response = await fetch(report.image_url);
        const blob = await response.blob();
        const file = new File([blob], 'image.jpg', { type: blob.type });
        
        // Compress image
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: false, // Already in a worker
          fileType: 'image/jpeg'
        });
        
        return {
          report,
          imageBytes: await compressed.arrayBuffer()
        };
      } catch (error) {
        console.error('Error loading image:', error);
        return { report, imageBytes: null };
      }
    });
    
    const compressedImages = await Promise.all(imagePromises);
    
    // Add header page
    const headerPage = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = headerPage.getSize();
    
    // Add company info
    headerPage.drawText(company?.name || 'Security Report', {
      x: 50,
      y: height - 100,
      size: 24,
      color: rgb(0, 0, 0)
    });
    
    headerPage.drawText(`Report Generated: ${new Date().toLocaleString()}`, {
      x: 50,
      y: height - 140,
      size: 12,
      color: rgb(0.3, 0.3, 0.3)
    });
    
    if (reportFilters?.dateFrom || reportFilters?.dateTo) {
      headerPage.drawText(
        `Period: ${reportFilters.dateFrom || 'Start'} - ${reportFilters.dateTo || 'End'}`,
        {
          x: 50,
          y: height - 165,
          size: 12,
          color: rgb(0.3, 0.3, 0.3)
        }
      );
    }
    
    // Add each report with compressed images
    for (const { report, imageBytes } of compressedImages) {
      const page = pdfDoc.addPage([595, 842]);
      const { width, height } = page.getSize();
      let yPos = height - 50;
      
      // Report details
      page.drawText(`Date: ${new Date(report.created_at).toLocaleString()}`, {
        x: 50,
        y: yPos,
        size: 10,
        color: rgb(0, 0, 0)
      });
      yPos -= 20;
      
      if (report.guard_name) {
        page.drawText(`Guard: ${report.guard_name}`, {
          x: 50,
          y: yPos,
          size: 10,
          color: rgb(0, 0, 0)
        });
        yPos -= 20;
      }
      
      if (report.location) {
        page.drawText(`Location: ${report.location}`, {
          x: 50,
          y: yPos,
          size: 10,
          color: rgb(0, 0, 0)
        });
        yPos -= 20;
      }
      
      // Add description text
      if (report.description) {
        const lines = report.description.match(/.{1,70}/g) || [];
        for (const line of lines.slice(0, 5)) {
          page.drawText(line, {
            x: 50,
            y: yPos,
            size: 9,
            color: rgb(0.2, 0.2, 0.2)
          });
          yPos -= 15;
        }
      }
      
      yPos -= 10;
      
      // Add image if available
      if (imageBytes) {
        try {
          const image = await pdfDoc.embedJpg(imageBytes);
          const imgDims = image.scale(0.4);
          const maxWidth = width - 100;
          const maxHeight = 450;
          
          let imgWidth = imgDims.width;
          let imgHeight = imgDims.height;
          
          if (imgWidth > maxWidth) {
            imgHeight = (imgHeight * maxWidth) / imgWidth;
            imgWidth = maxWidth;
          }
          
          if (imgHeight > maxHeight) {
            imgWidth = (imgWidth * maxHeight) / imgHeight;
            imgHeight = maxHeight;
          }
          
          page.drawImage(image, {
            x: (width - imgWidth) / 2,
            y: yPos - imgHeight,
            width: imgWidth,
            height: imgHeight
          });
        } catch (error) {
          console.error('Error embedding image:', error);
        }
      }
    }
    
    // Save PDF with optimizations
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    
    // Send back to main thread
    self.postMessage({ pdfBytes, success: true });
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ error: error.message, success: false });
  }
};
