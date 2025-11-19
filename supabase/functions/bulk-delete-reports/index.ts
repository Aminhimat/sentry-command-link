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

    // Track total deletions across all batches
    let totalDeletedReports = 0;
    let totalDeletedImages = 0;
    let hasMoreReports = true;
    const fetchBatchSize = 1000; // Fetch in batches of 1000
    
    // Keep deleting until no more reports match the criteria
    while (hasMoreReports) {
      // Build query for reports to delete - fetch in batches
      let query = supabaseAdmin
        .from('guard_reports')
        .select('id, image_url')
        .eq('company_id', companyId)
        .limit(fetchBatchSize);

      // If deleteOlderThanDays is specified, add date filter
      if (deleteOlderThanDays && deleteOlderThanDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - deleteOlderThanDays);
        query = query.lt('created_at', cutoffDate.toISOString());
      }

      // Get batch of reports to delete
      const { data: reportsToDelete, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching reports:', fetchError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch reports for deletion',
            partiallyDeleted: totalDeletedReports 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // If no reports found, we're done
      if (!reportsToDelete || reportsToDelete.length === 0) {
        hasMoreReports = false;
        break;
      }

      console.log(`Found ${reportsToDelete.length} reports in this batch (total so far: ${totalDeletedReports})`);

      // Extract image URLs for deletion
      const imageUrls = reportsToDelete
        .filter(report => report.image_url)
        .map(report => {
          const url = report.image_url;
          const pathMatch = url.match(/\/guard-reports\/(.+)$/);
          return pathMatch ? pathMatch[1] : null;
        })
        .filter(Boolean);

      // Delete images from storage (in batches of 100)
      if (imageUrls.length > 0) {
        const imageBatchSize = 100;
        for (let i = 0; i < imageUrls.length; i += imageBatchSize) {
          const batch = imageUrls.slice(i, i + imageBatchSize);
          const { data: storageResult, error: storageError } = await supabaseAdmin.storage
            .from('guard-reports')
            .remove(batch);

          if (!storageError) {
            totalDeletedImages += storageResult?.length || 0;
          }
        }
      }

      // Delete reports from database
      const reportIds = reportsToDelete.map(report => report.id);
      const { error: deleteError } = await supabaseAdmin
        .from('guard_reports')
        .delete()
        .in('id', reportIds);

      if (deleteError) {
        console.error('Error deleting reports:', deleteError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to delete reports from database',
            partiallyDeleted: totalDeletedReports,
            details: deleteError.message
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      totalDeletedReports += reportIds.length;
      console.log(`Deleted ${reportIds.length} reports in this batch (total: ${totalDeletedReports})`);

      // If we got less than fetchBatchSize, we've deleted all matching reports
      if (reportsToDelete.length < fetchBatchSize) {
        hasMoreReports = false;
      }
    }

    console.log(`Bulk delete complete: ${totalDeletedReports} reports and ${totalDeletedImages} images deleted`);

    // Handle case where no reports were found at all
    if (totalDeletedReports === 0) {
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

    return new Response(
      JSON.stringify({
        message: 'Reports deleted successfully',
        deletedCount: totalDeletedReports,
        deletedImagesCount: totalDeletedImages,
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