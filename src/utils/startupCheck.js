import fs from 'fs';
import { loadConfig, getBotTokens } from './config.js';

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

    return true;
}

/**
 * Check config file
 */
export function checkConfig() {
    console.log('\n🔍 Checking config file...');
    
    const config = loadConfig();
    if (!config) {
        console.log('  ❌ config.json tidak ditemukan!');
        console.log('  💡 Copy config.json.example ke config.json dan edit');
        return false;
    }

    const tokens = getBotTokens();
    if (tokens.length === 0) {
        console.log('  ❌ Tidak ada bot token yang valid!');
        return false;
    }

    console.log(`  ✅ config.json ditemukan`);
    console.log(`  ✅ ${tokens.length} bot token(s) valid`);
    
    if (config.bot_tokens && config.bot_tokens.length > tokens.length) {
        const placeholderCount = config.bot_tokens.length - tokens.length;
        console.log(`  ⚠️  ${placeholderCount} token(s) masih placeholder (akan diabaikan)`);
    }

    return true;
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

