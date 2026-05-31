require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Import ws for WebSocket support on Node.js 20
let WebSocket;
try {
  WebSocket = require('ws');
} catch (err) {
  console.warn('ws package not found, realtime features will be disabled');
}

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
    const clientOptions = {
      auth: {
        persistSession: false,
      },
    };
    
    // Add WebSocket transport if available
    if (WebSocket) {
      clientOptions.realtime = {
        transport: WebSocket,
      };
    } else {
      // Disable realtime if ws is not available
      clientOptions.realtime = {
        enabled: false,
      };
    }
    
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions);
    console.log('✓ Supabase client created successfully');
  } catch (err) {
    console.error('⚠️  Error creating Supabase client:', err.message);
    console.error('Server will continue without Supabase');
    supabase = null;
  }
}

module.exports = supabase;
