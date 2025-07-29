const { execSync } = require('child_process');

try {
  // Run the migration with automatic selection
  execSync('echo "create column" | npx drizzle-kit push', { 
    stdio: 'inherit',
    cwd: '/Users/logno/projects/dvclc'
  });
} catch (error) {
  console.error('Migration failed:', error.message);
}