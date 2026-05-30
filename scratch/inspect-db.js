require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function inspectDb() {
  const { data: enrollments, error: err1 } = await supabase
    .from('enrollments')
    .select('*')
    .limit(1);
    
  if (err1) {
    console.error('Error inspecting enrollments table:', err1.message);
  } else {
    console.log('Enrollments keys found:', enrollments.length > 0 ? Object.keys(enrollments[0]) : 'No enrollments found');
  }

  const { data: resets, error: err2 } = await supabase
    .from('password_resets')
    .select('*')
    .limit(1);
    
  if (err2) {
    console.error('Error inspecting password_resets table:', err2.message);
  } else {
    console.log('Password Resets keys found:', resets.length > 0 ? Object.keys(resets[0]) : 'No resets found');
  }
  
  process.exit(0);
}

inspectDb();
