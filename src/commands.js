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

        // Phone pattern: supports optional leading 0 or 62 or +62, digits and dashes, min 10 digits total
        // Also supports numbers without leading 0 starting with 8/9 (e.g. 882015861262)
        const phonePattern = /^(\+?62|0)[\d][\d\-]{7,14}$|^[89]\d{9,12}$/;

        // Normalize a raw phone token: strip dashes, ensure 62-prefix for lookup
        function normalizePhone(raw) {
            let clean = raw.replace(/[\-\s]/g, ''); // remove dashes/spaces
            // If no country code and no leading 0, treat as local number missing the 0
            // e.g. 882015861262 -> 0882015861262
            if (!clean.startsWith('0') && !clean.startsWith('62') && !clean.startsWith('+62')) {
                clean = '0' + clean;
            }
            return clean;
        }
        
        // Helper: resolve a raw phone token to a JID
        function resolvePhone(rawPhone) {
            const cleanPhone = normalizePhone(rawPhone);
            const formats = new Set([cleanPhone]);
            if (cleanPhone.startsWith('0')) {
                formats.add('62' + cleanPhone.slice(1));
            } else if (cleanPhone.startsWith('62')) {
                formats.add('0' + cleanPhone.slice(2));
            }

            console.log(`\n   Mencari nomor: ${rawPhone}`);
            console.log(`   Clean: ${cleanPhone}`);
            console.log(`   Formats to try: ${[...formats].join(', ')}`);

            // Check phone number map first
            for (const fmt of formats) {
                if (phoneNumberMap.has(fmt)) {
                    const jid = phoneNumberMap.get(fmt);
                    console.log(`   ✅ Found in phone number map: ${fmt} -> ${jid}`);
                    return jid;
                }
            }

            // Fallback: scan participants
            const matched = participants.find(p => {
                const pid = p.id.split('@')[0];
                if (formats.has(pid)) return true;
                for (const fmt of formats) {
                    if (pid.endsWith(fmt) || fmt.endsWith(pid)) return true;
                }
                return false;
            });

            if (matched) {
                console.log(`   ✅ Found by participant matching: ${matched.id}`);
                return matched.id;
            }

            console.log(`   ❌ TIDAK DITEMUKAN`);
            return null;
        }

        // Collect all phone-like tokens from content and resolve them
        // We'll replace each token in the original text with @mention
        // Token regex: matches phone numbers (with optional dashes) that are word-boundary delimited
        // Also handles "+ 08xxx" pattern (plus sign separated by space before number)
        // \b ensures we don't match numbers embedded inside words like "aestheticvibes2505"
        const phoneTokenRegex = /(?<![\w])((\+?62|0)[\d][\d\-]{7,14}|[89]\d{9,12})(?![\w])/g;

        // Find all unique phone tokens in content (capture group 1)
        const rawMatches = [];
        let m;
        const _re = new RegExp(phoneTokenRegex.source, 'g');
        while ((m = _re.exec(content)) !== null) {
            rawMatches.push(m[1]);
        }
        const allTokens = [...new Set(rawMatches)].filter(t => phonePattern.test(t));

        if (allTokens.length === 0) {
            await sock.sendMessage(groupId, {
                text: '❌ Format salah! Gunakan:\n\n' +
                      '*Format 1 (inline):*\n' +
                      '!tag 082232018289 085161885170 pesan custom\n\n' +
                      '*Format 2 (multi-line):*\n' +
                      '!tag\n' +
                      'PESAN PERTAMA\n' +
                      '082232018289\n\n' +
                      'PESAN KEDUA\n' +
                      '085161885170'
            });
            return;
        }

        console.log(`\n📦 Found ${allTokens.length} phone token(s): ${allTokens.join(', ')}`);

        // Resolve all tokens
        const mentions = [];
        const tokenToMention = new Map(); // raw token -> @number string or keep original

        for (const token of allTokens) {
            const jid = resolvePhone(token);
            if (jid) {
                const number = jid.split('@')[0];
                mentions.push(jid);
                tokenToMention.set(token, `@${number}`);
            } else {
                tokenToMention.set(token, token); // keep as-is if not found
            }
        }

        // Build final message: replace each phone token with its @mention (or original)
        // Sort tokens by length descending to avoid partial replacements
        const sortedTokens = [...allTokens].sort((a, b) => b.length - a.length);
        let messageText = content;
        for (const token of sortedTokens) {
            const replacement = tokenToMention.get(token);
            // Escape special regex chars in token, then replace with word-boundary awareness
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            messageText = messageText.replace(new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'g'), replacement);
        }

        // Send as a single message
        await sock.sendMessage(groupId, {
            text: messageText,
            mentions: mentions
        });

        console.log(`\n✅ Tagged ${mentions.size || mentions.length} number(s) in one message`);
        console.log(`\n🎉 Sent 1 message total`);

    } catch (error) {
        console.error('❌ Error in handleTagSpecific:', error);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Terjadi error saat tag specific members'
        });
    }
}

module.exports = { handleTagAll, handleTagSpecific };
