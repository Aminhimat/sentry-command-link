import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BulkDeleteRequest {
  companyId: string;
  deleteOlderThanDays?: number; // Optional: only delete reports older than X days
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the current user to verify they're a platform admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user is platform admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'platform_admin') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Platform admin role required.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { companyId, deleteOlderThanDays }: BulkDeleteRequest = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Starting bulk delete for company: ${companyId}`);

    // Build query for reports to delete
    let query = supabaseAdmin
      .from('guard_reports')
      .select('id, image_url')
      .eq('company_id', companyId);

    // If deleteOlderThanDays is specified, add date filter
    if (deleteOlderThanDays && deleteOlderThanDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - deleteOlderThanDays);
      query = query.lt('created_at', cutoffDate.toISOString());
    }

    // Get all reports that will be deleted
    const { data: reportsToDelete, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching reports:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reports for deletion' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!reportsToDelete || reportsToDelete.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No reports found to delete',
          deletedCount: 0,
          deletedImagesCount: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Found ${reportsToDelete.length} reports to delete`);

    // Extract image URLs for deletion
    const imageUrls = reportsToDelete
      .filter(report => report.image_url)
      .map(report => {
        // Extract the file path from the full URL
        // URL format: https://dzxkvzdwapaoeewqiyyq.supabase.co/storage/v1/object/public/guard-reports/filename.jpg
        const url = report.image_url;
        const pathMatch = url.match(/\/guard-reports\/(.+)$/);
        return pathMatch ? pathMatch[1] : null;
      })
      .filter(Boolean);

    console.log(`Found ${imageUrls.length} images to delete`);

    // Delete images from storage first
    let deletedImagesCount = 0;
    if (imageUrls.length > 0) {
      console.log('Deleting images from storage...');
      const { data: storageResult, error: storageError } = await supabaseAdmin.storage
        .from('guard-reports')
        .remove(imageUrls);

      if (storageError) {
        console.error('Error deleting images from storage:', storageError);
        // Continue with report deletion even if image deletion fails
      } else {
        deletedImagesCount = storageResult?.length || 0;
        console.log(`Successfully deleted ${deletedImagesCount} images from storage`);
      }
    }

    // Delete reports from database
    const reportIds = reportsToDelete.map(report => report.id);
    
    console.log('Deleting reports from database...');
    const { error: deleteError } = await supabaseAdmin
      .from('guard_reports')
      .delete()
      .in('id', reportIds);

    if (deleteError) {
      console.error('Error deleting reports:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete reports from database' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Successfully deleted ${reportsToDelete.length} reports`);

    return new Response(
      JSON.stringify({
        message: 'Reports deleted successfully',
        deletedCount: reportsToDelete.length,
        deletedImagesCount,
        companyId,
        ...(deleteOlderThanDays && { deleteOlderThanDays })
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in bulk delete function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});