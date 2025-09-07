import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Optimized image compression for slow connections
async function compressImage(file: File, maxSizeKB: number = 300): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate optimal dimensions for slow connections
        let { width, height } = calculateOptimalSize(img.width, img.height, maxSizeKB);
        
        canvas.width = width;
        canvas.height = height;
        
        if (ctx) {
          // Use better quality scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Progressive quality reduction until target size is met
          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  if (blob.size <= maxSizeKB * 1024 || quality <= 0.3) {
                    const compressedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    });
                    resolve(compressedFile);
                  } else {
                    quality -= 0.1;
                    tryCompress();
                  }
                } else {
                  reject(new Error('Failed to compress image'));
                }
              },
              'image/jpeg',
              quality
            );
          };
          
          tryCompress();
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function calculateOptimalSize(originalWidth: number, originalHeight: number, maxSizeKB: number) {
  // More aggressive size reduction for slow connections
  const maxDimension = maxSizeKB < 200 ? 1280 : maxSizeKB < 400 ? 1600 : 1920;
  
  let width = originalWidth;
  let height = originalHeight;
  
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = (height * maxDimension) / width;
      width = maxDimension;
    } else {
      width = (width * maxDimension) / height;
      height = maxDimension;
    }
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const formData = await req.formData()
    const file = formData.get('image') as File
    const reportData = JSON.parse(formData.get('reportData') as string)

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No image file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user profile with better error handling
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, company_id, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Database error while fetching profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Compress image for better performance on slow connections
    const compressedFile = await compressImage(file, 300); // 300KB max for better upload speed
    
    // Generate filename
    const fileExt = compressedFile.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}_${Date.now()}.${fileExt}`

    // Get public URL before upload for immediate response
    const { data: urlData } = supabaseClient.storage
      .from('guard-reports')
      .getPublicUrl(fileName)

    const imageUrl = urlData.publicUrl

    // Submit report immediately with image URL (optimistic update)
    const { error: reportError } = await supabaseClient
      .from('guard_reports')
      .insert({
        guard_id: profile.id,
        company_id: profile.company_id,
        report_text: `Guard: ${profile.first_name} ${profile.last_name}\nTask: ${reportData.taskType}\nSite: ${reportData.site}\nSeverity: ${reportData.severity}\nDescription: ${reportData.description}`,
        image_url: imageUrl,
        location_address: reportData.site,
        location_lat: reportData.location?.latitude,
        location_lng: reportData.location?.longitude
      })

    if (reportError) {
      console.error('Report submission error:', reportError)
      return new Response(
        JSON.stringify({ error: 'Failed to submit report to database' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Upload compressed image in background with retry logic
    EdgeRuntime.waitUntil(
      (async () => {
        let uploadAttempts = 0;
        const maxAttempts = 3;
        
        while (uploadAttempts < maxAttempts) {
          try {
            const { error: uploadError } = await supabaseClient.storage
              .from('guard-reports')
              .upload(fileName, compressedFile, {
                cacheControl: '3600',
                upsert: true
              });
              
            if (uploadError) {
              throw uploadError;
            }
            
            console.log(`Background image upload completed for: ${fileName}`);
            break;
          } catch (error) {
            uploadAttempts++;
            console.error(`Upload attempt ${uploadAttempts} failed:`, error);
            
            if (uploadAttempts < maxAttempts) {
              // Wait before retry with exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, uploadAttempts) * 1000));
            } else {
              console.error(`Failed to upload image after ${maxAttempts} attempts:`, error);
            }
          }
        }
      })()
    )

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Report submitted successfully',
        imageUrl 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in upload-guard-image function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})