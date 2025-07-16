
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

const sendWelcomeEmail = async (adminEmail: string, adminFirstName: string, tempPassword: string) => {
  const SENDGRID_API_KEY = "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";
  
  const emailData = {
    personalizations: [{
      to: [{ email: adminEmail, name: adminFirstName }],
      subject: "Welcome to SecureOps - Your Admin Account"
    }],
    from: { email: "noreply@secureops.com", name: "SecureOps Platform" },
    content: [{
      type: "text/html",
      value: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Welcome to SecureOps</h1>
          <p>Hello ${adminFirstName},</p>
          <p>Your admin account has been created for the SecureOps platform. Here are your login credentials:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> ${adminEmail}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          
          <p><strong>Important:</strong> You must change your password on first login for security reasons.</p>
          
          <p>To access your admin dashboard:</p>
          <ol>
            <li>Go to the SecureOps platform</li>
            <li>Click "Sign In"</li>
            <li>Use the credentials above</li>
            <li>You'll be prompted to create a new password</li>
          </ol>
          
          <p>If you have any questions, please contact our support team.</p>
          
          <p>Best regards,<br>The SecureOps Team</p>
        </div>
      `
    }]
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
      console.error('SendGrid API error:', response.status, errorText);
      throw new Error(`SendGrid API error: ${response.status}`);
    }

    console.log('Welcome email sent successfully to:', adminEmail);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

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

    // Send welcome email with credentials
    try {
      await sendWelcomeEmail(adminEmail, adminFirstName, tempPassword);
      console.log('Welcome email sent successfully');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the entire operation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        adminId: authUser.user.id,
        adminEmail: adminEmail,
        temporaryPassword: tempPassword,
        message: 'Company admin created successfully and welcome email sent'
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
