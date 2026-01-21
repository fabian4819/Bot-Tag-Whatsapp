module.exports = {
  apps: [
    {
      name: 'wa-bot-1',
      script: 'index.js',
      args: 'nomor1',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'wa-bot-2',
      script: 'index.js',
      args: 'nomor2',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'wa-bot-3',
      script: 'index.js',
      args: 'nomor3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
