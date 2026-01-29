async function handleTagAll(sock, msg) {
    try {
        const groupId = msg.key.remoteJid;

        // Get group metadata (includes participants)
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants;

        // Extract message after command
        const text = msg.message.conversation ||
                     msg.message.extendedTextMessage?.text || '';
        const customMessage = text.replace(/^!(tagall|everyone)\s*/, '').trim();

        // Build message with all mentions
        let message = '';
        if (customMessage) {
            message = `📢 ${customMessage}\n\n`;
        } else {
            message = '📢 *Mention All Members*\n\n';
        }

        // Create mentions array
        const mentions = participants.map(p => p.id);

        // Add all members to message
        participants.forEach((participant, index) => {
            const number = participant.id.split('@')[0];
            message += `${index + 1}. @${number}\n`;
        });

        // Send message with mentions
        await sock.sendMessage(groupId, {
            text: message,
            mentions: mentions
        });

        console.log(`✅ Tagged ${participants.length} members in group`);

    } catch (error) {
        console.error('❌ Error in handleTagAll:', error);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Terjadi error saat tag all members'
        });
    }
}

async function handleTagSpecific(sock, msg, phoneNumberMap) {
    try {
        const groupId = msg.key.remoteJid;

        // Get group metadata (includes participants)
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants;

        console.log('\n📝 Current Phone Number Map:');
        phoneNumberMap.forEach((jid, phone) => {
            console.log(`   ${phone} -> ${jid}`);
        });

        // Build phone number map from participants
        console.log('\n🔍 Building phone number map from participants...');
        console.log(`   Total participants: ${participants.length}`);
        
        let regularPhoneCount = 0;
        let lidCount = 0;
        
        for (const participant of participants) {
            const participantId = participant.id;
            const idPart = participantId.split('@')[0];
            
            // Method 1: For regular JIDs (phone numbers)
            if (participantId.includes('@s.whatsapp.net')) {
                regularPhoneCount++;
                phoneNumberMap.set(idPart, participantId);
                phoneNumberMap.set(participantId, participantId);
                
                // Also add with 0 prefix if starts with 62
                if (idPart.startsWith('62')) {
                    const withZero = '0' + idPart.slice(2);
                    phoneNumberMap.set(withZero, participantId);
                }
                // Add with 62 prefix if starts with 0
                else if (idPart.startsWith('0')) {
                    const with62 = '62' + idPart.slice(1);
                    phoneNumberMap.set(with62, participantId);
                }
                console.log(`   ✅ Regular phone: ${idPart} -> ${participantId}`);
            }
            // Method 2: For LID format - extract phone number from jid field
            else if (participantId.includes('@lid')) {
                lidCount++;
                
                // LID users have their actual phone number in the 'jid' field
                // Example: { id: "247416523620460@lid", jid: "628569042342@s.whatsapp.net" }
                let phoneNumber = null;
                
                if (participant.jid && participant.jid.includes('@s.whatsapp.net')) {
                    // Extract phone number from jid field
                    phoneNumber = participant.jid.split('@')[0];
                }
                
                if (phoneNumber) {
                    // Map the phone number to the LID
                    phoneNumberMap.set(phoneNumber, participantId);
                    phoneNumberMap.set(participantId, participantId);
                    
                    // Also add with 0 prefix if starts with 62
                    if (phoneNumber.startsWith('62')) {
                        const withZero = '0' + phoneNumber.slice(2);
                        phoneNumberMap.set(withZero, participantId);
                    }
                    // Add with 62 prefix if starts with 0
                    else if (phoneNumber.startsWith('0')) {
                        const with62 = '62' + phoneNumber.slice(1);
                        phoneNumberMap.set(with62, participantId);
                    }
                    
                    console.log(`   ✅ LID user: ${phoneNumber} -> ${participantId}`);
                    regularPhoneCount++; // Count as taggable
                } else {
                    console.log(`   ⚠️ LID without phone: ${participantId} (can only tag via @tagall)`);
                }
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Regular phones (can tag): ${regularPhoneCount}`);
        console.log(`   ⏭️ LID users (cannot tag): ${lidCount}`);
        console.log(`   💡 Tip: Only regular phone numbers can be tagged by number`);
        

        console.log('\n📝 Updated Phone Number Map:');
        phoneNumberMap.forEach((jid, phone) => {
            console.log(`   ${phone} -> ${jid}`);
        });

        // Extract message and phone numbers
        const text = msg.message.conversation ||
                     msg.message.extendedTextMessage?.text || '';

        // Extract everything after !tag command
        const content = text.replace(/^!tag\s*/, '').trim();

        // Parse content - support two formats:
        // 1. Inline: !tag 082232018289 085161885170 custom message
        // 2. Multi-line: !tag\n082232018289\n085161885170
        
        let phoneNumbers = [];
        let customMessage = '';
        
        if (content.includes('\n')) {
            // Multi-line format
            phoneNumbers = content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
        } else {
            // Inline format - split by spaces
            const parts = content.split(/\s+/);
            
            // Extract phone numbers (anything that looks like a number)
            phoneNumbers = parts.filter(part => /^\d+$/.test(part));
            
            // Everything else is the custom message
            const messageWords = parts.filter(part => !/^\d+$/.test(part));
            customMessage = messageWords.join(' ').trim();
        }

        console.log(`\n🔍 Nomor yang dicari: ${phoneNumbers.join(', ')}`);
        console.log(`📝 Custom message: "${customMessage}"`);

        if (phoneNumbers.length === 0) {
            await sock.sendMessage(groupId, {
                text: '❌ Format salah! Gunakan:\n\n' +
                      '*Format 1 (inline):*\n' +
                      '!tag 082232018289 085161885170 pesan custom\n\n' +
                      '*Format 2 (multi-line):*\n' +
                      '!tag\n087800073210\n085161885170'
            });
            return;
        }

        // Convert phone numbers to JID format and find matching participants
        const mentions = [];
        const taggedNumbers = [];

        phoneNumbers.forEach(phoneNumber => {
            // Remove non-numeric characters
            let cleanPhone = phoneNumber.replace(/\D/g, '');

            // Convert to different formats
            const formats = [];

            // Original format
            formats.push(cleanPhone);

            // If starts with 0, convert to 62
            if (cleanPhone.startsWith('0')) {
                formats.push('62' + cleanPhone.slice(1));
            }
            // If starts with 62, convert to 0
            else if (cleanPhone.startsWith('62')) {
                formats.push('0' + cleanPhone.slice(2));
            }

            // Remove duplicates
            const uniqueFormats = [...new Set(formats)];

            console.log(`\n   Mencari nomor: ${phoneNumber}`);
            console.log(`   Clean: ${cleanPhone}`);
            console.log(`   Formats to try: ${uniqueFormats.join(', ')}`);

            // First, check if we have this phone in our phone number map
            let matchedJid = null;
            for (const format of uniqueFormats) {
                if (phoneNumberMap.has(format)) {
                    matchedJid = phoneNumberMap.get(format);
                    console.log(`   ✅ Found in phone number map: ${format} -> ${matchedJid}`);
                    break;
                }
            }

            // If not found in map, try to find in participants by direct ID matching
            if (!matchedJid) {
                const matchedParticipant = participants.find(p => {
                    const participantId = p.id.split('@')[0];

                    // Try exact match
                    if (uniqueFormats.includes(participantId)) {
                        return true;
                    }

                    // Try suffix matching
                    for (const format of uniqueFormats) {
                        if (participantId.endsWith(format) || format.endsWith(participantId)) {
                            return true;
                        }
                    }

                    return false;
                });

                if (matchedParticipant) {
                    matchedJid = matchedParticipant.id;
                    console.log(`   ✅ Found by participant matching: ${matchedJid}`);
                }
            }

            if (matchedJid) {
                console.log(`   ✅ DITEMUKAN: ${matchedJid}`);
                mentions.push(matchedJid);
                taggedNumbers.push({
                    original: phoneNumber,
                    jid: matchedJid,
                    found: true
                });
            } else {
                console.log(`   ❌ TIDAK DITEMUKAN`);
                taggedNumbers.push({
                    original: phoneNumber,
                    found: false
                });
            }
        });

        // Build message
        let message = '';
        
        // Add custom message if provided
        if (customMessage) {
            message = `📢 *${customMessage}*\n\n`;
        } else {
            message = '📢 *Tag Specific Members*\n\n';
        }

        if (mentions.length > 0) {
            message += '*Tagged Members:*\n';
            taggedNumbers.forEach((item, index) => {
                if (item.found) {
                    const number = item.jid.split('@')[0];
                    message += `${index + 1}. @${number}\n`;
                } else {
                    message += `${index + 1}. ${item.original} ❌ (Not found in group)\n`;
                }
            });
        } else {
            message += '❌ Tidak ada nomor yang ditemukan di grup ini.\n\n';
            message += '*Nomor yang dicari:*\n';
            phoneNumbers.forEach((phone, index) => {
                message += `${index + 1}. ${phone}\n`;
            });
            message += '\n*Tips:* Pastikan nomor sudah benar dan orangnya ada di grup.';
        }

        // Send message with mentions
        await sock.sendMessage(groupId, {
            text: message,
            mentions: mentions
        });

        console.log(`\n✅ Tagged ${mentions.length} out of ${phoneNumbers.length} numbers`);

    } catch (error) {
        console.error('❌ Error in handleTagSpecific:', error);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Terjadi error saat tag specific members'
        });
    }
}

module.exports = { handleTagAll, handleTagSpecific };
