import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UNTIS_DEFAULT_SCHOOL = process.env.UNTIS_DEFAULT_SCHOOL;

export const UNTIS_HOST = process.env.UNTIS_HOST;

export const ADMIN_USERNAME = process.env.UNTIS_ADMIN_USERNAME || '';
export const ADMIN_PASSWORD = process.env.UNTIS_ADMIN_PASSWORD || '';

// Whitelist configuration for closed beta (DB-backed)
export const WHITELIST_ENABLED = process.env.WHITELIST_ENABLED === 'true';
