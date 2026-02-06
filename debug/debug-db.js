
import { supabaseAdmin } from './api/_utils/supabaseAdmin.js';

async function testDB() {
    console.log("Testing Supabase Admin Client...");

    // 1. Check Events (Public Table)
    console.log(`Testing connection with 'events' table...`);
    const { count, error } = await supabaseAdmin
        .from('events')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("❌ Events Check Failed:", JSON.stringify(error, null, 2));
        return; // Stop if basic connection fails
    } else {
        console.log(`✅ Events Check Successful. Count: ${count}`);
    }

    // 2. Check Profiles (Private/RLS Table)
    console.log("Testing 'profiles' table access...");
    const { data, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(1);

    if (profileError) {
        console.error("❌ Profiles Check Failed:", JSON.stringify(profileError, null, 2));
    } else {
        console.log("✅ Profiles Check Successful (Table Found)");
    }
}

testDB();
