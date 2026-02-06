import { supabaseAdmin } from './_utils/supabaseAdmin.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }

    try {
        const { data: influencer, error } = await supabaseAdmin
            .from('influencers')
            .select('discount_percent, active')
            .eq('code', code)
            .eq('active', true)
            .single();

        if (error || !influencer) {
            return res.status(404).json({ error: 'Invalid or inactive code' });
        }

        res.status(200).json({
            valid: true,
            discountPercent: influencer.discount_percent || 0
        });

    } catch (err) {
        console.error('Validate Code Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
