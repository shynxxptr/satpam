import { getBotTokens } from './utils/config.js';
import { BotInstance } from './bot/BotInstance.js';
import { runAllChecks } from './utils/startupCheck.js';

const MAX_BOTS = 5;

/**
 * Main function
 */
async function main() {
    console.log('='.repeat(50));
    console.log('🛡️  SATPAM BOT - MULTIPLE INSTANCES (JavaScript)');
    console.log('='.repeat(50));
    console.log();

    // Initialize libsodium for @discordjs/voice encryption
    try {
        await import('libsodium-wrappers');
        console.log('✅ Voice encryption library loaded');
    } catch (error) {
        console.warn('⚠️  Warning: Could not load libsodium-wrappers:', error.message);
        console.warn('   Voice features may not work correctly');
    }
    console.log();

    // Run startup checks
    if (!runAllChecks()) {
        console.log('\n❌ Startup checks failed. Exiting...');
        process.exit(1);
    }
    console.log();

    // Load bot tokens
    const tokens = getBotTokens();

    if (tokens.length === 0) {
        console.error('❌ ERROR: Tidak ada bot token yang ditemukan!');
        console.log('\nCara setup:');
        console.log('1. Buat file config.json dengan format:');
        console.log('   {"bot_tokens": ["token1", "token2", ...]}');
        console.log('   (Bisa 1-5 bot tokens)');
        process.exit(1);
    }

    if (tokens.length > MAX_BOTS) {
        console.warn(`⚠️  WARNING: Hanya akan menggunakan ${MAX_BOTS} bot pertama dari ${tokens.length} token yang diberikan`);
        tokens.splice(MAX_BOTS);
    }

    console.log(`🚀 Starting ${tokens.length} Satpam Bot(s)...`);
    if (tokens.length < MAX_BOTS) {
        console.log(`ℹ️  Note: Kamu bisa menambahkan lebih banyak bot (maksimal ${MAX_BOTS})`);
    }
    console.log('-'.repeat(50));
    console.log();

    // Create bot instances
    const botInstances = [];
    for (let i = 0; i < tokens.length; i++) {
        const botNumber = i + 1;
        const token = tokens[i];

        // Validate token
        if (!token || token.length < 50) {
            console.warn(`⚠️  Bot #${botNumber}: Token terlalu pendek atau kosong, akan di-skip`);
            continue;
        }

        const botInstance = new BotInstance(botNumber, token);
        botInstances.push(botInstance);
    }

    if (botInstances.length === 0) {
        console.error('❌ ERROR: Tidak ada bot instance yang valid untuk dijalankan!');
        console.log('💡 Pastikan token di config.json valid dan tidak kosong');
        process.exit(1);
    }

    console.log(`✅ ${botInstances.length} bot instance(s) siap untuk dijalankan`);
    console.log();

    // Start all bots
    const startPromises = botInstances.map(bot => bot.start());
    
    try {
        await Promise.all(startPromises);
    } catch (error) {
        console.error('❌ Fatal Error:', error);
        process.exit(1);
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down all bots...');
        const stopPromises = botInstances.map(bot => bot.stop());
        await Promise.all(stopPromises);
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n\n👋 Shutting down all bots...');
        const stopPromises = botInstances.map(bot => bot.stop());
        await Promise.all(stopPromises);
        process.exit(0);
    });
}

// Run main
main().catch(error => {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
});

