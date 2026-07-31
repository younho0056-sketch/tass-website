module.exports = {
  apps: [
    {
      name: 'tass-next-server',
      script: './scripts/start-server.js',
      cwd: 'c:\\antigravity\\partner-manager',
      autorestart: true,
      watch: false,
      max_restarts: 50,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    },
    {
      name: 'cloudflared-tunnel',
      script: './scripts/start-tunnel.js',
      cwd: 'c:\\antigravity\\partner-manager',
      autorestart: true,
      watch: false,
      max_restarts: 100,
      restart_delay: 3000
    }
  ]
};
