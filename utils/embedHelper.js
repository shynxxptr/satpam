import { EmbedBuilder } from 'discord.js';

/**
 * Helper untuk membuat embeds yang konsisten dan menarik
 */

// Colors
export const Colors = {
    SUCCESS: 0x00FF88,      // Green
    ERROR: 0xFF4444,        // Red
    WARNING: 0xFFAA00,      // Orange
    INFO: 0x0099FF,         // Blue
    PRIMARY: 0x5865F2,      // Discord blurple
    TIER_GOLD: 0xFFD700,    // Gold
    TIER_PLATINUM: 0xE5E4E2, // Platinum
    TIER_PURPLE: 0x9B59B6,  // Purple
};

/**
 * Create success embed
 */
export function createSuccessEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

/**
 * Create error embed
 */
export function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(Colors.ERROR)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });
}

/**
 * Create warning embed
 */
export function createWarningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle(`⚠️ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });
}

/**
 * Create info embed
 */
export function createInfoEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });

    if (fields.length > 0) {
        embed.addFields(fields);
    }

    return embed;
}

/**
 * Create status embed
 */
export function createStatusEmbed(botNumber, channel, isIdle, stayUntil, memberCount) {
    const embed = new EmbedBuilder()
        .setColor(isIdle ? Colors.INFO : Colors.SUCCESS)
        .setTitle(`🛡️ Satpam Bot #${botNumber} Status`)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });

    if (isIdle) {
        embed.setDescription(`💤 Bot sedang berada di idle channel\n⏳ Menunggu untuk dipanggil...`)
            .addFields(
                { name: '📍 Lokasi', value: `${channel}`, inline: true },
                { name: '📊 Status', value: '🟢 Idle', inline: true }
            );
    } else {
        const status = memberCount > 0 ? '🟢 Active' : '🟡 Empty (Timer Active)';
        const fields = [
            { name: '📍 Channel', value: `${channel}`, inline: true },
            { name: '📊 Status', value: status, inline: true },
            { name: '👥 Members', value: `${memberCount} member(s)`, inline: true }
        ];

        if (stayUntil) {
            const remaining = (stayUntil.getTime() - Date.now()) / (1000 * 60 * 60);
            if (remaining > 0) {
                const hours = Math.floor(remaining);
                const minutes = Math.floor((remaining - hours) * 60);
                fields.push({
                    name: '⏰ Waktu Stay Tersisa',
                    value: `${hours} jam ${minutes} menit`,
                    inline: false
                });
            } else {
                fields.push({
                    name: '⏰ Waktu Stay',
                    value: '⏳ Akan disconnect segera',
                    inline: false
                });
            }
        }

        embed.setDescription(`🟢 Bot sedang aktif menjaga voice channel`)
            .addFields(fields);
    }

    return embed;
}

/**
 * Create tier info embed
 */
export function createTierInfoEmbed(tierInfo, member) {
    const tierColors = {
        free: Colors.INFO,
        booster: Colors.TIER_PURPLE,
        donatur: Colors.TIER_GOLD,
        loyalist: Colors.TIER_PLATINUM
    };

    const embed = new EmbedBuilder()
        .setColor(tierColors[tierInfo.tier] || Colors.INFO)
        .setTitle(`🎭 ${tierInfo.tier_name}`)
        .setDescription(`${member}, ini adalah tier kamu saat ini!`)
        .addFields(
            {
                name: '⏰ Durasi Stay',
                value: `**${tierInfo.stay_duration_hours} jam** setelah keluar dari voice channel`,
                inline: false
            },
            {
                name: '🔑 Cara Mendapatkan',
                value: tierInfo.requirement,
                inline: false
            }
        )
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });

    if (tierInfo.tier === 'booster' && tierInfo.boost_since) {
        const boostDate = new Date(tierInfo.boost_since);
        embed.addFields({
            name: '🚀 Server Boost',
            value: `✅ Boost sejak: <t:${Math.floor(boostDate.getTime() / 1000)}:R>`,
            inline: false
        });
    } else if (tierInfo.has_role) {
        embed.addFields({
            name: '🎖️ Role',
            value: `✅ Memiliki role: **${tierInfo.has_role}**`,
            inline: false
        });
    }

    return embed;
}

