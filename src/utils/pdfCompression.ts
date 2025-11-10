/**
 * Advanced PDF compression utilities
 * Compresses final PDF files for faster downloads
 */
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

export interface PDFCompressionSettings {
  quality: 'recommended' | 'high' | 'low';
}

const QUALITY_SETTINGS = {
  recommended: 0.3,  // Good balance
  high: 0.15,        // Smaller size, more compression
  low: 0.6,          // Better quality, larger size
};

/**
 * Get compression options for jsPDF save
 */
export function getPDFCompressionOptions() {
  return {
    compress: true,
    precision: 2,
    userUnit: 1.0
  };
}

/**
 * Compress a PDF blob using pdf-lib with optimized settings
 * @param pdfBlob - The PDF blob to compress
 * @param quality - Compression quality setting
 * @returns Compressed PDF blob
 */
export async function compressPDFBlob(
  pdfBlob: Blob,
  quality: 'recommended' | 'high' | 'low' = 'recommended'
): Promise<Blob> {
  try {
    console.log('Starting PDF-level compression...');
    console.log('Original PDF size:', (pdfBlob.size / (1024 * 1024)).toFixed(2), 'MB');
    
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });

    // Remove unnecessary metadata to reduce size
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    // Save with maximum compression options
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 200,
      updateFieldAppearances: false,
    });

    const compressionRatio = ((1 - compressedBytes.length / pdfBlob.size) * 100);
    
    console.log('PDF compression complete:');
    console.log('- Original size:', (pdfBlob.size / (1024 * 1024)).toFixed(2), 'MB');
    console.log('- Compressed size:', (compressedBytes.length / (1024 * 1024)).toFixed(2), 'MB');
    console.log('- Compression ratio:', compressionRatio.toFixed(1) + '%');

    // Create a new Uint8Array to ensure proper type
    const uint8Array = new Uint8Array(compressedBytes);
    return new Blob([uint8Array], { type: 'application/pdf' });
  } catch (error) {
    console.error('Error compressing PDF:', error);
    console.log('Returning original PDF without compression');
    // Return original if compression fails
    return pdfBlob;
  }
}

/**
 * Save jsPDF with compression
 * @param pdf - jsPDF instance
 * @param filename - Output filename
 */
export async function saveCompressedPDF(pdf: jsPDF, filename: string): Promise<void> {
  // Generate PDF blob
  const pdfBlob = pdf.output('blob') as Blob;
  
  // Further compress using pdf-lib
  const compressedBlob = await compressPDFBlob(pdfBlob, 'recommended');
  
  // Download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(compressedBlob);
  link.download = filename;
  link.click();
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(link.href), 100);
}
