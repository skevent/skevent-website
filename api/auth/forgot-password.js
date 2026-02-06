import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Initialize Supabase Admin
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Resend Utility (Inline to avoid import issues if relative paths differ)
const sendEmail = async (payload) => {
    let retries = 3;
    while (retries > 0) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) return { error: data };
            return { data };
        } catch (err) {
            retries--;
            if (retries === 0) return { error: { message: err.message } };
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // 1. Find User by Email in Profiles
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (error || !profile) {
            // Security: Don't reveal if user exists
            return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
        }

        // 2. Generate Token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 mins

        // 3. Update DB
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                reset_token_hash: tokenHash,
                reset_token_expires_at: expiresAt
            })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        // 4. Send Email
        // Use configured VITE_SITE_URL, or fall back to the request origin (useful in Vercel previews), or localhost
        const origin = req.headers.origin || req.headers.host ? (req.headers.origin || `https://${req.headers.host}`) : 'http://localhost:5173';
        const siteUrl = process.env.VITE_SITE_URL || origin;
        const resetLink = `${siteUrl}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(email)}`;

        const emailResult = await sendEmail({
            from: 'SK Events <noreply@contact.sk-events.com>',
            to: [email],
            subject: 'Reset Your Password - SK Events',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Reset Password</h2>
                    <p>Click the link below to reset your password. This link expires in 60 minutes.</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background: #0F172A; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    <p style="margin-top: 20px; color: #666; font-size: 12px;">If you did not request this, please ignore this email.</p>
                </div>
            `
        });

        if (emailResult.error) {
            console.error('Email Send Error:', emailResult.error);
            // Don't fail the request to client though
        }

        res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
