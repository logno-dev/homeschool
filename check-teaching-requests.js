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

async function checkTeachingRequests() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Checking class teaching requests...');
    
    // Get active session
    const sessions = await client.execute(`
      SELECT id, name FROM sessions WHERE is_active = 1
    `);
    
    if (sessions.rows.length === 0) {
      console.log('No active session found');
      return;
    }
    
    const activeSession = sessions.rows[0];
    console.log(`Active session: ${activeSession.name} (${activeSession.id})`);
    
    // Get all teaching requests for the active session
    const requests = await client.execute(`
      SELECT ctr.id, ctr.class_name, ctr.status, ctr.guardian_id,
             g.first_name, g.last_name, g.email, g.family_id
      FROM class_teaching_requests ctr
      JOIN guardians g ON ctr.guardian_id = g.id
      WHERE ctr.session_id = ?
      ORDER BY ctr.status, ctr.class_name
    `, [activeSession.id]);
    
    console.log(`\nTeaching requests found: ${requests.rows.length}`);
    
    const statusCounts = { pending: 0, approved: 0, rejected: 0 };
    
    requests.rows.forEach(request => {
      statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
      console.log(`  ${request.class_name} - ${request.first_name} ${request.last_name} (${request.email}) - Status: ${request.status}`);
    });
    
    console.log(`\nStatus summary:`);
    console.log(`  Pending: ${statusCounts.pending || 0}`);
    console.log(`  Approved: ${statusCounts.approved || 0}`);
    console.log(`  Rejected: ${statusCounts.rejected || 0}`);
    
    // If there are approved requests, show which families have early access
    if (statusCounts.approved > 0) {
      console.log(`\nFamilies with early registration access:`);
      const approvedRequests = requests.rows.filter(r => r.status === 'approved');
      const familyIds = [...new Set(approvedRequests.map(r => r.family_id))];
      
      for (const familyId of familyIds) {
        const familyMembers = await client.execute(`
          SELECT first_name, last_name, email FROM guardians WHERE family_id = ?
        `, [familyId]);
        
        console.log(`  Family ${familyId}:`);
        familyMembers.rows.forEach(member => {
          console.log(`    - ${member.first_name} ${member.last_name} (${member.email})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking teaching requests:', error);
  } finally {
    client.close();
  }
}

checkTeachingRequests();