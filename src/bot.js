const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { handleTagAll } = require('./commands');
const { sleep } = require('./utils');
const { ALLOWED_NUMBERS } = require('../config');

async function startBot(sessionName = 'default') {
    try {
        // Setup authentication state
        const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionName}`);
        
        // Fetch latest version
        const { version } = await fetchLatestBaileysVersion();
        
        // Store bot owner JID
        let botOwnerJid = null;
        
        // Create WhatsApp socket connection
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'warn' }),
            browser: ['Tag All Bot', 'Chrome', '1.0.0'],
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                return { conversation: '' };
            }
        });
        
        console.log('🔧 Bot initialized, setting up event listeners...');

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 Scan QR Code ini dengan WhatsApp:');
                console.log('   Buka WhatsApp → Settings → Linked Devices → Link a Device\n');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('\n❌ Koneksi terputus!');
                console.log(`   Status Code: ${statusCode}`);
                console.log(`   Reason: ${DisconnectReason[statusCode] || 'Unknown'}`);
                console.log(`   Will reconnect: ${shouldReconnect}\n`);
                
                if (shouldReconnect) {
                    console.log('⏳ Menunggu 3 detik sebelum reconnect...\n');
                    await sleep(3000);
                    startBot(sessionName);
                } else {
                    console.log('🔒 Bot logged out. Silakan hapus folder sessions dan scan QR lagi.\n');
                    process.exit(0);
                }
            } else if (connection === 'open') {
                // Get bot owner JID when connected
                botOwnerJid = sock.user.id;
                // Extract phone number from JID (format: 6282232018289:84@s.whatsapp.net or similar)
                const ownerPhone = botOwnerJid.split(':')[0].split('@')[0];
                
                console.log('\n✅ Bot terhubung dan siap digunakan!');
                console.log(`📱 Session: ${sessionName}`);
                console.log(`👤 Owner JID: ${botOwnerJid}`);
                console.log(`📞 Owner Phone: ${ownerPhone}`);
                console.log('🎯 Menunggu perintah di grup...\n');
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
    // Log all events for debugging
    console.log('📡 Registering message listener...');

    // Handle incoming messages - simplified version
    sock.ev.on('messages.upsert', async (m) => {
        console.log('\n🔔 messages.upsert event triggered!');
        console.log('   Type:', m.type);
        console.log('   Messages count:', m.messages?.length);
        
        try {
            const msg = m.messages[0];
            if (!msg) {
                console.log('   ⚠️ No message in array');
                return;
            }
            
            console.log('   Message keys:', Object.keys(msg));
            console.log('   Has message content:', !!msg.message);
            console.log('   Remote JID:', msg.key.remoteJid);
            console.log('   From me:', msg.key.fromMe);
            
            // Ignore if not a message or from status
            if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
                console.log('   ⏭️ Skipping: no message or status broadcast');
                return;
            }
            
            // Get message text from various message types
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption ||
                         msg.message.videoMessage?.caption ||
                         '';
            
            // Check if it's a group message
            const isGroup = msg.key.remoteJid.endsWith('@g.us');
            
            // Debug logging
            console.log('\n📨 Processing message:');
            console.log(`   From: ${isGroup ? 'Group' : 'Private'}`);
            console.log(`   Text: "${text}"`);
            console.log(`   Type: ${m.type}`);
            
            if (isGroup) {
                // Check if sender is in whitelist
                let isAllowed = false;
                let senderPhone = null;
                
                if (msg.key.fromMe) {
                    // Message from bot itself
                    isAllowed = true;
                    senderPhone = 'bot';
                } else if (msg.key.participant) {
                    // Extract phone number from participant
                    // Try multiple formats:
                    // 1. participantPn field (if available)
                    // 2. Extract from LID or regular JID
                    
                    if (msg.key.participantPn) {
                        senderPhone = msg.key.participantPn.split('@')[0];
                    } else {
                        // For LID format (202855784939752@lid), we need to check against a mapping
                        // For now, we'll try to extract from participant
                        const participant = msg.key.participant.split('@')[0];
                        
                        // Check if it's a regular phone number format
                        if (participant.match(/^\d{10,15}$/)) {
                            senderPhone = participant;
                        }
                    }
                    
                    // Check against whitelist
                    if (senderPhone && ALLOWED_NUMBERS.includes(senderPhone)) {
                        isAllowed = true;
                    }
                }
                
                console.log(`   From Me: ${msg.key.fromMe}`);
                console.log(`   Participant: ${msg.key.participant || 'N/A'}`);
                console.log(`   Participant PN: ${msg.key.participantPn || 'N/A'}`);
                console.log(`   Sender Phone: ${senderPhone || 'Unknown'}`);
                console.log(`   Is Allowed: ${isAllowed}`);
                console.log(`   Whitelist: ${ALLOWED_NUMBERS.join(', ')}`);
                
                // Only process commands from whitelisted numbers
                if (!isAllowed && (text.startsWith('!tagall') || text.startsWith('!everyone') || text === '!info')) {
                    console.log('   🚫 Command ignored: Not in whitelist');
                    return;
                }
                
                // Handle tag all command
                if (text.startsWith('!tagall') || text.startsWith('!everyone')) {
                    console.log('✅ Tag all command detected from owner!');
                    await handleTagAll(sock, msg);
                }
                
                // Handle info command
                else if (text === '!info') {
                    console.log('✅ Info command detected from owner!');
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '🤖 *WhatsApp Tag All Bot*\n\n' +
                              'Commands (Owner only):\n' +
                              '• !tagall [pesan] - Tag semua member\n' +
                              '• !everyone [pesan] - Tag semua member\n' +
                              '• !info - Info bot'
                    });
                }
                else {
                    console.log('   ℹ️ Not a bot command');
                }
            } else {
                console.log('   ℹ️ Private message, ignoring');
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    });

    return sock;
    
    } catch (error) {
        console.error('\n❌ Error starting bot:', error.message);
        console.log('⏳ Retrying in 5 seconds...\n');
        await sleep(5000);
        return startBot(sessionName);
    }
}

module.exports = { startBot };

