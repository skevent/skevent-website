import { resend } from './_utils/resend.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, name, status } = req.body;

    if (!email || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const subject = status === 'approved'
            ? '🎉 Your Influencer Application is Approved!'
            : 'Update on your Influencer Application';

        const html = status === 'approved'
            ? `<p>Hi ${name || 'there'},</p>
               <p>Congratulations! Your application to join <strong>SK Events</strong> as an influencer has been <strong>APPROVED</strong>.</p>
               <p>You can now log in to your dashboard to access your unique referral code and promotional materials.</p>
               <a href="https://skevents.vercel.app/login.html" style="background:#0F172A;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Login Now</a>
               <p>Welcome to the team!</p>`
            : `<p>Hi ${name || 'there'},</p>
               <p>Thank you for your interest in SK Events.</p>
               <p>After reviewing your application, we are unable to accept your request at this time.</p>
               <p>We appreciate your interest and wish you the best.</p>`;

        const { data, error } = await resend.emails.send({
            from: 'SK Events Admin <admin@contact.sk-events.com>',
            to: email,
            subject: subject,
            html: html
        });

        if (error) {
            console.error('Email Error:', error);
            // Don't fail the request just because email failed, but log it
        }

        return res.status(200).json({ message: 'Email sent successfully' });

    } catch (err) {
        console.error('Server Error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
