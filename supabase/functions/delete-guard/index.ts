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

    // Try to delete the user from Supabase Auth (if exists)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      guardProfile.user_id
    );

    // Log auth deletion result but don't fail if user not found
    if (deleteUserError && deleteUserError.status !== 404) {
      console.error('Error deleting auth user:', deleteUserError);
    } else if (deleteUserError?.status === 404) {
      console.log('Auth user not found, will delete profile and related records directly');
    } else {
      console.log('Auth user deleted successfully');
    }

    // Delete related records and unlink reports/incidents
    console.log('Deleting related guard records...');

    // Unlink guard reports (keep reports but set guard_id to null)
    const { error: reportsUnlinkError } = await supabaseAdmin
      .from('guard_reports')
      .update({ guard_id: null })
      .eq('guard_id', body.guardId);

    if (reportsUnlinkError) {
      console.error('Error unlinking guard reports:', reportsUnlinkError);
    } else {
      console.log('Guard reports unlinked successfully');
    }

    // Delete guard shifts
    const { error: shiftsDeleteError } = await supabaseAdmin
      .from('guard_shifts')
      .delete()
      .eq('guard_id', body.guardId);

    if (shiftsDeleteError) {
      console.error('Error deleting guard shifts:', shiftsDeleteError);
    } else {
      console.log('Guard shifts deleted successfully');
    }

    // Delete guard locations
    const { error: locationsDeleteError } = await supabaseAdmin
      .from('guard_locations')
      .delete()
      .eq('guard_id', body.guardId);

    if (locationsDeleteError) {
      console.error('Error deleting guard locations:', locationsDeleteError);
    } else {
      console.log('Guard locations deleted successfully');
    }

    // Delete guard login constraints
    const { error: constraintsDeleteError } = await supabaseAdmin
      .from('guard_login_constraints')
      .delete()
      .eq('guard_id', body.guardId);

    if (constraintsDeleteError) {
      console.error('Error deleting login constraints:', constraintsDeleteError);
    } else {
      console.log('Guard login constraints deleted successfully');
    }

    // Delete scheduled shifts
    const { error: scheduledShiftsDeleteError } = await supabaseAdmin
      .from('scheduled_shifts')
      .delete()
      .eq('guard_id', body.guardId);

    if (scheduledShiftsDeleteError) {
      console.error('Error deleting scheduled shifts:', scheduledShiftsDeleteError);
    } else {
      console.log('Scheduled shifts deleted successfully');
    }

    // Unlink incidents (keep incidents but set guard_id to null)
    const { error: incidentsUnlinkError } = await supabaseAdmin
      .from('incidents')
      .update({ guard_id: null })
      .eq('guard_id', body.guardId);

    if (incidentsUnlinkError) {
      console.error('Error unlinking incidents:', incidentsUnlinkError);
    } else {
      console.log('Incidents unlinked successfully');
    }

    // Finally, delete the profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', body.guardId);

    if (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete guard profile' }),
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