import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UNTIS_DEFAULT_SCHOOL =
    process.env.UNTIS_DEFAULT_SCHOOL ?? 'hhg-zw';

export const UNTIS_HOST = process.env.UNTIS_HOST ?? 'herakles.webuntis.com';

export const ADMIN_USERNAME = process.env.UNTIS_ADMIN_USERNAME || '';
export const ADMIN_PASSWORD = process.env.UNTIS_ADMIN_PASSWORD || '';

// Whitelist configuration for closed beta
export const WHITELIST_ENABLED = process.env.WHITELIST_ENABLED === 'true';

// Load whitelist from JSON file
interface WhitelistConfig {
    usernames: string[];
    classes: string[];
}

function loadWhitelistConfig(): WhitelistConfig {
    const defaultConfig: WhitelistConfig = { usernames: [], classes: [] };
    
    if (!WHITELIST_ENABLED) {
        return defaultConfig;
    }
    
    try {
        const whitelistPath = path.join(__dirname, '../../whitelist.json');
        
        if (!fs.existsSync(whitelistPath)) {
            console.warn('[whitelist] whitelist.json not found. Whitelist is effectively disabled.');
            return defaultConfig;
        }
        
        const whitelistData = fs.readFileSync(whitelistPath, 'utf8');
        const config = JSON.parse(whitelistData) as WhitelistConfig;
        
        // Validate structure
        if (!Array.isArray(config.usernames) || !Array.isArray(config.classes)) {
            console.error('[whitelist] Invalid whitelist.json structure. Expected { usernames: [], classes: [] }');
            return defaultConfig;
        }
        
        // Trim and filter empty values
        config.usernames = config.usernames.map(u => u.trim()).filter(u => u.length > 0);
        config.classes = config.classes.map(c => c.trim()).filter(c => c.length > 0);
        
        console.log(`[whitelist] Loaded ${config.usernames.length} usernames and ${config.classes.length} classes from whitelist.json`);
        return config;
    } catch (error) {
        console.error('[whitelist] Error loading whitelist.json:', error instanceof Error ? error.message : error);
        return defaultConfig;
    }
}

const whitelistConfig = loadWhitelistConfig();
export const WHITELIST_USERNAMES = whitelistConfig.usernames;
export const WHITELIST_CLASSES = whitelistConfig.classes;
