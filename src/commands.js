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
        let message = customMessage || '📢 *Mention All Members*';
        message += '\n\n';
        
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

module.exports = { handleTagAll };
