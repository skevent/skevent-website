import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

async function testConnection() {
    console.log('--- Debugging Network ---');

    // 1. DNS Test
    try {
        console.log('Testing DNS lookup for api.resend.com...');
        const resendIP = await lookup('api.resend.com');
        console.log('✅ DNS Success (Resend):', resendIP);
    } catch (e) {
        console.error('❌ DNS Failed (Resend):', e.message);
    }

    try {
        console.log('Testing DNS lookup for google.com...');
        const googleIP = await lookup('google.com');
        console.log('✅ DNS Success (Google):', googleIP);
    } catch (e) {
        console.error('❌ DNS Failed (Google):', e.message);
    }

    // 2. Fetch Test
    try {
        console.log('Testing fetch to https://api.resend.com...');
        const res = await fetch('https://api.resend.com', { method: 'GET' });
        console.log('✅ Fetch Success (Resend): Status', res.status);
    } catch (e) {
        console.error('❌ Fetch Failed (Resend):', e.message, e.cause);
    }
}

testConnection();
