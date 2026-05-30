require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const ADMIN_ID = '510270ae-1a72-4fa3-9b29-f28979ad3f03';

async function updateCourses() {
  console.log('Cleaning up courses table...');
  
  // 1. Delete all courses
  const { error: deleteError } = await supabase.from('courses').delete().neq('name', '___NON_EXISTENT___');
  if (deleteError) {
    console.error('Error deleting courses:', deleteError);
    return;
  }

  // 2. Insert the 4 correct courses
  const coursesToInsert = [
    {
      name: 'اساسيات كمبيوتر',
      description: 'Master the essential computer skills required for modern professional environments, from typing to advanced file management.',
      link: 'https://www.youtube.com/watch?v=Mtk7X8mN474',
      status: 'approved',
      created_by: ADMIN_ID
    },
    {
      name: 'ICDL',
      description: 'International Computer Driving License certification to prove your essential digital skills and boost your productivity.',
      link: 'https://www.youtube.com/watch?v=_u7Yn6L3Zpk',
      status: 'approved',
      created_by: ADMIN_ID
    },
    {
      name: 'جرافي ديزاين',
      description: 'Learn how to create stunning visuals and professional designs using industry tools like Photoshop and Illustrator.',
      link: 'https://www.youtube.com/watch?v=9E4MqeFndS4',
      status: 'approved',
      created_by: ADMIN_ID
    },
    {
      name: 'لغة المانية',
      description: 'German Language Course for beginners and professionals looking to expand their global communication skills.',
      link: 'https://www.youtube.com/watch?v=juKd26qkNAw',
      status: 'approved',
      created_by: ADMIN_ID
    }
  ];

  console.log('Inserting correct courses...');
  const { error: insertError } = await supabase.from('courses').insert(coursesToInsert);
  
  if (insertError) {
    console.error('Error inserting courses:', insertError);
  } else {
    console.log('Successfully updated courses in database!');
  }
}

updateCourses();
