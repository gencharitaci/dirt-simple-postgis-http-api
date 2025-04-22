import config from '../config/index.js'

function isBlacklistedTable(table) {
    return config.blacklistedTables.includes(table)
}

export default function validateAccess(table) {
    if (isBlacklistedTable(table)) {
        return { ok: false, reason: 'Table is blacklisted.' }
    }
    return { ok: true }
}