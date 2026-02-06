import dotenv from 'dotenv';
dotenv.config();

if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
}

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

            if (!res.ok) {
                console.error('Resend API Error:', data);
                return { error: data };
            }

            return { data };
        } catch (err) {
            console.error(`Resend Fetch Error (Attempts left: ${retries - 1}):`, err.message);
            retries--;
            if (retries === 0) return { error: { message: err.message } };
            // Wait 1 second before retrying
            await new Promise(r => setTimeout(r, 1000));
        }
    }
};

export const resend = {
    emails: {
        send: sendEmail
    }
};
