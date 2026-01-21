const { startBot } = require('./src/bot');

// Start bot with session name from argument or use 'default'
const sessionName = process.argv[2] || 'default';

console.log('🚀 Starting WhatsApp Tag All Bot...');
console.log(`📱 Session: ${sessionName}\n`);

startBot(sessionName).catch(err => {
    console.error('❌ Error starting bot:', err);
    process.exit(1);
});
