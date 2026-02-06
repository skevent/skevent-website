import { supabaseAdmin } from './api/_utils/supabaseAdmin.js';
import fs from 'fs';

async function debug() {
    const { data: influencers } = await supabaseAdmin.from('influencers').select('*');
    let output = '';
    output += influencers ? `Total: ${influencers.length}\n` : 'No data\n';
    if (influencers) {
        influencers.forEach(i => {
            output += `Influencer: ${JSON.stringify(i)}\n`;
        });
    }
    fs.writeFileSync('influencer_debug.txt', output, 'utf8');
}
debug();
