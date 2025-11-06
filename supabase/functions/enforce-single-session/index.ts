import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enforcing single session for user: ${userId}`);

    // Get all sessions for this user using Admin API
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to get user data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User found, revoking refresh tokens`);

    // Revoke ALL refresh tokens for this user by deleting them from the database
    // This prevents other sessions from being able to refresh
    const { error: deleteError } = await supabaseAdmin
      .from('auth.refresh_tokens')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('Error deleting refresh tokens:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to revoke refresh tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully revoked all refresh tokens for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'All other sessions signed out' }),
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
