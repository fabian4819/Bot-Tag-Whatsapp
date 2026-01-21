function formatPhoneNumber(number) {
    // Remove @ and domain
    return number.split('@')[0];
}

function isGroupMessage(jid) {
    return jid.endsWith('@g.us');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    formatPhoneNumber,
    isGroupMessage,
    sleep
};
