const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;

function createGroupMembershipTracker(sessionName, options = {}) {
    const autoLeaveDays = options.autoLeaveDays || 30;
    const onGroupCreated = options.onGroupCreated;
    const onGroupLeft = options.onGroupLeft;
    const dataDir = path.join(process.cwd(), 'data');
    const dataFile = path.join(dataDir, `group-memberships-${sessionName}.json`);
    const manualJoinDatesFile = path.join(dataDir, `manual-join-dates-${sessionName}.json`);
    const sheetSyncInFlight = new Set();

    function calculateLeaveAfter(joinedAt) {
        return new Date(new Date(joinedAt).getTime() + autoLeaveDays * DAY_MS).toISOString();
    }

    function parseJoinDate(value) {
        if (!value) return null;

        if (typeof value === 'object' && value.joinedAt) {
            return parseJoinDate(value.joinedAt);
        }

        if (typeof value !== 'string') return null;

        const trimmed = value.trim();
        const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (ddmmyyyy) {
            const [, day, month, year] = ddmmyyyy;
            return `${year}-${month}-${day}T00:00:00+07:00`;
        }

        const parsedDate = new Date(trimmed);
        if (Number.isNaN(parsedDate.getTime())) return null;

        return parsedDate.toISOString();
    }

    function getManualValue(value) {
        if (!value) return null;
        if (typeof value === 'string') return { joinedAt: value, subject: null };

        return {
            joinedAt: value.joinedAt || null,
            subject: value.subject || null
        };
    }

    function loadManualJoinDates() {
        try {
            if (!fs.existsSync(manualJoinDatesFile)) {
                return { groups: {}, subjects: {} };
            }

            const parsed = JSON.parse(fs.readFileSync(manualJoinDatesFile, 'utf8'));
            return {
                groups: parsed.groups || {},
                subjects: parsed.subjects || {}
            };
        } catch (error) {
            console.error('❌ Gagal membaca manual join dates:', error.message);
            return { groups: {}, subjects: {} };
        }
    }

    function findManualJoinDate(groupId, subject = null) {
        const manual = loadManualJoinDates();
        const byGroup = getManualValue(manual.groups[groupId]);

        if (byGroup) {
            const joinedAt = parseJoinDate(byGroup.joinedAt);
            return joinedAt ? { joinedAt, source: 'manual_group_id', subject: byGroup.subject } : null;
        }

        if (!subject) return null;

        const bySubject = getManualValue(manual.subjects[subject]);
        if (!bySubject) return null;

        const joinedAt = parseJoinDate(bySubject.joinedAt);
        return joinedAt ? { joinedAt, source: 'manual_subject', subject } : null;
    }

    function normalizeRecord(record, groupId = null) {
        const joinedAt = record.joinedAt || record.firstSeenAt || new Date().toISOString();

        return {
            ...record,
            groupId: record.groupId || groupId,
            joinedAt,
            leaveAfterAt: calculateLeaveAfter(joinedAt),
            status: record.status || 'active',
            leftAt: record.leftAt || null,
            lastError: record.lastError || null
        };
    }

    function loadState() {
        try {
            if (!fs.existsSync(dataFile)) {
                return { groups: {} };
            }

            const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            if (!parsed || !parsed.groups) {
                return { groups: {} };
            }

            for (const [groupId, record] of Object.entries(parsed.groups)) {
                parsed.groups[groupId] = normalizeRecord(record, groupId);
            }

            return parsed;
        } catch (error) {
            console.error('❌ Gagal membaca group membership state:', error.message);
            return { groups: {} };
        }
    }

    function saveState(state) {
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
    }

    function updateRecord(groupId, fields) {
        const latestState = loadState();
        const latestRecord = latestState.groups[groupId];
        if (!latestRecord) return null;

        Object.assign(latestRecord, fields);
        saveState(latestState);

        return latestRecord;
    }

    function shouldRetrySheetSync(record, source) {
        if (!onGroupCreated) return false;
        if (record.sheetSyncedAt && !record.sheetSyncError) return false;
        if (source === 'message') return false;

        const lastAttemptAt = record.sheetLastSyncAttemptAt ? new Date(record.sheetLastSyncAttemptAt).getTime() : 0;
        if (!lastAttemptAt) return true;

        return Date.now() - lastAttemptAt > 10 * 60 * 1000;
    }

    async function syncRecordToSheet(state, record) {
        if (sheetSyncInFlight.has(record.groupId)) return;

        sheetSyncInFlight.add(record.groupId);
        record.sheetLastSyncAttemptAt = new Date().toISOString();
        updateRecord(record.groupId, {
            sheetLastSyncAttemptAt: record.sheetLastSyncAttemptAt
        });

        try {
            const synced = await onGroupCreated(record);
            if (synced) {
                record.sheetSyncedAt = new Date().toISOString();
                record.sheetSyncError = null;
                updateRecord(record.groupId, {
                    sheetSyncedAt: record.sheetSyncedAt,
                    sheetSyncError: null,
                    sheetLastSyncAttemptAt: record.sheetLastSyncAttemptAt
                });
                console.log(`📊 Grup tersync ke Google Sheet: ${record.subject || record.groupId}`);
            }
        } catch (error) {
            record.sheetSyncError = error.message;
            updateRecord(record.groupId, {
                sheetSyncError: record.sheetSyncError,
                sheetLastSyncAttemptAt: record.sheetLastSyncAttemptAt
            });
            console.error(`❌ Gagal sync grup ke Google Sheet ${record.groupId}:`, error.message);
        } finally {
            sheetSyncInFlight.delete(record.groupId);
        }
    }

    async function syncLeftToSheet(record) {
        if (!onGroupLeft) return;

        try {
            const synced = await onGroupLeft(record);
            if (synced) {
                record.leftSheetSyncedAt = new Date().toISOString();
                record.leftSheetSyncError = null;
                console.log(`📊 Status left tersync ke Google Sheet: ${record.subject || record.groupId}`);
            }
        } catch (error) {
            record.leftSheetSyncError = error.message;
            console.error(`❌ Gagal sync status left ke Google Sheet ${record.groupId}:`, error.message);
        }
    }

    async function getGroupSubject(sock, groupId) {
        try {
            const metadata = await sock.groupMetadata(groupId);
            return metadata.subject || null;
        } catch (error) {
            console.log(`   ⚠️ Tidak bisa ambil metadata grup ${groupId}: ${error.message}`);
            return null;
        }
    }

    async function trackGroup(sock, groupId, source = 'unknown', subject = null, joinedAt = null) {
        if (!groupId || !groupId.endsWith('@g.us')) return null;

        const state = loadState();
        const existing = state.groups[groupId];
        let resolvedSubject = subject || existing?.subject || null;

        if (!resolvedSubject) {
            resolvedSubject = await getGroupSubject(sock, groupId);
        }

        const isRejoin = existing?.status === 'left';
        const manualJoinDate = isRejoin ? null : findManualJoinDate(groupId, resolvedSubject);
        const effectiveJoinedAt = joinedAt || manualJoinDate?.joinedAt || null;
        const effectiveSource = manualJoinDate ? manualJoinDate.source : source;

        if (existing) {
            let changed = false;
            const rejoinedAt = new Date().toISOString();

            if (isRejoin) {
                existing.status = 'active';
                existing.leftAt = null;
                existing.lastError = null;
                existing.joinedAt = effectiveJoinedAt || rejoinedAt;
                existing.firstSeenAt = rejoinedAt;
                existing.leaveAfterAt = calculateLeaveAfter(existing.joinedAt);
                existing.updatedAt = rejoinedAt;
                existing.source = effectiveSource;
                existing.sheetSyncedAt = null;
                existing.sheetSyncError = null;
                existing.sheetLastSyncAttemptAt = null;
                changed = true;

                console.log(`🗓️ Grup rejoin tercatat ulang: ${resolvedSubject || groupId}`);
                console.log(`   Joined at: ${existing.joinedAt}`);
                console.log(`   Auto leave: ${existing.leaveAfterAt}`);
            }

            if (resolvedSubject && existing.subject !== resolvedSubject) {
                existing.subject = resolvedSubject;
                existing.updatedAt = new Date().toISOString();
                changed = true;
            }

            if (effectiveJoinedAt && existing.joinedAt !== effectiveJoinedAt) {
                existing.joinedAt = effectiveJoinedAt;
                existing.leaveAfterAt = calculateLeaveAfter(effectiveJoinedAt);
                existing.updatedAt = new Date().toISOString();
                existing.source = effectiveSource;
                changed = true;
            }

            if (changed) {
                saveState(state);
            }

            if (shouldRetrySheetSync(existing, source)) {
                await syncRecordToSheet(state, existing);
            }

            return existing;
        }

        const firstSeenAt = new Date().toISOString();
        const recordJoinedAt = effectiveJoinedAt || firstSeenAt;
        const record = {
            groupId,
            subject: resolvedSubject,
            joinedAt: recordJoinedAt,
            firstSeenAt,
            leaveAfterAt: calculateLeaveAfter(recordJoinedAt),
            status: 'active',
            source: effectiveSource,
            leftAt: null,
            lastError: null
        };

        state.groups[groupId] = record;
        saveState(state);

        console.log(`🗓️ Grup tercatat: ${record.subject || groupId}`);
        console.log(`   Joined at: ${record.joinedAt}`);
        console.log(`   Auto leave: ${record.leaveAfterAt}`);

        if (onGroupCreated) {
            await syncRecordToSheet(state, record);
        }

        return record;
    }

    async function trackAllParticipatingGroups(sock) {
        try {
            const groups = await sock.groupFetchAllParticipating();
            const entries = Object.values(groups || {});

            for (const group of entries) {
                await trackGroup(sock, group.id, 'startup', group.subject || null);
            }

            console.log(`🗓️ Tracking ${entries.length} grup aktif untuk auto-leave ${autoLeaveDays} hari`);
        } catch (error) {
            console.error('❌ Gagal mengambil daftar grup aktif:', error.message);
        }
    }

    async function leaveExpiredGroups(sock) {
        const state = loadState();
        const now = Date.now();
        let changed = false;

        for (const record of Object.values(state.groups)) {
            if (record.status !== 'active') continue;
            if (new Date(record.leaveAfterAt).getTime() > now) continue;

            try {
                console.log(`🚪 Auto leave grup: ${record.subject || record.groupId}`);
                await sock.sendMessage(record.groupId, {
                    text: `Bot otomatis keluar karena sudah ${autoLeaveDays} hari berada di grup ini.`
                });
                await sock.groupLeave(record.groupId);

                record.status = 'left';
                record.leftAt = new Date().toISOString();
                record.lastError = null;
                await syncLeftToSheet(record);
                changed = true;
            } catch (error) {
                record.lastError = error.message;
                record.updatedAt = new Date().toISOString();
                changed = true;
                console.error(`❌ Gagal auto leave ${record.groupId}:`, error.message);
            }
        }

        if (changed) {
            saveState(state);
        }
    }

    function upsertManualJoinDate(groupId, joinedAt, subject = null) {
        if (!groupId || !groupId.endsWith('@g.us')) {
            throw new Error('groupId harus berakhiran @g.us');
        }

        const parsedJoinedAt = parseJoinDate(joinedAt);
        if (!parsedJoinedAt) {
            throw new Error('joinedAt harus format tanggal valid, contoh: 2026-06-24 atau 2026-06-24T10:00:00+07:00');
        }

        const state = loadState();
        const existing = state.groups[groupId] || {
            groupId,
            firstSeenAt: new Date().toISOString(),
            status: 'active',
            source: 'manual',
            leftAt: null,
            lastError: null
        };

        existing.subject = subject || existing.subject || null;
        existing.joinedAt = parsedJoinedAt;
        existing.leaveAfterAt = calculateLeaveAfter(existing.joinedAt);
        existing.updatedAt = new Date().toISOString();
        existing.source = 'manual';

        state.groups[groupId] = existing;
        saveState(state);

        return existing;
    }

    function listGroups() {
        const state = loadState();
        return Object.values(state.groups)
            .sort((a, b) => new Date(a.leaveAfterAt).getTime() - new Date(b.leaveAfterAt).getTime());
    }

    function getStateFile() {
        return dataFile;
    }

    return {
        getStateFile,
        leaveExpiredGroups,
        listGroups,
        trackAllParticipatingGroups,
        trackGroup,
        upsertManualJoinDate
    };
}

module.exports = { createGroupMembershipTracker };
