import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load config from config.json
 */
export function loadConfig() {
    const configPaths = [
        path.join(process.cwd(), 'config.json'),
        path.join(__dirname, '../config.json'),
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                const data = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.error(`Error loading config from ${configPath}:`, error);
            }
        }
    }

    return null;
}

/**
 * Get bot tokens from config
 */
export function getBotTokens() {
    const config = loadConfig();
    if (!config || !config.bot_tokens) {
        return [];
    }

    // Filter out empty/placeholder tokens
    return config.bot_tokens.filter(token => 
        token && 
        token.trim() !== '' && 
        !token.includes('token_bot_') &&
        !token.includes('disini')
    );
}

/**
 * Get idle voice channel ID
 */
export function getIdleChannelId() {
    const config = loadConfig();
    return config?.idle_voice_channel_id || null;
}

/**
 * Get music enabled bot number
 */
export function getMusicEnabledBot() {
    const config = loadConfig();
    return config?.music_enabled_bot || null;
}

/**
 * Get role IDs
 */
export function getRoleIds() {
    const config = loadConfig();
    return config?.role_ids || {
        donatur: [],
        loyalist: []
    };
}

/**
 * Get role names
 */
export function getRoleNames() {
    const config = loadConfig();
    return config?.role_names || {
        donatur: ['Donatur', 'donatur', 'DONATUR'],
        loyalist: ['Server Loyalist', 'Loyalist', 'loyalist']
    };
}

