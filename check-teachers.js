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

async function checkTeachers() {
  const client = createClient({
    url: envVars.DATABASE_URL,
    authToken: envVars.DATABASE_AUTH_TOKEN,
  });

  try {
    console.log('Checking users with teacher role...');
    
    const teachers = await client.execute(`
      SELECT id, email, role, first_name, last_name
      FROM guardians 
      WHERE role = 'teacher'
      ORDER BY email
    `);
    
    console.log('Teachers found:', teachers.rows.length);
    teachers.rows.forEach(teacher => {
      console.log(`  ${teacher.first_name} ${teacher.last_name} (${teacher.email}) - Role: ${teacher.role}`);
    });

    if (teachers.rows.length === 0) {
      console.log('\nNo teachers found. Checking all user roles...');
      const allUsers = await client.execute(`
        SELECT id, email, role, first_name, last_name
        FROM guardians 
        ORDER BY role, email
      `);
      
      console.log('All users:');
      allUsers.rows.forEach(user => {
        console.log(`  ${user.first_name} ${user.last_name} (${user.email}) - Role: ${user.role || 'null'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking teachers:', error);
  } finally {
    client.close();
  }
}

checkTeachers();