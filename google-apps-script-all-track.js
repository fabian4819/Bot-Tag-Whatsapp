const SHEET_NAME = 'All Track';
const WEBHOOK_SECRET = 'ganti-secret-ini';

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');

  if (payload.secret !== WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: 'Unauthorized' });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ ok: false, error: `Sheet "${SHEET_NAME}" tidak ditemukan` });
  }

  ensureHeader(sheet);

  sheet.appendRow([
    new Date(),
    payload.sessionName || '',
    payload.subject || '',
    payload.groupId || '',
    payload.joinedAt || '',
    payload.firstSeenAt || '',
    payload.leaveAfterAt || '',
    payload.source || '',
    payload.status || '',
    payload.event || ''
  ]);

  return jsonResponse({ ok: true });
}

function ensureHeader(sheet) {
  const headers = [
    'Tracked At',
    'Session',
    'Group Name',
    'Group ID',
    'Joined At',
    'First Seen At',
    'Auto Leave At',
    'Source',
    'Status',
    'Event'
  ];

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(value => value);

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
