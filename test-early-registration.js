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

// Import the database functions (simplified version for testing)
async function hasFamilyTeachingAssignments(guardianId, client) {
  try {
    // Get the guardian's family ID
    const guardian = await client.execute(`
      SELECT family_id FROM guardians WHERE id = ?
    `, [guardianId]);

    if (!guardian.rows[0]?.family_id) {
      return false;
    }

    // Get active session
    const activeSession = await client.execute(`
      SELECT id FROM sessions WHERE is_active = 1
    `);
    
    if (!activeSession.rows[0]) {
      return false;
    }

    // Check if any guardian in the family has approved teaching assignments for this session
    const teachingAssignments = await client.execute(`
      SELECT ctr.id
      FROM class_teaching_requests ctr
      JOIN guardians g ON ctr.guardian_id = g.id
      WHERE g.family_id = ? AND ctr.session_id = ? AND ctr.status = 'approved'
      LIMIT 1
    `, [guardian.rows[0].family_id, activeSession.rows[0].id]);

    return teachingAssignments.rows.length > 0;
  } catch (error) {
    console.error('Error checking family teaching assignments:', error);
    return false;
  }
}

async function testEarlyRegistration() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Testing early registration access...');
    
    // Get all guardians
    const guardians = await client.execute(`
      SELECT id, first_name, last_name, email FROM guardians
    `);
    
    console.log(`\nTesting ${guardians.rows.length} guardians:`);
    
    for (const guardian of guardians.rows) {
      const hasEarlyAccess = await hasFamilyTeachingAssignments(guardian.id, client);
      console.log(`  ${guardian.first_name} ${guardian.last_name} (${guardian.email}): ${hasEarlyAccess ? '✅ HAS early access' : '❌ No early access'}`);
    }
    
    // Test the current date logic
    const now = new Date();
    const session = await client.execute(`
      SELECT teacher_registration_start_date, registration_start_date, registration_end_date
      FROM sessions WHERE is_active = 1
    `);
    
    if (session.rows[0]) {
      const teacherRegStart = new Date(session.rows[0].teacher_registration_start_date);
      const regStart = new Date(session.rows[0].registration_start_date);
      const regEnd = new Date(session.rows[0].registration_end_date);
      
      console.log(`\nCurrent time: ${now.toISOString()}`);
      console.log(`Teacher early registration: ${teacherRegStart.toISOString()}`);
      console.log(`Regular registration: ${regStart.toISOString()} to ${regEnd.toISOString()}`);
      
      console.log(`\nRegistration status:`);
      console.log(`  Teacher early period active: ${now >= teacherRegStart && now <= regEnd ? '✅ YES' : '❌ NO'}`);
      console.log(`  Regular registration active: ${now >= regStart && now <= regEnd ? '✅ YES' : '❌ NO'}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing early registration:', error);
  } finally {
    client.close();
  }
}

testEarlyRegistration();