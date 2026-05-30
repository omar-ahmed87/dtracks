/**
 * Admin Creator Script
 * 
 * Usage: node create-admin.js <email> <username> <password>
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createAdmin() {
  const [email, username, password] = process.argv.slice(2);

  if (!email || !username || !password) {
    console.log('Usage: node create-admin.js <email> <username> <password>');
    process.exit(1);
  }

  console.log(`Creating admin user: ${username} (${email})...`);

  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        email: email.toLowerCase(),
        name: username,
        password_hash: passwordHash,
        role: 'admin'
      }
    ])
    .select();

  if (error) {
    if (error.code === '23505') {
      console.error('❌ User already exists with that email or username.');
    } else {
      console.error('❌ Error creating admin:', error.message);
    }
    process.exit(1);
  }

  console.log('✅ Admin user created successfully!');
  console.log('You can now log in at /admin-login');
  process.exit(0);
}

createAdmin();
