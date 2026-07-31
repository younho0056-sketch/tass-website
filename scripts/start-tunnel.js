const { spawn } = require('child_process');
const child = spawn('npx.cmd', ['--yes', 'cloudflared', 'tunnel', '--url', 'http://127.0.0.1:3000'], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code || 0));
