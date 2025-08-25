import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

interface DeleteGuardRequest {
  guardId: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DeleteGuardRequest = await req.json();
    console.log('Delete guard request:', body);

    if (!body.guardId) {
      return new Response(
        JSON.stringify({ error: 'Guard ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the guard's profile to find user_id
    const { data: guardProfile, error: guardError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, first_name, last_name')
      .eq('id', body.guardId)
      .single();

    if (guardError || !guardProfile) {
      console.error('Error finding guard:', guardError);
      return new Response(
        JSON.stringify({ error: 'Guard not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Delete the user from Supabase Auth (this will cascade to delete the profile)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      guardProfile.user_id
    );

    if (deleteUserError) {
      console.error('Error deleting user:', deleteUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete guard user account' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully deleted guard: ${guardProfile.first_name} ${guardProfile.last_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Guard ${guardProfile.first_name} ${guardProfile.last_name} deleted successfully` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in delete-guard function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);