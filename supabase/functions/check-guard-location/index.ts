import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate distance between two coordinates using Haversine formula (returns distance in miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { currentLat, currentLng } = await req.json();

    if (!currentLat || !currentLng) {
      return new Response(
        JSON.stringify({ error: 'Current location coordinates are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get guard profile with login location
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, role, login_location_lat, login_location_lng, requires_admin_approval')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only check location for guards
    if (profile.role !== 'guard') {
      return new Response(
        JSON.stringify({ withinRange: true, message: 'Not a guard' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if guard already requires approval
    if (profile.requires_admin_approval) {
      return new Response(
        JSON.stringify({ withinRange: false, requiresApproval: true, message: 'Guard requires admin approval' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if login location exists
    if (!profile.login_location_lat || !profile.login_location_lng) {
      console.log('No login location stored for guard');
      return new Response(
        JSON.stringify({ withinRange: true, message: 'No login location stored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance from login location
    const distance = calculateDistance(
      Number(profile.login_location_lat),
      Number(profile.login_location_lng),
      Number(currentLat),
      Number(currentLng)
    );

    console.log(`Guard distance from login location: ${distance.toFixed(2)} miles`);

    // If distance exceeds 1 mile, mark for approval and sign out
    if (distance > 1) {
      console.log(`Guard exceeded 1 mile limit. Marking for approval and signing out.`);

      // Update profile to require admin approval
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          requires_admin_approval: true,
          approval_reason: `Moved ${distance.toFixed(2)} miles away from login location`
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      }

      // Sign out the user using admin API
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user.id);
      
      if (signOutError) {
        console.error('Error signing out user:', signOutError);
      }

      return new Response(
        JSON.stringify({ 
          withinRange: false, 
          requiresApproval: true,
          distance: distance.toFixed(2),
          message: 'Guard moved too far from login location and has been logged out'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        withinRange: true, 
        distance: distance.toFixed(2),
        message: 'Guard within allowed range'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
