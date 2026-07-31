const { spawn } = require('child_process');
const child = spawn('npm.cmd', ['run', 'dev'], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code || 0));
