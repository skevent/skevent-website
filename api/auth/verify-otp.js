import { supabaseAdmin } from '../_utils/supabaseAdmin.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, otp, password, applyInfluencer, influencerData } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    try {
        // 1. Verify OTP from our custom table
        const { data: record, error } = await supabaseAdmin
            .from('email_verifications')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !record) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        if (new Date() > new Date(record.expires_at)) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        if (record.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // 2. OTP Valid - Delete it
        await supabaseAdmin
            .from('email_verifications')
            .delete()
            .eq('email', email);

        // 3. Create or Update User with Password
        let userId;

        // Check if user exists
        const { data: { users }, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
        // listUsers is inefficient for single check but searchUserByEmail might not be exposed easily in some versions.
        // Better: getUserById or just try createUser and catch.

        // Let's try to create first
        const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Mark as verified since we checked OTP
        });

        if (createError) {
            // If user already exists, update their password (since they verified OTP)
            // This acts as a Password Reset / Account Claim too, which is valid for OTP verification.
            // First get the user ID
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = users.find(u => u.email === email);

            if (existingUser) {
                userId = existingUser.id;
                await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
            } else {
                console.error('Create User Error:', createError);
                return res.status(500).json({ error: 'Failed to create account' });
            }
        } else {
            console.log('✅ User Created via Admin API');
            userId = createdUser.user.id;
        }

        console.log(`ℹ️ Attempting to upsert profile for User ID: ${userId}`);

        // 3.5 Ensure Profile Exists
        const { applyInfluencer, influencerData } = req.body;

        console.log('📦 Received Payload for Profile:', {
            applyInfluencer,
            influencerData,
            email
        });

        const displayName = influencerData?.name || email.split('@')[0];
        console.log(`👤 Resolved Name: ${displayName}`);

        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                email: email,
                role: applyInfluencer ? 'pending_influencer' : 'user',
                full_name: displayName,
                email_verified: true, // EXPLICITLY SET VERIFIED
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select();

        if (profileError) {
            console.error('❌ Profile Upsert Error:', JSON.stringify(profileError, null, 2));
        } else {
            console.log('✅ Final Profile in DB:', JSON.stringify(profileData?.[0], null, 2));
        }

        // 4. Generate Magic Link for Immediate Login (One-time)
        // We do this so the frontend is redirected and logged in automatically.
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: process.env.VITE_SITE_URL || 'http://localhost:5173'
            }
        });

        if (linkError) {
            console.error('Magic Link Error:', linkError);
            return res.status(500).json({ error: 'Failed to generate session' });
        }

        const user = { id: userId }; // Mock user obj for influencer logic
        const actionLink = linkData.properties.action_link;

        // Note: If user applied as influencer, their profile role is already set to 'influencer' above.
        // The actual influencer record creation happens CLIENT-SIDE on the dashboard,
        // where we have access to session.user.id to satisfy the FK constraint.
        // See: influencer/dashboard.js pattern from previous project.

        // 5. Return the Action Link
        // The frontend should redirect to this link to set the session
        return res.status(200).json({
            success: true,
            redirectUrl: actionLink,
            message: 'Verification successful. Logging you in...'
        });

    } catch (err) {
        console.error('Verify Error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
