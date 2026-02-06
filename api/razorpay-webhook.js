import crypto from 'crypto';
import { supabaseAdmin } from './_utils/supabaseAdmin.js';
import { resend } from './_utils/resend.js';
import dotenv from 'dotenv';
dotenv.config();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    if (!secret || !signature) {
        return res.status(400).json({ error: 'Missing secret or signature' });
    }

    // 1. Verify Signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
        console.error('Invalid signature');
        return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;

    if (event === 'order.paid') {
        const { payload } = req.body;
        const payment = payload.payment.entity;
        const orderId = payment.order_id;
        const email = payment.email; // Customer email from Razorpay

        console.log(`Payment successful for Order ID: ${orderId}`);

        try {
            // 2. Update Booking Status to 'paid'
            const { data: booking, error: updateError } = await supabaseAdmin
                .from('bookings')
                .update({
                    status: 'paid',
                    razorpay_payment_id: payment.id
                })
                .eq('razorpay_order_id', orderId)
                .select('*, events(*)') // Join with events to get details
                .single();

            if (updateError || !booking) {
                console.error('Booking update failed:', updateError);
                return res.status(500).json({ error: 'Booking update failed' });
            }

            // 3. Send Confirmation Email (Idempotency Check)
            if (!booking.email_sent_at) {
                try {
                    await resend.emails.send({
                        from: 'SK Events Tickets <tickets@contact.sk-events.com>',
                        // Use validated domain in prod
                        to: booking.customer_email,
                        subject: `Booking Confirmed: ${booking.events.title}`,
                        html: `
                  <h1>Booking Confirmed!</h1>
                  <p>Hi ${booking.customer_name},</p>
                  <p>Your booking for <strong>${booking.events.title}</strong> is confirmed.</p>
                  <p><strong>Date:</strong> ${new Date(booking.events.date).toLocaleDateString()}</p>
                  <p><strong>Location:</strong> ${booking.events.location}</p>
                  <p><strong>Amount Paid:</strong> ₹${booking.amount}</p>
                  <br/>
                  <p>See you there!</p>
                `
                    });

                    // Update email_sent_at
                    await supabaseAdmin
                        .from('bookings')
                        .update({ email_sent_at: new Date().toISOString() })
                        .eq('id', booking.id);

                    console.log('Confirmation email sent.');

                } catch (emailErr) {
                    console.error('Failed to send email:', emailErr);
                    // Don't fail the webhook, just log it
                }
            } else {
                console.log('Email already sent for this booking.');
            }

        } catch (err) {
            console.error('Webhook processing error:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    res.status(200).json({ status: 'ok' });
}
