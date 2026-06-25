const QRCode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { handleTagAll, handleTagSpecific } = require('./commands');
const { createGoogleSheetWebhook } = require('./googleSheetWebhook');
const { createGroupMembershipTracker } = require('./groupMembershipTracker');
const { sleep } = require('./utils');

// Global phone number map
const phoneNumberMap = new Map();

async function startBot(sessionName = 'default') {
    try {
        const sheetWebhook = createGoogleSheetWebhook();
        const membershipTracker = createGroupMembershipTracker(sessionName, {
            autoLeaveDays: 30,
            onGroupCreated: (record) => sheetWebhook.appendGroupTrack(record, sessionName)
        });
        let autoLeaveInterval = null;

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
                QRCode.toFile('/tmp/wa-qr.png', qr, { scale: 8 }, (err) => {
                    if (!err) console.log('QR saved to /tmp/wa-qr.png');
                });
            }
            
            if (connection === 'close') {
                if (autoLeaveInterval) {
                    clearInterval(autoLeaveInterval);
                    autoLeaveInterval = null;
                }

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('\n❌ Koneksi terputus!');
                console.log(`   Status Code: ${statusCode}`);
                console.log(`   Reason: ${DisconnectReason[statusCode] || 'Unknown'}`);
                console.log(`   Will reconnect: ${shouldReconnect}\n`);
                
                if (shouldReconnect) {
                    console.log('⏳ Menunggu 3 detik sebelum PM2 restart proses...\n');
                    await sleep(3000);
                    process.exit(1);
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
                console.log(`📊 Google Sheet sync: ${sheetWebhook.enabled ? 'aktif' : 'nonaktif'}`);
                console.log('🎯 Menunggu perintah di grup...\n');

                await membershipTracker.trackAllParticipatingGroups(sock);
                await membershipTracker.leaveExpiredGroups(sock);

                if (!autoLeaveInterval) {
                    autoLeaveInterval = setInterval(() => {
                        membershipTracker.leaveExpiredGroups(sock).catch((error) => {
                            console.error('❌ Error auto-leave scheduler:', error.message);
                        });
                    }, 60 * 60 * 1000);
                }
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            }
        });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('groups.upsert', async (groups) => {
        for (const group of groups || []) {
            await membershipTracker.trackGroup(sock, group.id, 'group_upsert', group.subject || null);
        }
    });

    sock.ev.on('groups.update', async (groups) => {
        for (const group of groups || []) {
            await membershipTracker.trackGroup(sock, group.id, 'group_update', group.subject || null);
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        await membershipTracker.trackGroup(sock, update.id, `participant_${update.action || 'update'}`);
    });
    
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
            if (isGroup) {
                await membershipTracker.trackGroup(sock, msg.key.remoteJid, 'message');
            }

            // Build phone number map from participantPn if available
            if (isGroup && msg.key.participantPn && msg.key.participant) {
                const phone = msg.key.participantPn.split('@')[0];
                const lid = msg.key.participant;
                
                // Store both formats
                phoneNumberMap.set(phone, lid);
                phoneNumberMap.set(lid, lid);
                
                // Add 0-prefix variation if starts with 62
                if (phone.startsWith('62')) {
                    const withZero = '0' + phone.slice(2);
                    phoneNumberMap.set(withZero, lid);
                } 
                // Add 62-prefix variation if starts with 0
                else if (phone.startsWith('0')) {
                    const with62 = '62' + phone.slice(1);
                    phoneNumberMap.set(with62, lid);
                }
                
                console.log(`   📞 Auto-mapped: ${phone} -> ${lid}`);
            }

            // Debug logging
            console.log('\n📨 Processing message:');
            console.log(`   From: ${isGroup ? 'Group' : 'Private'}`);
            console.log(`   Text: "${text}"`);
            console.log(`   Type: ${m.type}`);

            if (isGroup) {
                // All group members can now use bot commands
                console.log(`   From Me: ${msg.key.fromMe}`);
                console.log(`   Participant: ${msg.key.participant || 'N/A'}`);
                console.log(`   Group: ${msg.key.remoteJid}`);
                console.log(`   ✅ All members allowed to use commands`);

                // Handle tag specific command
                if (text.startsWith('!tag') && !text.startsWith('!tagall')) {
                    console.log('✅ Tag specific command detected!');
                    await handleTagSpecific(sock, msg, phoneNumberMap);
                }
                // Handle tag all command
                else if (text.startsWith('!tagall') || text.startsWith('!everyone')) {
                    console.log('✅ Tag all command detected!');
                    await handleTagAll(sock, msg);
                }
                // Handle info command
                else if (text === '!info') {
                    console.log('✅ Info command detected!');
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: '🤖 *WhatsApp Tag All Bot*\n\n' +
                              'Commands:\n' +
                              '• !tagall [pesan] - Tag semua member\n' +
                              '• !everyone [pesan] - Tag semua member\n' +
                              '• !tag - Tag member spesifik (tulis nomor per baris)\n' +
                              '• !autoleave - Info jadwal bot keluar dari grup\n' +
                              '• !info - Info bot'
                    });
                }
                else if (text === '!autoleave') {
                    const groups = membershipTracker.listGroups();
                    const record = groups.find(group => group.groupId === msg.key.remoteJid);

                    if (!record) {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: 'Belum ada data auto-leave untuk grup ini.'
                        });
                    } else {
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: '*Auto Leave Grup*\n\n' +
                                  `Group ID: ${record.groupId}\n` +
                                  `Nama: ${record.subject || '-'}\n` +
                                  `Tanggal masuk: ${record.joinedAt}\n` +
                                  `Keluar otomatis: ${record.leaveAfterAt}\n` +
                                  `Sumber tanggal: ${record.source}`
                        });
                    }
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
