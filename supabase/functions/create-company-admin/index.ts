import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCompanyAdminRequest {
  companyId: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { companyId, adminEmail, adminFirstName, adminLastName, adminPhone }: CreateCompanyAdminRequest = await req.json();

    // Generate a temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!${Math.floor(Math.random() * 100)}`;

    // Create the admin user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: adminFirstName,
        last_name: adminLastName,
        role: 'company_admin',
        company_id: companyId,
        must_change_password: true
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      throw authError;
    }

    if (!authUser.user) {
      throw new Error('User creation failed - no user returned');
    }

    // Update the profile with company association
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: companyId,
        phone: adminPhone,
        role: 'company_admin'
      })
      .eq('user_id', authUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        adminId: authUser.user.id,
        adminEmail: adminEmail,
        temporaryPassword: tempPassword,
        message: 'Company admin created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-company-admin function:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});