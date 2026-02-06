import { supabaseAdmin } from '../_utils/supabaseAdmin.js';
import { resend } from '../_utils/resend.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        console.log(`📩 Sending OTP to: ${email}`);

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Upsert into email_verifications
        const { error: upsertError } = await supabaseAdmin
            .from('email_verifications')
            .upsert({
                email,
                otp,
                expires_at: expiresAt.toISOString(),
                created_at: new Date().toISOString()
            }, { onConflict: 'email' });

        if (upsertError) {
            console.error('OTP Storage Error:', upsertError);
            return res.status(500).json({ error: 'Failed to generate OTP' });
        }

        // Send Email via Resend
        const { error: emailError } = await resend.emails.send({
            from: 'SK Events Auth <noreply@contact.sk-events.com>',
            to: email,
            subject: 'Your Verification Code',
            html: `
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>This code expires in 10 minutes.</p>
      `
        });

        if (emailError) {
            console.error('Resend Error:', emailError);
            return res.status(500).json({ error: 'Failed to send OTP email' });
        }

        res.status(200).json({ message: 'OTP sent successfully' });

    } catch (err) {
        console.error('Send OTP Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
