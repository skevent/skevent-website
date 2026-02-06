import Razorpay from 'razorpay';
import { supabaseAdmin } from './_utils/supabaseAdmin.js';
import dotenv from 'dotenv';
dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { eventId, ticketTypeId, quantity = 1, influencerCode, customerDetails } = req.body;

    if (!eventId || !customerDetails) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Fetch Event (for validation)
        const { data: event, error: eventError } = await supabaseAdmin
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // 2. Get Price from Ticket Type or Event
        let singleTicketPrice;
        let ticketTypeName = 'General';

        if (ticketTypeId && ticketTypeId !== 'legacy') {
            // Fetch from ticket_types table
            const { data: ticketType, error: typeError } = await supabaseAdmin
                .from('ticket_types')
                .select('*')
                .eq('id', ticketTypeId)
                .eq('event_id', eventId)
                .single();

            if (typeError || !ticketType) {
                return res.status(400).json({ error: 'Invalid ticket type' });
            }

            singleTicketPrice = ticketType.price;
            ticketTypeName = ticketType.name;
        } else {
            // Fallback to event price for legacy bookings
            singleTicketPrice = event.price;
        }

        let discountApplied = 0;

        // 3. Apply Influencer Discount if code provided
        if (influencerCode) {
            const { data: influencer, error: influencerError } = await supabaseAdmin
                .from('influencers')
                .select('*')
                .eq('code', influencerCode)
                .eq('active', true)
                .single();

            if (influencer && !influencerError) {
                // Calculate discount per ticket
                const discountAmount = (singleTicketPrice * (influencer.discount_percent || 0)) / 100;
                singleTicketPrice -= discountAmount;
                discountApplied = influencer.discount_percent;
            }
        }

        // Ensure price is not negative
        singleTicketPrice = Math.max(0, singleTicketPrice);

        // Calculate Total Price based on Quantity
        let finalPrice = singleTicketPrice * quantity;

        // Ensure price is not negative
        finalPrice = Math.max(0, finalPrice);

        // Razorpay amount is in paise (multiply by 100)
        // Round to nearest integer to avoid float issues
        const amountInPaise = Math.round(finalPrice * 100);

        // 3. Create Razorpay Order
        let razorpayOrder = null;
        let orderId = 'free_' + Date.now(); // Handle free events

        if (amountInPaise > 0) {
            const options = {
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`,
                notes: {
                    eventId: eventId,
                    ticketType: ticketTypeName,
                    influencerCode: influencerCode || 'NONE'
                }
            };
            razorpayOrder = await razorpay.orders.create(options);
            orderId = razorpayOrder.id;
        }

        // 5. Create Booking in Database (Pending State)
        const { data: booking, error: bookingError } = await supabaseAdmin
            .from('bookings')
            .insert([
                {
                    event_id: eventId,
                    ticket_type_id: (ticketTypeId && ticketTypeId !== 'legacy') ? ticketTypeId : null,
                    customer_name: customerDetails.name,
                    customer_email: customerDetails.email,
                    customer_phone: customerDetails.phone,
                    amount: finalPrice,
                    status: amountInPaise === 0 ? 'paid' : 'pending', // Auto-confirm free events
                    razorpay_order_id: orderId,
                    influencer_code: influencerCode || null,
                    created_at: new Date().toISOString(),
                },
            ])
            .select()
            .single();

        if (bookingError) {
            console.error('Booking insertion error:', bookingError);
            return res.status(500).json({ error: 'Failed to create booking record' });
        }

        // Return Order Details to Frontend
        res.status(200).json({
            orderId: orderId,
            amount: amountInPaise,
            currency: 'INR',
            key: process.env.RAZORPAY_KEY_ID,
            bookingId: booking.id
        });

    } catch (err) {
        console.error('Create Order Error:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}
