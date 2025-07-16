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
  email: string;
  phone: string;
  password: string;
  companyId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the request is from an authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create regular client to verify the requesting user
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          authorization: authHeader,
        },
      },
    });

    // Verify the requesting user is a company admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user');
    }

    // Get the user's profile to verify they're a company admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'company_admin') {
      throw new Error('Unauthorized: User is not a company admin');
    }

    const { firstName, lastName, email, phone, password, companyId }: CreateGuardRequest = await req.json();

    // Verify the company belongs to the requesting admin
    if (profile.company_id !== companyId) {
      throw new Error('Unauthorized: Cannot create guard for different company');
    }

    console.log('Creating guard with data:', {
      firstName,
      lastName,
      email,
      phone,
      companyId
    });

    // Validate input data
    if (!firstName || !lastName || !email || !password || !companyId) {
      throw new Error('Missing required fields');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

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
      throw new Error('Failed to create user account');
    }

    console.log('Auth user created successfully:', authUser.user.id);

    // Update the profile that was automatically created by the trigger
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: phone,
        company_id: companyId
      })
      .eq('user_id', authUser.user.id);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      // Don't throw here as the user was created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          firstName,
          lastName,
          phone
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