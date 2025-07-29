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

async function fixVolunteerJobsTable() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Fixing volunteer_jobs table structure...');
    
    // First, let's check the current structure
    console.log('Checking current table structure...');
    const tableInfo = await client.execute("PRAGMA table_info(volunteer_jobs)");
    console.log('Current volunteer_jobs columns:', tableInfo.rows.map(row => `${row.name} (${row.type}, nullable: ${row.notnull === 0})`));
    
    // Step 1: Create a new table with the correct structure
    console.log('Creating new volunteer_jobs table...');
    await client.execute(`
      CREATE TABLE volunteer_jobs_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        quantity_available INTEGER DEFAULT 1 NOT NULL,
        job_type TEXT NOT NULL,
        is_active INTEGER DEFAULT 1 NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
    
    // Step 2: Copy data from old table to new table
    console.log('Copying data to new table...');
    await client.execute(`
      INSERT INTO volunteer_jobs_new (id, title, description, quantity_available, job_type, is_active, created_by, created_at, updated_at)
      SELECT id, title, description, quantity_available, job_type, 
             COALESCE(is_active, 1) as is_active, 
             created_by, created_at, updated_at
      FROM volunteer_jobs
    `);
    
    // Step 3: Drop the old table
    console.log('Dropping old table...');
    await client.execute('DROP TABLE volunteer_jobs');
    
    // Step 4: Rename the new table
    console.log('Renaming new table...');
    await client.execute('ALTER TABLE volunteer_jobs_new RENAME TO volunteer_jobs');
    
    // Step 5: Ensure session_volunteer_jobs table exists
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
    
    // Step 6: Verify the new structure
    console.log('Verifying new table structure...');
    const newTableInfo = await client.execute("PRAGMA table_info(volunteer_jobs)");
    console.log('New volunteer_jobs columns:', newTableInfo.rows.map(row => `${row.name} (${row.type}, nullable: ${row.notnull === 0})`));
    
    console.log('✅ Volunteer jobs table structure fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing volunteer jobs table:', error);
  } finally {
    client.close();
  }
}

fixVolunteerJobsTable();