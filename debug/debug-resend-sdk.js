import { Resend } from 'resend';
import 'dotenv/config';

async function testSDK() {
    console.log('--- Debugging Resend SDK ---');
    console.log('API Key available:', !!process.env.VITE_RESEND_API_KEY);

    const resend = new Resend(process.env.VITE_RESEND_API_KEY);

    try {
        const { data, error } = await resend.emails.send({
            from: 'SK Events Auth <noreply@contact.sk-events.com>',
            to: 'onboarding@resend.dev', // Safe sink address
            subject: 'SDK Test',
            html: '<p>Test</p>'
        });

        if (error) {
            console.error('❌ SDK Error:', error);
        } else {
            console.log('✅ SDK Success:', data);
        }
    } catch (err) {
        console.error('❌ SDK Native Exception:', err);
    }
}

testSDK();
