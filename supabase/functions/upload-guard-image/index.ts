import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Utility function to compress image
async function compressImage(file: File, maxSizeKB: number = 500): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    
    img.onload = () => {
      // Calculate new dimensions to maintain aspect ratio
      const MAX_WIDTH = 1200
      const MAX_HEIGHT = 1200
      let { width, height } = img
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width
          width = MAX_WIDTH
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = (width * MAX_HEIGHT) / height
          height = MAX_HEIGHT
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        } else {
          resolve(file) // Fallback to original
        }
      }, 'image/jpeg', 0.8) // 80% quality
    }
    
    img.src = URL.createObjectURL(file)
  })
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

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, company_id, first_name, last_name')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate filename
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}_${Date.now()}.${fileExt}`

    // Get public URL before upload for immediate response
    const { data: urlData } = supabaseClient.storage
      .from('guard-reports')
      .getPublicUrl(fileName)

    const imageUrl = urlData.publicUrl

    // Submit report immediately with image URL
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

    // Upload image in background for better performance
    EdgeRuntime.waitUntil(
      supabaseClient.storage
        .from('guard-reports')
        .upload(fileName, file)
        .then(({ error }) => {
          if (error) {
            console.error('Background image upload error:', error)
          } else {
            console.log('Background image upload completed for:', fileName)
          }
        })
    )

    if (reportError) {
      console.error('Report submission error:', reportError)
      return new Response(
        JSON.stringify({ error: 'Failed to submit report' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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