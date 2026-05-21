const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Connecting to Supabase URL:', process.env.VITE_SUPABASE_URL);
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Error listing buckets:', listError);
    return;
  }
  console.log('Existing buckets:', buckets.map(b => b.id));

  const docBucket = buckets.find(b => b.id === 'documents');
  if (!docBucket) {
    console.log("Bucket 'documents' not found. Attempting to create it...");
    const { data: newBucket, error: createError } = await supabase.storage.createBucket('documents', {
      public: false
    });
    if (createError) {
      console.error('Error creating bucket:', createError);
    } else {
      console.log('Bucket "documents" created successfully:', newBucket);
    }
  } else {
    console.log('Bucket "documents" already exists.');
  }
}

run();
