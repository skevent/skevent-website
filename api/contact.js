import { supabaseAdmin } from './_utils/supabaseAdmin.js';
import { resend } from './_utils/resend.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        console.log(`📩 New Contact Message from: ${email}`);

        // 1. Insert into Database
        const { error: dbError } = await supabaseAdmin
            .from('contact_messages')
            .insert([{
                name,
                email,
                message,
                status: 'new'
            }]);

        if (dbError) {
            console.error('Database Insert Error:', dbError);
            return res.status(500).json({ error: 'Failed to save message' });
        }

        // 2. Send Notification Email to Admin
        const { error: emailError } = await resend.emails.send({
            from: 'SK Events Contact <noreply@contact.sk-events.com>',
            to: 'skeventsandwedding12@gmail.com', // Admin Email
            subject: `New Inquiry from ${name}`,
            html: `
                <h3>New Contact Message</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong></p>
                <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #ccc;">
                    ${message.replace(/\n/g, '<br>')}
                </blockquote>
            `
        });

        if (emailError) {
            console.warn('Resend Notification Error:', emailError);
            // Don't fail the request if email fails, but log it.
        }

        res.status(200).json({ message: 'Message sent successfully' });

    } catch (err) {
        console.error('Contact Handler Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
