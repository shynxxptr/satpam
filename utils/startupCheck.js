import fs from 'fs';
import { loadConfig, getBotTokens, getConfigPath } from './config.js';

/**
 * Check dependencies
 */
export function checkDependencies() {
    console.log('🔍 Checking dependencies...');
    
    // Check if node_modules exists
    if (!fs.existsSync('node_modules/discord.js')) {
        console.log('  ❌ discord.js - REQUIRED!');
        console.log('  💡 Install dengan: npm install');
        return false;
    }
    console.log('  ✅ discord.js');

    if (!fs.existsSync('node_modules/dotenv')) {
        console.log('  ❌ dotenv - REQUIRED!');
        console.log('  💡 Install dengan: npm install');
        return false;
    }
    console.log('  ✅ dotenv');

    if (!fs.existsSync('node_modules/@discordjs/voice')) {
        console.log('  ❌ @discordjs/voice - REQUIRED!');
        console.log('  💡 Install dengan: npm install @discordjs/voice');
        return false;
    }
    console.log('  ✅ @discordjs/voice');

    // Check for encryption library (libsodium-wrappers)
    if (!fs.existsSync('node_modules/libsodium-wrappers')) {
        console.log('  ⚠️  libsodium-wrappers - REQUIRED untuk voice encryption');
        console.log('  💡 Install dengan: npm install libsodium-wrappers');
        return false;
    }
    console.log('  ✅ libsodium-wrappers (voice encryption)');

    return true;
}

/**
 * Check config file
 */
export function checkConfig() {
    console.log('\n🔍 Checking config file...');
    
    try {
        const config = loadConfig(true); // Force reload to ensure latest config
        if (!config) {
            console.log('  ❌ config.json tidak ditemukan!');
            console.log('  💡 Copy config.json.example ke config.json dan edit');
            console.log('  💡 Lokasi yang dicari:');
            console.log('     - ./config.json (root directory)');
            console.log('     - ./config/config.json');
            console.log('  💡 Contoh command:');
            console.log('     cp config/config.json.example config.json');
            console.log('     # atau jika di root:');
            console.log('     cp config.json.example config.json');
            return false;
        }

        // Validate config structure
        if (!config.bot_tokens || !Array.isArray(config.bot_tokens)) {
            console.log('  ❌ config.json tidak memiliki field "bot_tokens" yang valid!');
            console.log('  💡 Format harus: {"bot_tokens": ["token1", "token2", ...]}');
            return false;
        }

        const tokens = getBotTokens();
        if (tokens.length === 0) {
            console.log('  ❌ Tidak ada bot token yang valid!');
            console.log('  💡 Pastikan token tidak kosong dan bukan placeholder');
            console.log('  💡 Token harus minimal 50 karakter');
            return false;
        }

        const configPath = getConfigPath();
        console.log(`  ✅ config.json ditemukan: ${configPath || 'unknown'}`);
        console.log(`  ✅ ${tokens.length} bot token(s) valid`);
        
        if (config.bot_tokens && config.bot_tokens.length > tokens.length) {
            const placeholderCount = config.bot_tokens.length - tokens.length;
            console.log(`  ⚠️  ${placeholderCount} token(s) masih placeholder/kosong (akan diabaikan)`);
        }

        // Check optional configs
        if (config.idle_voice_channel_id) {
            const idleId = String(config.idle_voice_channel_id);
            console.log(`  ✅ Idle channel ID: ${idleId}`);
            console.log(`     💡 Tip: Gunakan string (e.g. "1451645891600453652") untuk menghindari precision issues`);
        } else {
            console.log(`  ℹ️  Idle channel ID tidak di-set (opsional)`);
        }

        if (config.music_enabled_bot) {
            console.log(`  ✅ Music enabled bot: #${config.music_enabled_bot}`);
        }

        if (config.spotify) {
            const spotify = config.spotify;
            if (spotify.client_id && spotify.client_secret && 
                !spotify.client_id.includes('your_') && !spotify.client_secret.includes('your_')) {
                console.log(`  ✅ Spotify credentials ditemukan`);
            } else {
                console.log(`  ℹ️  Spotify credentials tidak di-set (opsional)`);
            }
        }

        return true;
    } catch (error) {
        console.log(`  ❌ Error checking config: ${error.message}`);
        return false;
    }
}

/**
 * Check directories
 */
export function checkDirectories() {
    console.log('\n🔍 Checking directories...');
    
    const dirs = ['logs', 'backups'];
    let allOk = true;

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`  ✅ Created directory: ${dir}/`);
        } else {
            console.log(`  ✅ Directory exists: ${dir}/`);
        }
    }

    return true;
}

/**
 * Run all checks
 */
export function runAllChecks() {
    console.log('='.repeat(50));
    console.log('🛡️  SATPAM BOT - STARTUP CHECKS');
    console.log('='.repeat(50));
    console.log();

    const checks = [
        { name: 'Dependencies', func: checkDependencies },
        { name: 'Config', func: checkConfig },
        { name: 'Directories', func: checkDirectories }
    ];

    const results = [];
    for (const check of checks) {
        try {
            const result = check.func();
            results.push({ name: check.name, result });
        } catch (error) {
            console.error(`  ❌ Error in ${check.name} check:`, error);
            results.push({ name: check.name, result: false });
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 CHECK RESULTS');
    console.log('='.repeat(50));

    let allPassed = true;
    for (const { name, result } of results) {
        const status = result ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status} - ${name}`);
        if (!result) allPassed = false;
    }

    console.log();

    if (allPassed) {
        console.log('✅ All checks passed! Bot siap untuk dijalankan.');
        return true;
    } else {
        console.log('❌ Beberapa checks gagal. Silakan perbaiki sebelum menjalankan bot.');
        return false;
    }
}

