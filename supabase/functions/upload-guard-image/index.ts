import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Server-side image compression is not needed since we compress on client-side
// This function now just validates and returns the file as-is
async function validateImageFile(file: File): Promise<File> {
  // Basic validation
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }
  
  // Size limit check (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image file too large (max 10MB)');
  }
  
  return file;
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
      .select('id, company_id, first_name, last_name, assigned_property_id')
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

    // Validate image file
    const validatedFile = await validateImageFile(file);
    
    // Generate filename
    const fileExt = validatedFile.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}_${Date.now()}.${fileExt}`

    // Get public URL before upload for immediate response
    const { data: urlData } = supabaseClient.storage
      .from('guard-reports')
      .getPublicUrl(fileName)

    const imageUrl = urlData.publicUrl
    
    // Resolve property/site info for historical accuracy
    const propertyId = profile.assigned_property_id ?? null;
    let siteName: string | null = reportData.site || null;
    
    if (!siteName && propertyId) {
      const { data: property } = await supabaseClient
        .from('properties')
        .select('name')
        .eq('id', propertyId)
        .maybeSingle();
      if (property?.name) {
        siteName = property.name;
      }
    }

    // Submit report immediately with image URL (optimistic update)
    const { error: reportError } = await supabaseClient
      .from('guard_reports')
      .insert({
        guard_id: profile.id,
        company_id: profile.company_id,
        property_id: propertyId,
        report_text: `Guard: ${profile.first_name} ${profile.last_name}\nTask: ${reportData.taskType}\nSite: ${siteName ?? ''}\nSeverity: ${reportData.severity}\nDescription: ${reportData.description}`,
        image_url: imageUrl,
        location_address: siteName,
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

    // Upload validated image in background with retry logic
    EdgeRuntime.waitUntil(
      (async () => {
        let uploadAttempts = 0;
        const maxAttempts = 3;
        
        while (uploadAttempts < maxAttempts) {
          try {
            const { error: uploadError } = await supabaseClient.storage
              .from('guard-reports')
              .upload(fileName, validatedFile, {
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