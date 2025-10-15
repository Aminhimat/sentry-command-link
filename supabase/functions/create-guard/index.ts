import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateGuardRequest {
  firstName: string;
  lastName: string;
  email?: string;
  username: string;
  password: string;
  companyId: string;
  assignedPropertyId?: string | null;
  userToken?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('create-guard function called, method:', req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing create-guard request...');
    
    // Parse the request body
    const requestBody = await req.json();
    console.log('Request body received:', { ...requestBody, password: '[REDACTED]' });
    
    const { firstName, lastName, username, password, companyId, assignedPropertyId, userToken }: CreateGuardRequest = requestBody;

    // Validate input data
    if (!firstName || !lastName || !username || !password || !companyId) {
      console.error('Missing required fields:', { firstName: !!firstName, lastName: !!lastName, username: !!username, password: !!password, companyId: !!companyId });
      throw new Error('Missing required fields');
    }

    // Generate email from username if not provided
    const email = `${username}@company.local`;
    console.log('Generated email:', email);

    // Validate password strength
    if (password.length < 6) {
      console.error('Password too short:', password.length);
      throw new Error('Password must be at least 6 characters long');
    }

    console.log('Input validation passed');

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase admin client created');

    // If we have a user token, verify the user is a company admin
    if (userToken) {
      console.log('Verifying user token...');
      
      // Create a simple client with the user token
      const userSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      
      // Try to verify the user with the provided token
      const { data: { user }, error: userError } = await userSupabase.auth.getUser(userToken);
      
      if (userError || !user) {
        console.error('User verification failed:', userError);
        throw new Error(`Unauthorized: ${userError?.message || 'Invalid user token'}`);
      }

      console.log('User verified:', user.email);

      // Use admin client to get the user's profile to verify they're a company admin
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role, company_id')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        throw new Error('Unauthorized: Cannot verify user role');
      }

      if (!profile || profile.role !== 'company_admin') {
        console.error('Role verification failed:', profile);
        throw new Error('Unauthorized: User is not a company admin');
      }

      // Verify the company belongs to the requesting admin
      if (profile.company_id !== companyId) {
        console.error('Company mismatch:', { profileCompanyId: profile.company_id, requestedCompanyId: companyId });
        throw new Error('Unauthorized: Cannot create guard for different company');
      }

      console.log('Company admin verification passed');
    }

    // Enforce company license limit before creating a new guard
    console.log('Checking company license limits...');
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('license_limit')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.error('Company lookup failed:', companyError);
      throw new Error('Unable to verify company license');
    }

    const { count: activeGuardsCount, error: guardCountError } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('role', 'guard')
      .eq('is_active', true);

    if (guardCountError) {
      console.error('Guard count query failed:', guardCountError);
      throw new Error('Unable to verify license usage');
    }

    console.log('License check:', { activeGuardsCount, license_limit: company.license_limit });

    if ((activeGuardsCount ?? 0) >= company.license_limit) {
      console.error('License limit reached for company:', companyId);
      return new Response(
        JSON.stringify({ success: false, error: 'License limit reached: cannot create more guards for this company.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Creating auth user...');

    // Create the auth user using admin client
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'guard',
        company_id: companyId
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    if (!authUser.user) {
      console.error('No user returned from auth creation');
      throw new Error('Failed to create user account - no user returned');
    }

    console.log('Auth user created successfully:', authUser.user.id);

    // The profile should be created automatically by the trigger
    // Let's update it with the company_id and assigned property
    const updateData: any = {
      company_id: companyId,
      username: username // Store the username in the profile
    };
    
    // Only add assigned_property_id if it's provided and not empty
    if (assignedPropertyId && assignedPropertyId.trim() !== '') {
      updateData.assigned_property_id = assignedPropertyId;
    }
    
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('user_id', authUser.user.id);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      // Don't throw here as the user was created successfully
    } else {
      console.log('Profile updated successfully with property assignment:', assignedPropertyId || 'none');
    }

    console.log('Guard creation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          username: username || email,
          firstName,
          lastName
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error('Error in create-guard function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        success: false 
      }),
      {
        status: 400,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);