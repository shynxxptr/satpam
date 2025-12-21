import { EmbedBuilder } from 'discord.js';
import { getUserTier, getStayDurationHours, getTierInfo, getUserTierInfo, TIER_CATEGORIES } from '../managers/tierManager.js';
import { sharedAssignments, channelTimers } from './commands.js';
import { notificationManager } from '../managers/notificationManager.js';
import { getMusicEnabledBot } from '../utils/config.js';
import {
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed,
    createInfoEmbed,
    createStatusEmbed,
    createTierInfoEmbed,
    createTiersListEmbed,
    createHelpEmbed
} from '../utils/embedHelper.js';

/**
 * Setup prefix commands untuk bot instance
 */
export function setupPrefixCommands(botInstance) {
    const client = botInstance.client;

    // Prefix: satpam!, satpam#1!, !, !1
    const prefixes = [
        'satpam!',
        `satpam#${botInstance.botNumber}!`,
        '!',
        `!${botInstance.botNumber}`
    ];

    client.on('messageCreate', async message => {
        // Ignore bots
        if (message.author.bot) return;

        // Check prefix
        let usedPrefix = null;
        for (const prefix of prefixes) {
            if (message.content.startsWith(prefix)) {
                usedPrefix = prefix;
                break;
            }
        }

        if (!usedPrefix) return;

        const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        // Command: help (hanya Bot #1)
        if (commandName === 'help' || commandName === 'h' || commandName === 'commands') {
            if (botInstance.botNumber !== 1) return; // Hanya Bot #1 yang merespons

            const embed = createHelpEmbed(botInstance.botNumber, botInstance.musicEnabled);
            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: panggil
        if (commandName === 'panggil' || commandName === 'call' || commandName === 'guard') {
            let channel = message.member.voice?.channel;
            
            if (!channel) {
                const embed = createErrorEmbed(
                    'Channel Tidak Ditemukan',
                    'Kamu harus berada di voice channel untuk menggunakan command ini!'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            // Cek apakah channel sudah dijaga
            if (sharedAssignments.has(channel.id)) {
                const assignedBot = sharedAssignments.get(channel.id);
                if (assignedBot !== botInstance.botNumber) {
                    const embed = createWarningEmbed(
                        'Channel Sudah Dijaga',
                        `Voice channel ${channel} sudah dijaga oleh **Satpam Bot #${assignedBot}**!`
                    );
                    await message.reply({ embeds: [embed] });
                    return;
                } else {
                    const embed = createInfoEmbed(
                        'Bot Sudah Aktif',
                        `**Satpam Bot #${botInstance.botNumber}** sudah menjaga ${channel}!`
                    );
                    await message.reply({ embeds: [embed] });
                    return;
                }
            }

            // Get user tier
            const tier = getUserTier(message.member);
            const stayDurationHours = getStayDurationHours(message.member);
            const tierInfo = getTierInfo(tier);

            try {
                const result = await botInstance.joinChannel(channel, message.member);

                sharedAssignments.set(channel.id, botInstance.botNumber);
                channelTimers.set(channel.id, {
                    botNumber: botInstance.botNumber,
                    userId: message.member.id,
                    stayUntil: result.stayUntil.toISOString(),
                    stayDurationHours: result.stayDurationHours
                });

                // Send notification
                await notificationManager.sendJoinNotification(
                    channel, message.member, botInstance.botNumber, tierInfo.name, result.stayDurationHours
                );

                const embed = createSuccessEmbed(
                    'Bot Berhasil Dipanggil',
                    `**Satpam Bot #${botInstance.botNumber}** sekarang menjaga ${channel}!`,
                    [
                        { name: '🎭 Tier', value: tierInfo.name, inline: true },
                        { name: '⏰ Durasi Stay', value: `${result.stayDurationHours} jam`, inline: true },
                        { name: '📝 Keterangan', value: `Bot akan tetap stay selama **${result.stayDurationHours} jam** setelah kamu keluar.`, inline: false }
                    ]
                );

                await message.reply({ embeds: [embed] });
            } catch (error) {
                const embed = createErrorEmbed(
                    'Error Memanggil Bot',
                    `Terjadi kesalahan:\n\`\`\`${error.message}\`\`\``
                );
                await message.reply({ embeds: [embed] });
            }
            return;
        }

        // Command: pulang
        if (commandName === 'pulang' || commandName === 'leave' || commandName === 'disconnect') {
            const channel = message.member.voice?.channel;
            
            if (!channel) {
                const embed = createErrorEmbed(
                    'Channel Tidak Ditemukan',
                    'Kamu harus berada di voice channel untuk menggunakan command ini!'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            if (!sharedAssignments.has(channel.id) || sharedAssignments.get(channel.id) !== botInstance.botNumber) {
                const embed = createWarningEmbed(
                    'Bot Tidak Menjaga Channel',
                    `Voice channel ${channel} tidak dijaga oleh **Satpam Bot #${botInstance.botNumber}**!`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            await botInstance.disconnect();
            sharedAssignments.delete(channel.id);
            channelTimers.delete(channel.id);

            // Send notification
            await notificationManager.sendLeaveNotification(channel, message.member, botInstance.botNumber);

            const embed = createSuccessEmbed(
                'Bot Berhasil Dipulangkan',
                `**Satpam Bot #${botInstance.botNumber}** sudah pulang dari ${channel}!`,
                [
                    { name: '📍 Channel', value: `${channel}`, inline: true },
                    { name: '🛡️ Bot', value: `Satpam Bot #${botInstance.botNumber}`, inline: true }
                ]
            );

            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: status
        if (commandName === 'status' || commandName === 'info' || commandName === 'check') {
            if (botInstance.currentChannel) {
                const memberCount = botInstance.currentChannel.members.size - 1;
                const embed = createStatusEmbed(
                    botInstance.botNumber,
                    botInstance.currentChannel,
                    botInstance.isIdle,
                    botInstance.stayUntil,
                    memberCount
                );
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createInfoEmbed(
                    'Bot Tidak Aktif',
                    `**Satpam Bot #${botInstance.botNumber}** sedang tidak aktif dan siap untuk dipanggil.`,
                    [{ name: '📊 Status', value: '⚪ Offline / Tidak Terhubung', inline: true }]
                );
                await message.reply({ embeds: [embed] });
            }
            return;
        }

        // Command: tier
        if (commandName === 'tier' || commandName === 'mytier') {
            const tierInfo = getUserTierInfo(message.member);
            const embed = createTierInfoEmbed(tierInfo, message.member);
            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: tiers
        if (commandName === 'tiers' || commandName === 'tierlist') {
            const embed = createTiersListEmbed();
            
            // Add tier fields
            const tiers = [
                { key: 'booster', emoji: '🚀' },
                { key: 'donatur', emoji: '💝' },
                { key: 'loyalist', emoji: '👑' },
                { key: 'free', emoji: '🆓' }
            ];

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

            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: play (Music)
        if (commandName === 'play' || commandName === 'p') {
            // Cek apakah bot ini enabled untuk music
            if (!botInstance.musicEnabled) {
                const musicBot = getMusicEnabledBot();
                const embed = createErrorEmbed(
                    'Music Tidak Tersedia',
                    `Hanya **Satpam Bot #${musicBot || 1}** yang bisa play music!\n` +
                    `Bot ini (Bot #${botInstance.botNumber}) hanya untuk jaga voice channel.`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            // Cek apakah user ada di voice channel
            const channel = message.member.voice?.channel;
            if (!channel) {
                const embed = createErrorEmbed(
                    'Tidak Ada di Voice Channel',
                    'Kamu harus berada di voice channel untuk play music!'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            // Get query/URL
            const query = args.join(' ');
            if (!query) {
                const embed = createErrorEmbed(
                    'Query Kosong',
                    'Silakan berikan URL atau nama lagu yang ingin diputar!\n' +
                    'Contoh: `satpam!play never gonna give you up`'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            // TODO: Implement music player
            const embed = createInfoEmbed(
                'Music Feature Sedang Dikembangkan',
                'Fitur music player sedang dalam pengembangan.\n' +
                'Command yang kamu kirim:\n' +
                `\`\`\`${query}\`\`\`\n\n` +
                'Fitur yang akan datang:\n' +
                '• Play music dari YouTube\n' +
                '• Play music dari Spotify\n' +
                '• Search dan play lagu\n' +
                '• Control playback (pause, resume, stop)',
                [
                    { name: '🎵 Query', value: query, inline: false },
                    { name: '📍 Channel', value: `${channel}`, inline: true },
                    { name: '🛡️ Bot', value: `Satpam Bot #${botInstance.botNumber}`, inline: true }
                ]
            );
            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: stop (Music)
        if (commandName === 'stop' || commandName === 's') {
            if (!botInstance.musicEnabled) {
                const embed = createErrorEmbed(
                    'Music Tidak Tersedia',
                    `Hanya **Satpam Bot #${getMusicEnabledBot() || 1}** yang bisa mengontrol music!`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const embed = createInfoEmbed(
                'Music Feature Sedang Dikembangkan',
                'Fitur music player sedang dalam pengembangan.\n' +
                'Command stop akan tersedia setelah music player selesai diimplementasikan.'
            );
            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: pause (Music)
        if (commandName === 'pause') {
            if (!botInstance.musicEnabled) {
                const embed = createErrorEmbed(
                    'Music Tidak Tersedia',
                    `Hanya **Satpam Bot #${getMusicEnabledBot() || 1}** yang bisa mengontrol music!`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const embed = createInfoEmbed(
                'Music Feature Sedang Dikembangkan',
                'Fitur music player sedang dalam pengembangan.\n' +
                'Command pause akan tersedia setelah music player selesai diimplementasikan.'
            );
            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: resume (Music)
        if (commandName === 'resume') {
            if (!botInstance.musicEnabled) {
                const embed = createErrorEmbed(
                    'Music Tidak Tersedia',
                    `Hanya **Satpam Bot #${getMusicEnabledBot() || 1}** yang bisa mengontrol music!`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const embed = createInfoEmbed(
                'Music Feature Sedang Dikembangkan',
                'Fitur music player sedang dalam pengembangan.\n' +
                'Command resume akan tersedia setelah music player selesai diimplementasikan.'
            );
            await message.reply({ embeds: [embed] });
            return;
        }
    });
}
