require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('⚠️  WARNING: Supabase credentials not configured!');
  console.error('Environment variables check:');
  console.error('NODE_ENV:', process.env.NODE_ENV);
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
  console.error('SUPABASE_KEY:', SUPABASE_KEY ? 'SET' : 'NOT SET');
  console.error('Server will start but database operations will fail.');
  console.error('Please configure SUPABASE_URL and SUPABASE_SERVICE_KEY in Railway variables.');
}

// Create client even if credentials are missing (will fail on actual use, but won't crash server startup)
const supabase = SUPABASE_URL && SUPABASE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
      },
    })
  : null;

module.exports = supabase;
