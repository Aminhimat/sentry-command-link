import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  adminEmail: string;
}

// Function to generate a random password
function generateRandomPassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

// Function to send password reset email using SendGrid
async function sendPasswordResetEmail(
  adminEmail: string,
  tempPassword: string
): Promise<boolean> {
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
  const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL');

  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    console.error('SendGrid configuration missing');
    return false;
  }

  const emailData = {
    personalizations: [
      {
        to: [{ email: adminEmail }],
        subject: 'Password Reset - Your New Temporary Password',
      },
    ],
    from: { email: SENDGRID_FROM_EMAIL },
    content: [
      {
        type: 'text/html',
        value: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset</h2>
            <p>Hello,</p>
            <p>Your password has been reset by the system administrator. Here is your new temporary password:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="font-size: 18px; font-weight: bold; color: #2c3e50; margin: 0;">${tempPassword}</p>
            </div>
            <p style="color: #e74c3c; font-weight: bold;">⚠️ IMPORTANT: Please change this password immediately after logging in.</p>
            <p>For security reasons, we recommend using a strong, unique password.</p>
            <p>If you did not request this password reset, please contact your system administrator immediately.</p>
            <br>
            <p>Best regards,<br>Security Platform Team</p>
          </div>
        `,
      },
    ],
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid API error:', errorText);
      return false;
    }

    console.log('Password reset email sent successfully to:', adminEmail);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { adminEmail }: ResetPasswordRequest = await req.json();

    console.log('Resetting password for admin email:', adminEmail);

    if (!adminEmail) {
      return new Response(
        JSON.stringify({ error: 'Admin email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the user by email
    const { data: userData, error: userLookupError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userLookupError) {
      console.error('Error looking up user:', userLookupError);
      throw new Error('Failed to lookup user');
    }

    const user = userData.users.find(u => u.email === adminEmail);

    if (!user) {
      console.error('User not found with email:', adminEmail);
      return new Response(
        JSON.stringify({ error: 'Admin user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is a company_admin
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error('Error fetching user profile:', profileError);
      throw new Error('Failed to verify user role');
    }

    if (profileData.role !== 'company_admin') {
      return new Response(
        JSON.stringify({ error: 'User is not a company admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate temporary password
    const tempPassword = generateRandomPassword(12);

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to update password');
    }

    console.log('Password updated successfully for user:', user.id);

    // Return the temporary password to be displayed in the dashboard
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password reset successfully',
        temporaryPassword: tempPassword
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-company-admin-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
