import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateGuardRequest {
  guardId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  username?: string;
  newPassword?: string;
  assignedPropertyId?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('update-guard function called, method:', req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing update-guard request...');
    
    // Parse the request body
    const requestBody = await req.json();
    console.log('Request body received:', { ...requestBody, newPassword: requestBody.newPassword ? '[REDACTED]' : 'none' });
    
    const { guardId, firstName, lastName, phone, username, newPassword, assignedPropertyId }: UpdateGuardRequest = requestBody;

    // Validate input data
    if (!guardId || !firstName || !lastName) {
      console.error('Missing required fields:', { guardId: !!guardId, firstName: !!firstName, lastName: !!lastName });
      throw new Error('Missing required fields');
    }

    console.log('Input validation passed');

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase admin client created');

    // Get the guard's profile to verify it exists and get user_id
    const { data: guardProfile, error: guardError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, company_id')
      .eq('id', guardId)
      .eq('role', 'guard')
      .single();

    if (guardError || !guardProfile) {
      console.error('Guard lookup failed:', guardError);
      throw new Error('Guard not found or access denied');
    }

    console.log('Guard found:', guardProfile.user_id);

    // Update profile information
    const profileUpdateData: any = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      assigned_property_id: assignedPropertyId,
      username: username && username.trim() !== '' && username.trim().toLowerCase() !== 'none' ? username : undefined
    };

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', guardId);

    if (profileUpdateError) {
      console.error('Error updating profile:', profileUpdateError);
      throw new Error('Failed to update guard profile');
    }

    console.log('Profile updated successfully');

    // Update username (email) if provided and not a placeholder like 'none'
    if (username && username.trim() !== '' && username.trim().toLowerCase() !== 'none') {
      console.log('Updating username/email...');
      
      // Sanitize username to create a valid email address
      let emailAddress: string;
      if (username.includes('@')) {
        // If already an email, sanitize it
        const [localPart, domainRaw] = username.split('@');
        const sanitizedLocal = localPart.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
        const sanitizedDomain = domainRaw.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '');
        emailAddress = `${sanitizedLocal}@${sanitizedDomain}`;
      } else {
        // Create email from username - replace spaces with dots, convert to lowercase
        const sanitizedUsername = username.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
        emailAddress = `${sanitizedUsername}@company.local`;
      }
      
      console.log('Sanitized email address:', emailAddress);

      // Fetch existing auth user to compare and ensure it exists
      const { data: existingUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(guardProfile.user_id);
      if (getUserError || !existingUserData?.user) {
        console.warn('Auth user not found, skipping username update', getUserError);
        // Do not fail the whole request if auth user is missing
        // Continue with profile update success
      } else {
        const currentEmail = existingUserData.user.email?.toLowerCase();
        if (currentEmail === emailAddress.toLowerCase()) {
          console.log('Email unchanged, skipping update');
        } else {
          const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
            guardProfile.user_id,
            { 
              email: emailAddress
            }
          );
  
          if (emailError) {
            console.error('Error updating username:', emailError);
            throw new Error(`Failed to update username: ${emailError.message}`);
          }
  
          console.log('Username updated successfully');
        }
      }
    }

    // Update password if provided and not a placeholder like 'none'
    if (newPassword && newPassword.trim() !== '' && newPassword.trim().toLowerCase() !== 'none') {
      console.log('Updating password...');
      
      // Validate password strength
      if (newPassword.length < 6) {
        console.error('Password too short:', newPassword.length);
        throw new Error('Password must be at least 6 characters long');
      }

      // Check if auth user exists before attempting password update
      const { data: existingUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(guardProfile.user_id);
      if (getUserError || !existingUserData?.user) {
        console.warn('Auth user not found, skipping password update', getUserError);
        // Do not fail the whole request if auth user is missing
      } else {
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          guardProfile.user_id,
          { 
            password: newPassword,
            user_metadata: {
              first_name: firstName,
              last_name: lastName
            }
          }
        );

        if (passwordError) {
          console.error('Error updating password:', passwordError);
          throw new Error(`Failed to update password: ${passwordError.message}`);
        }

        console.log('Password updated successfully');
      }
    }

    console.log('Guard update completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Guard updated successfully'
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
    console.error('Error in update-guard function:', error);
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