module.exports = {
  apps: [
    {
      name: 'web-quiz-app',
      script: 'server.js',
      cwd: '/var/www/web-quiz-app',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },
  ],
};
