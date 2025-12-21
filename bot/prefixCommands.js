import { EmbedBuilder } from 'discord.js';
import { getUserTier, getStayDurationHours, getTierInfo, getUserTierInfo, TIER_CATEGORIES } from '../managers/tierManager.js';
import { sharedAssignments, channelTimers } from './commands.js';
import { notificationManager } from '../managers/notificationManager.js';
import { getMusicEnabledBot } from '../utils/config.js';
import { musicPlayer } from '../managers/musicPlayer.js';
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

            // Show loading message
            const loadingMsg = await message.reply('⏳ Mencari lagu...');

            try {
                // Setup error/success callback untuk notify user jika terjadi error atau Spotify fallback success
                let playbackNotification = null;
                const errorCallback = (errorMsg, song, successMsg) => {
                    if (errorMsg) {
                        playbackNotification = { type: 'error', message: errorMsg, song };
                    } else if (successMsg) {
                        playbackNotification = { type: 'success', message: successMsg, song };
                    }
                };

                // Play music
                const song = await musicPlayer.play(query, channel, message.member, errorCallback);
                const guildId = message.guild.id;
                const isNowPlaying = musicPlayer.isPlaying(guildId) && musicPlayer.getNowPlaying(guildId)?.url === song.url;
                
                // Check if playback notification occurred (async, might happen after we send success message)
                setTimeout(async () => {
                    if (playbackNotification) {
                        if (playbackNotification.type === 'error') {
                            const embed = createErrorEmbed(
                                '❌ Error Memutar Musik',
                                `**${playbackNotification.song?.title || 'Lagu'}** gagal diputar:\n\`\`\`${playbackNotification.message}\`\`\``
                            );
                            try {
                                await message.channel.send({ embeds: [embed] });
                            } catch (err) {
                                console.error('Error sending error message:', err);
                            }
                        } else if (playbackNotification.type === 'success') {
                            const embed = createSuccessEmbed(
                                '✅ Auto-Fallback Success',
                                playbackNotification.message,
                                playbackNotification.song ? [
                                    { name: '🎵 Judul', value: playbackNotification.song.title || 'Unknown', inline: false },
                                    ...(playbackNotification.song.spotifyTrack ? [
                                        { name: '🎤 Artis', value: playbackNotification.song.spotifyTrack.artists.join(', '), inline: true }
                                    ] : [])
                                ] : []
                            );
                            try {
                                await message.channel.send({ embeds: [embed] });
                            } catch (err) {
                                console.error('Error sending success message:', err);
                            }
                        }
                    }
                }, 3000); // Check after 3 seconds

                const embed = createSuccessEmbed(
                    isNowPlaying ? '🎵 Musik Dimulai!' : '✅ Lagu Ditambahkan ke Queue',
                    isNowPlaying 
                        ? `Sedang memutar: **${song.title}**` 
                        : `**${song.title}** ditambahkan ke queue`,
                    [
                        { name: '🎵 Judul', value: song.title || 'Unknown', inline: false },
                        ...(song.duration ? [{ name: '⏱️ Durasi', value: song.duration || 'Unknown', inline: true }] : []),
                        ...(song.spotifyTrack ? [
                            { name: '🎤 Artis', value: song.spotifyTrack.artists.join(', '), inline: true },
                            { name: '💿 Album', value: song.spotifyTrack.album || 'Unknown', inline: true }
                        ] : []),
                        { name: '📍 Channel', value: `${channel}`, inline: true },
                        { name: '👤 Requested by', value: `<@${song.requestedBy}>`, inline: true },
                        ...(song.source === 'spotify' ? [{ name: '🎧 Source', value: 'Spotify → YouTube', inline: true }] : [])
                    ]
                );

                // Add thumbnail if available
                if (song.thumbnail) {
                    embed.setThumbnail(song.thumbnail);
                }

                await loadingMsg.edit({ embeds: [embed] });
            } catch (error) {
                const embed = createErrorEmbed(
                    'Error Memutar Musik',
                    `Terjadi kesalahan saat memutar musik:\n\`\`\`${error.message}\`\`\``
                );
                await loadingMsg.edit({ embeds: [embed] });
            }
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

            const guildId = message.guild.id;
            const nowPlaying = musicPlayer.getNowPlaying(guildId);

            if (!nowPlaying && !musicPlayer.isPlaying(guildId)) {
                const embed = createWarningEmbed(
                    'Tidak Ada Musik yang Diputar',
                    'Tidak ada musik yang sedang diputar atau di queue.'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            musicPlayer.stop(guildId);
            
            const embed = createSuccessEmbed(
                '⏹️ Musik Dihentikan',
                'Musik telah dihentikan dan queue telah dikosongkan.',
                [
                    { name: '🛡️ Bot', value: `Satpam Bot #${botInstance.botNumber}`, inline: true }
                ]
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

            const guildId = message.guild.id;
            
            if (!musicPlayer.isPlaying(guildId) && !musicPlayer.isPaused(guildId)) {
                const embed = createWarningEmbed(
                    'Tidak Ada Musik yang Diputar',
                    'Tidak ada musik yang sedang diputar.'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            if (musicPlayer.isPaused(guildId)) {
                const embed = createInfoEmbed(
                    'Musik Sudah Di-pause',
                    'Musik sudah dalam keadaan pause. Gunakan `satpam!resume` untuk melanjutkan.'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const paused = musicPlayer.pause(guildId);
            if (paused) {
                const nowPlaying = musicPlayer.getNowPlaying(guildId);
                const embed = createSuccessEmbed(
                    '⏸️ Musik Di-pause',
                    `Musik **${nowPlaying?.title || 'Unknown'}** telah di-pause.`,
                    [
                        { name: '🎵 Lagu', value: nowPlaying?.title || 'Unknown', inline: false },
                        { name: '💡 Tip', value: 'Gunakan `satpam!resume` untuk melanjutkan', inline: false }
                    ]
                );
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createErrorEmbed(
                    'Gagal Pause',
                    'Tidak bisa pause musik saat ini.'
                );
                await message.reply({ embeds: [embed] });
            }
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

            const guildId = message.guild.id;
            
            if (!musicPlayer.isPaused(guildId)) {
                if (!musicPlayer.isPlaying(guildId)) {
                    const embed = createWarningEmbed(
                        'Tidak Ada Musik yang Diputar',
                        'Tidak ada musik yang sedang diputar atau di-pause.'
                    );
                    await message.reply({ embeds: [embed] });
                    return;
                } else {
                    const embed = createInfoEmbed(
                        'Musik Sudah Berjalan',
                        'Musik sudah dalam keadaan play. Tidak perlu resume.'
                    );
                    await message.reply({ embeds: [embed] });
                    return;
                }
            }

            const resumed = musicPlayer.resume(guildId);
            if (resumed) {
                const nowPlaying = musicPlayer.getNowPlaying(guildId);
                const embed = createSuccessEmbed(
                    '▶️ Musik Dilanjutkan',
                    `Musik **${nowPlaying?.title || 'Unknown'}** telah dilanjutkan.`,
                    [
                        { name: '🎵 Lagu', value: nowPlaying?.title || 'Unknown', inline: false }
                    ]
                );
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createErrorEmbed(
                    'Gagal Resume',
                    'Tidak bisa resume musik saat ini.'
                );
                await message.reply({ embeds: [embed] });
            }
            return;
        }

        // Command: skip (Music)
        if (commandName === 'skip' || commandName === 'next') {
            if (!botInstance.musicEnabled) {
                const embed = createErrorEmbed(
                    'Music Tidak Tersedia',
                    `Hanya **Satpam Bot #${getMusicEnabledBot() || 1}** yang bisa mengontrol music!`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const channel = message.member.voice?.channel;
            if (!channel) {
                const embed = createErrorEmbed(
                    'Tidak Ada di Voice Channel',
                    'Kamu harus berada di voice channel untuk menggunakan command ini!'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const guildId = message.guild.id;
            const skipped = musicPlayer.skip(guildId);
            
            if (skipped) {
                const nowPlaying = musicPlayer.getNowPlaying(guildId);
                const embed = createSuccessEmbed(
                    '⏭️ Lagu Di-skip',
                    nowPlaying 
                        ? `Sekarang memutar: **${nowPlaying.title}**`
                        : 'Queue kosong. Tidak ada lagu selanjutnya.',
                    nowPlaying ? [
                        { name: '🎵 Lagu', value: nowPlaying.title || 'Unknown', inline: false }
                    ] : []
                );
                await message.reply({ embeds: [embed] });
            } else {
                const embed = createWarningEmbed(
                    'Tidak Ada Lagu yang Diputar',
                    'Tidak ada lagu yang sedang diputar untuk di-skip.'
                );
                await message.reply({ embeds: [embed] });
            }
            return;
        }

        // Command: queue (Music)
        if (commandName === 'queue' || commandName === 'q') {
            if (!botInstance.musicEnabled) {
                const embed = createErrorEmbed(
                    'Music Tidak Tersedia',
                    `Hanya **Satpam Bot #${getMusicEnabledBot() || 1}** yang bisa melihat queue!`
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            const guildId = message.guild.id;
            const nowPlaying = musicPlayer.getNowPlaying(guildId);
            const queue = musicPlayer.getQueue(guildId);

            if (!nowPlaying && queue.length === 0) {
                const embed = createInfoEmbed(
                    'Queue Kosong',
                    'Tidak ada lagu yang sedang diputar atau dalam queue.'
                );
                await message.reply({ embeds: [embed] });
                return;
            }

            let description = '';
            if (nowPlaying) {
                description += `**🎵 Sekarang Diputar:**\n${nowPlaying.title}\n\n`;
            }
            
            if (queue.length > 0) {
                description += `**📋 Queue (${queue.length} lagu):**\n`;
                queue.slice(0, 10).forEach((song, index) => {
                    description += `${index + 1}. ${song.title}\n`;
                });
                if (queue.length > 10) {
                    description += `\n... dan ${queue.length - 10} lagu lainnya`;
                }
            } else {
                description += '**📋 Queue kosong**';
            }

            const embed = createInfoEmbed(
                '📋 Music Queue',
                description,
                [
                    { name: '🎵 Now Playing', value: nowPlaying?.title || 'Tidak ada', inline: false },
                    { name: '📊 Queue Length', value: `${queue.length} lagu`, inline: true },
                    { name: '🛡️ Bot', value: `Satpam Bot #${botInstance.botNumber}`, inline: true }
                ]
            );
            
            if (nowPlaying?.thumbnail) {
                embed.setThumbnail(nowPlaying.thumbnail);
            }

            await message.reply({ embeds: [embed] });
            return;
        }
    });
}
