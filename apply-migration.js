const { spawn } = require('child_process');

const child = spawn('npx', ['drizzle-kit', 'push'], {
  cwd: '/Users/logno/projects/dvclc',
  stdio: ['pipe', 'inherit', 'inherit']
});

// Wait a bit for the prompt to appear
setTimeout(() => {
  // Send the selection for "create column"
  child.stdin.write('\n'); // Select the default (first) option
  child.stdin.end();
}, 3000);

child.on('close', (code) => {
  console.log(`Migration process exited with code ${code}`);
});