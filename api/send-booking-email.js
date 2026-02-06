import { resend } from './_utils/resend.js';
import { supabaseAdmin } from './_utils/supabaseAdmin.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { bookingId } = req.body;

    if (!bookingId) {
        return res.status(400).json({ error: 'Missing bookingId' });
    }

    try {
        const { data: booking, error } = await supabaseAdmin
            .from('bookings')
            .select('*, events(*)')
            .eq('id', bookingId)
            .single();

        if (error || !booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'paid') {
            return res.status(400).json({ error: 'Booking is not paid' });
        }

        const { data, error: emailError } = await resend.emails.send({
            from: 'SK Events Tickets <tickets@contact.sk-events.com>',
            to: booking.customer_email,
            subject: `Booking Confirmed: ${booking.events.title}`,
            html: `
          <h1>Booking Confirmed!</h1>
          <p>Hi ${booking.customer_name},</p>
          <p>You requested a resend of your booking confirmation.</p>
          <p>Your booking for <strong>${booking.events.title}</strong> is confirmed.</p>
          <p><strong>Date:</strong> ${new Date(booking.events.date).toLocaleDateString()}</p>
          <p><strong>Location:</strong> ${booking.events.location}</p>
          <br/>
          <p>See you there!</p>
        `
        });

        if (emailError) {
            return res.status(500).json({ error: emailError.message });
        }

        res.status(200).json({ message: 'Email sent', id: data.id });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
