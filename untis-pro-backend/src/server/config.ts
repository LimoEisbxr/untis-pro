export const UNTIS_DEFAULT_SCHOOL =
    process.env.UNTIS_DEFAULT_SCHOOL ?? 'hhg-zw';

export const UNTIS_HOST = process.env.UNTIS_HOST ?? 'herakles.webuntis.com';

export const ADMIN_USERNAME = process.env.UNTIS_ADMIN_USERNAME || '';
export const ADMIN_PASSWORD = process.env.UNTIS_ADMIN_PASSWORD || '';

// Whitelist configuration for closed beta
export const WHITELIST_ENABLED = process.env.WHITELIST_ENABLED === 'true';
export const WHITELIST_USERNAMES = process.env.WHITELIST_USERNAMES
    ? process.env.WHITELIST_USERNAMES.split(',').map(u => u.trim())
    : [];
export const WHITELIST_CLASSES = process.env.WHITELIST_CLASSES
    ? process.env.WHITELIST_CLASSES.split(',').map(c => c.trim())
    : [];
