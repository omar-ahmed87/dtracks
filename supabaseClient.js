// Railway provides environment variables directly - no need for dotenv
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Environment variables check:');
  console.error('NODE_ENV:', process.env.NODE_ENV);
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
  console.error('SUPABASE_KEY:', SUPABASE_KEY ? 'SET' : 'NOT SET');
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
  },
});

module.exports = supabase;