/**
 * Create tiers list embed
 */
export function createTiersListEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('💎 Tier Categories')
        .setDescription('Tier otomatis terdeteksi berdasarkan role dan server boost kamu!\n\u200B')
        .setColor(Colors.TIER_GOLD)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' });

    const tiers = [
        { key: 'booster', emoji: '🚀', color: Colors.TIER_PURPLE },
        { key: 'donatur', emoji: '💝', color: Colors.TIER_GOLD },
        { key: 'loyalist', emoji: '👑', color: Colors.TIER_PLATINUM },
        { key: 'free', emoji: '🆓', color: Colors.INFO }
    ];

    // Import TIER_CATEGORIES
    import('../managers/tierManager.js').then(({ TIER_CATEGORIES }) => {
        tiers.forEach(({ key, emoji }) => {
            const tierInfo = TIER_CATEGORIES[key];
            if (tierInfo) {
                embed.addFields({
                    name: `${emoji} ${tierInfo.name}`,
                    value: `⏰ **${tierInfo.stay_duration_hours} jam** stay\n` +
                          `📝 ${tierInfo.description}\n` +
                          `🔑 ${tierInfo.requirement}`,
                    inline: true
                });
            }
        });
    });

    return embed;
}

/**
 * Create help embed
 */
export function createHelpEmbed(botNumber, musicEnabled = false) {
    const embed = new EmbedBuilder()
        .setTitle('🤖 Satpam Bot Commands')
        .setDescription(
            `**Prefix:** \`satpam!\` atau \`satpam#${botNumber}!\` atau \`!\`\n` +
            `**Bot Number:** #${botNumber}\n\n` +
            `Semua bot menggunakan commands yang sama. Kamu juga bisa menggunakan slash commands!`
        )
        .setColor(Colors.PRIMARY)
        .setTimestamp()
        .setFooter({ text: '🛡️ Satpam Bot' })
        .addFields(
            {
                name: '🛡️ Guard Commands',
                value: '`satpam!panggil` - Panggil bot jaga voice channel\n' +
                      '`satpam!pulang` - Suruh bot pulang dari voice\n' +
                      '`satpam!status` - Lihat status bot saat ini',
                inline: false
            },
            {
                name: '🎭 Tier Commands',
                value: '`satpam!tier` - Lihat tier kamu saat ini\n' +
                      '`satpam!tiers` - Lihat semua tier categories',
                inline: false
            },
            {
                name: '📊 Info Commands',
                value: '`satpam!stats` - Lihat statistik bot\n' +
                      '`satpam!queue` - Lihat antrian\n' +
                      '`satpam!queue_leave` - Keluar dari antrian',
                inline: false
            }
        );

    if (musicEnabled) {
        embed.addFields({
            name: '🎵 Music Commands',
            value: '`satpam!play <url/query>` - Putar musik\n' +
                  '`satpam!stop` - Hentikan musik\n' +
                  '`satpam!pause` - Jeda musik\n' +
                  '`satpam!resume` - Lanjutkan musik\n' +
                  '`satpam!radio` - Lihat status radio\n' +
                  '`satpam!autoplay` - Toggle autoplay',
            inline: false
        });
    }

    embed.addFields({
        name: '💡 Tips',
        value: '• Semua commands juga tersedia sebagai slash commands (`/panggil`, `/tier`, dll)\n' +
              '• Bot akan otomatis stay di voice channel setelah kamu keluar\n' +
              '• Durasi stay bergantung pada tier kamu',
        inline: false
    });

    return embed;
}

