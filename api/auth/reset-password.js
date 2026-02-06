import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify Token Hash & Expiry in DB
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('id, reset_token_expires_at')
            .eq('email', email)
            .eq('reset_token_hash', tokenHash)
            .single();

        if (error || !profile) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        if (new Date() > new Date(profile.reset_token_expires_at)) {
            return res.status(400).json({ error: 'Token has expired' });
        }

        // 2. Update Supabase Auth Password
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            profile.id,
            { password: newPassword }
        );

        if (authError) throw authError;

        // 3. Clear Token Fields
        await supabaseAdmin
            .from('profiles')
            .update({
                reset_token_hash: null,
                reset_token_expires_at: null
            })
            .eq('id', profile.id);

        res.json({ success: true, message: 'Password updated successfully' });

    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
