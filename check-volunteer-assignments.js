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

async function checkVolunteerAssignments() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Checking volunteer_assignments table structure...');
    
    const tableInfo = await client.execute("PRAGMA table_info(volunteer_assignments)");
    console.log('Current volunteer_assignments columns:');
    tableInfo.rows.forEach(row => {
      console.log(`  ${row.name} (${row.type}, nullable: ${row.notnull === 0})`);
    });
    
    // Check if there are any records
    const count = await client.execute("SELECT COUNT(*) as count FROM volunteer_assignments");
    console.log(`\nTotal records: ${count.rows[0].count}`);
    
    if (count.rows[0].count > 0) {
      const sample = await client.execute("SELECT * FROM volunteer_assignments LIMIT 3");
      console.log('\nSample records:');
      sample.rows.forEach((row, i) => {
        console.log(`  Record ${i + 1}:`, row);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking volunteer assignments:', error);
  } finally {
    client.close();
  }
}

checkVolunteerAssignments();