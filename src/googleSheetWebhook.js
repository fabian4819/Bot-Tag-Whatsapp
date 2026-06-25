const https = require('https');

function requestJson(url, payload, method = 'POST', redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const body = method === 'GET' ? '' : JSON.stringify(payload);

        const request = https.request({
            hostname: parsedUrl.hostname,
            path: `${parsedUrl.pathname}${parsedUrl.search}`,
            method,
            headers: {
                ...(body ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                } : {})
            }
        }, (response) => {
            const chunks = [];

            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const responseBody = Buffer.concat(chunks).toString('utf8');

                if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                    if (redirectCount >= 5) {
                        reject(new Error('Terlalu banyak redirect dari Google Sheet webhook'));
                        return;
                    }

                    const redirectMethod = [301, 302, 303].includes(response.statusCode) ? 'GET' : method;
                    requestJson(response.headers.location, payload, redirectMethod, redirectCount + 1)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Webhook gagal (${response.statusCode}): ${responseBody}`));
                    return;
                }

                resolve(responseBody);
            });
        });

        request.on('error', reject);
        if (body) request.write(body);
        request.end();
    });
}

function createGoogleSheetWebhook(options = {}) {
    const webhookUrl = options.webhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL;
    const secret = options.secret || process.env.GOOGLE_SHEET_WEBHOOK_SECRET || '';

    async function appendGroupTrack(record, sessionName) {
        if (!webhookUrl) return false;

        await requestJson(webhookUrl, {
            secret,
            event: 'group_tracked',
            sessionName,
            groupId: record.groupId,
            subject: record.subject,
            joinedAt: record.joinedAt,
            firstSeenAt: record.firstSeenAt,
            leaveAfterAt: record.leaveAfterAt,
            source: record.source,
            status: record.status
        });

        return true;
    }

    return {
        appendGroupTrack,
        enabled: Boolean(webhookUrl)
    };
}

module.exports = { createGoogleSheetWebhook };
