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

  if (payload.event === 'group_left') {
    updateGroupLeft(sheet, payload);
    return jsonResponse({ ok: true, updated: true });
  }

  appendTrackingRow(sheet, payload);

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
    'Left At',
    'Source',
    'Status',
    'Event'
  ];

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(value => value);

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const missingHeaders = headers.filter(header => !firstRow.includes(header));
  if (missingHeaders.length) {
    sheet.getRange(1, firstRow.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function updateGroupLeft(sheet, payload) {
  const headers = getHeaders(sheet);
  const groupIdColumn = headers.indexOf('Group ID') + 1;
  const leftAtColumn = headers.indexOf('Left At') + 1;
  const statusColumn = headers.indexOf('Status') + 1;
  const eventColumn = headers.indexOf('Event') + 1;

  if (!groupIdColumn || !statusColumn || !eventColumn) {
    throw new Error('Header All Track tidak lengkap');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    appendFallbackLeftRow(sheet, payload);
    return;
  }

  const groupIds = sheet.getRange(2, groupIdColumn, lastRow - 1, 1).getValues();
  for (let index = groupIds.length - 1; index >= 0; index--) {
    if (groupIds[index][0] === payload.groupId) {
      const row = index + 2;
      sheet.getRange(row, statusColumn).setValue(payload.status || 'left');
      sheet.getRange(row, eventColumn).setValue(payload.event || 'group_left');
      if (leftAtColumn) {
        sheet.getRange(row, leftAtColumn).setValue(payload.leftAt || new Date());
      }
      return;
    }
  }

  appendFallbackLeftRow(sheet, payload);
}

function appendFallbackLeftRow(sheet, payload) {
  appendTrackingRow(sheet, {
    ...payload,
    status: payload.status || 'left',
    event: payload.event || 'group_left'
  });
}

function appendTrackingRow(sheet, payload) {
  const values = {
    'Tracked At': new Date(),
    'Session': payload.sessionName || '',
    'Group Name': payload.subject || '',
    'Group ID': payload.groupId || '',
    'Joined At': payload.joinedAt || '',
    'First Seen At': payload.firstSeenAt || '',
    'Auto Leave At': payload.leaveAfterAt || '',
    'Left At': payload.leftAt || '',
    'Source': payload.source || '',
    'Status': payload.status || '',
    'Event': payload.event || ''
  };
  const headers = getHeaders(sheet);
  const row = headers.map(header => Object.prototype.hasOwnProperty.call(values, header) ? values[header] : '');
  sheet.appendRow(row);
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
