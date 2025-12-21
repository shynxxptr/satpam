import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache config to avoid reloading multiple times
let configCache = null;
let configPathUsed = null;

/**
 * Load config from config.json
 */
export function loadConfig(forceReload = false) {
    // Return cached config if available and not forcing reload
    if (configCache && !forceReload) {
        return configCache;
    }

    const configPaths = [
        path.join(process.cwd(), 'config.json'),
        path.join(__dirname, '../config.json'),
        path.join(process.cwd(), 'config', 'config.json'),
        path.join(__dirname, '../config', 'config.json'),
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                const data = fs.readFileSync(configPath, 'utf8');
                
                // Validate JSON syntax
                if (!data || data.trim() === '') {
                    console.error(`⚠️  Config file ${configPath} is empty`);
                    continue;
                }
                
                const parsed = JSON.parse(data);
                configCache = parsed;
                configPathUsed = configPath;
                return parsed;
            } catch (error) {
                if (error instanceof SyntaxError) {
                    console.error(`❌ Error parsing JSON from ${configPath}:`, error.message);
                    console.error(`💡 Pastikan format JSON di config.json sudah benar`);
                } else {
                    console.error(`❌ Error loading config from ${configPath}:`, error.message);
                }
                // Continue to next path
            }
        }
    }

    // If we reach here, no config was loaded
    configCache = null;
    configPathUsed = null;
    return null;
}

/**
 * Get the config file path that was used
 */
export function getConfigPath() {
    return configPathUsed;
}

/**
 * Clear config cache (useful for testing or reloading)
 */
export function clearConfigCache() {
    configCache = null;
    configPathUsed = null;
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

/**
 * Get Spotify credentials
 */
export function getSpotifyCredentials() {
    const config = loadConfig();
    if (!config || !config.spotify) {
        return null;
    }
    
    // Check if credentials are placeholders
    if (config.spotify.client_id && 
        (config.spotify.client_id.includes('your_') || 
         config.spotify.client_id.includes('here') ||
         config.spotify.client_id.trim() === '')) {
        return null;
    }
    
    if (config.spotify.client_secret && 
        (config.spotify.client_secret.includes('your_') || 
         config.spotify.client_secret.includes('here') ||
         config.spotify.client_secret.trim() === '')) {
        return null;
    }
    
    return {
        client_id: config.spotify.client_id || null,
        client_secret: config.spotify.client_secret || null
    };
}

/**
 * Validate config file
 */
export function validateConfig() {
    const config = loadConfig();
    if (!config) {
        throw new Error('Config file tidak ditemukan atau tidak bisa dibaca');
    }
    
    if (!config.bot_tokens || !Array.isArray(config.bot_tokens)) {
        throw new Error('Config file harus memiliki field "bot_tokens" yang berupa array');
    }
    
    const validTokens = getBotTokens();
    if (validTokens.length === 0) {
        throw new Error('Tidak ada bot token yang valid di config.json');
    }
    
    return true;
}
