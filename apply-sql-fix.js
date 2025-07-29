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

async function applySQLFix() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Applying SQL fix for volunteer_jobs table...');
    
    // First, let's check the current structure
    console.log('Checking current table structure...');
    const tableInfo = await client.execute("PRAGMA table_info(volunteer_jobs)");
    console.log('Current volunteer_jobs columns:', tableInfo.rows.map(row => row.name));
    
    // Check if is_active column already exists
    const hasIsActive = tableInfo.rows.some(row => row.name === 'is_active');
    
    if (!hasIsActive) {
      console.log('Adding is_active column...');
      await client.execute("ALTER TABLE volunteer_jobs ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL");
      console.log('✓ Added is_active column');
    } else {
      console.log('✓ is_active column already exists');
    }
    
    // Check if session_volunteer_jobs table exists
    console.log('Checking for session_volunteer_jobs table...');
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='session_volunteer_jobs'");
    
    if (tables.rows.length === 0) {
      console.log('Creating session_volunteer_jobs table...');
      await client.execute(`
        CREATE TABLE session_volunteer_jobs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          volunteer_job_id TEXT NOT NULL,
          quantity_available INTEGER DEFAULT 1 NOT NULL,
          is_active INTEGER DEFAULT 1 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (volunteer_job_id) REFERENCES volunteer_jobs(id) ON DELETE CASCADE
        )
      `);
      console.log('✓ Created session_volunteer_jobs table');
    } else {
      console.log('✓ session_volunteer_jobs table already exists');
    }
    
    console.log('✅ SQL fix applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying SQL fix:', error);
  } finally {
    client.close();
  }
}

applySQLFix();