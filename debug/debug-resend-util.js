import { resend } from './api/_utils/resend.js';

async function testUtil() {
    console.log('--- Testing Patched Resend Utility ---');

    // We need to simulate the environment if validation logic exists or rely on dotenv loaded inside util
    // The util imports dotenv so it should be fine if .env exists in root

    const result = await resend.emails.send({
        from: 'SK Events Auth <noreply@contact.sk-events.com>',
        to: 'onboarding@resend.dev',
        subject: 'Patched Utility Test',
        html: '<p>It works!</p>'
    });

    if (result.error) {
        console.error('❌ Utility Failed:', result.error);
    } else {
        console.log('✅ Utility Success:', result.data);
    }
}

testUtil();
