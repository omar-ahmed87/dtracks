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

// Create client with error handling for WebSocket issues
let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
      },
      realtime: {
        // Disable realtime to avoid WebSocket errors on Node.js 20
        enabled: false,
      },
    });
    console.log('✓ Supabase client created successfully');
  } catch (err) {
    console.error('⚠️  Error creating Supabase client:', err.message);
    console.error('Server will continue without Supabase');
    supabase = null;
  }
}

module.exports = supabase;
