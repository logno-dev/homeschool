const { createClient } = require('@libsql/client');
const fs = require('fs');

// Read environment variables from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

async function checkSessions() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Checking sessions...');
    
    const sessions = await client.execute(`
      SELECT id, name, teacher_registration_start_date, registration_start_date, 
             registration_end_date, is_active, start_date, end_date
      FROM sessions 
      ORDER BY created_at DESC
    `);
    
    console.log('Sessions found:', sessions.rows.length);
    sessions.rows.forEach(session => {
      console.log(`\nSession: ${session.name}`);
      console.log(`  ID: ${session.id}`);
      console.log(`  Active: ${session.is_active ? 'Yes' : 'No'}`);
      console.log(`  Session Period: ${session.start_date} to ${session.end_date}`);
      console.log(`  Teacher Early Registration: ${session.teacher_registration_start_date || 'Not set'}`);
      console.log(`  Regular Registration: ${session.registration_start_date} to ${session.registration_end_date}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking sessions:', error);
  } finally {
    client.close();
  }
}

checkSessions();