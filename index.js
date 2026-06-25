const fs = require('fs');
const path = require('path');
const { startBot } = require('./src/bot');

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(path.join(__dirname, '.env'));

// Start bot with session name from argument or use 'default'
const sessionName = process.argv[2] || 'default';

console.log('🚀 Starting WhatsApp Tag All Bot...');
console.log(`📱 Session: ${sessionName}\n`);

startBot(sessionName).catch(err => {
    console.error('❌ Error starting bot:', err);
    process.exit(1);
});
