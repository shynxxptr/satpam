import { EmbedBuilder } from 'discord.js';
import { getUserTier, getStayDurationHours, getTierInfo, getUserTierInfo, TIER_CATEGORIES } from '../managers/tierManager.js';
import { sharedAssignments, channelTimers } from './commands.js';
import { notificationManager } from '../managers/notificationManager.js';

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

            const embed = new EmbedBuilder()
                .setTitle('🤖 Satpam Bot Commands')
                .setDescription('Prefix: `satpam!` atau `satpam#1!` atau `!`\n\n**Semua bot menggunakan commands yang sama**')
                .setColor(0x0099FF)
                .addFields(
                    {
                        name: '🛡️ Guard Commands',
                        value: '`satpam!panggil` - Panggil bot jaga voice\n' +
                              '`satpam!pulang` - Suruh bot pulang\n' +
                              '`satpam!status` - Lihat status bot',
                        inline: false
                    },
                    {
                        name: '🎭 Tier Commands',
                        value: '`satpam!tier` - Lihat tier kamu\n' +
                              '`satpam!tiers` - Lihat semua tier',
                        inline: false
                    },
                    {
                        name: '📊 Info Commands',
                        value: '`satpam!stats` - Lihat statistik\n' +
                              '`satpam!queue` - Lihat queue\n' +
                              '`satpam!queue_leave` - Keluar dari queue',
                        inline: false
                    },
                    {
                        name: 'ℹ️ Note',
                        value: 'Semua commands juga tersedia sebagai slash commands (`/panggil`, `/tier`, dll)',
                        inline: false
                    }
                );

            if (botInstance.musicEnabled) {
                embed.addFields({
                    name: '🎵 Music Commands',
                    value: '`satpam!play <url/query>` - Play music\n' +
                          '`satpam!stop` - Stop music\n' +
                          '`satpam!pause` - Pause music\n' +
                          '`satpam!resume` - Resume music\n' +
                          '`satpam!radio` - Lihat radio status\n' +
                          '`satpam!autoplay` - Enable/disable autoplay',
                    inline: false
                });
            }

            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: panggil
        if (commandName === 'panggil' || commandName === 'call' || commandName === 'guard') {
            let channel = message.member.voice?.channel;
            
            if (!channel) {
                await message.reply('❌ Kamu harus berada di voice channel!');
                return;
            }

            // Cek apakah channel sudah dijaga
            if (sharedAssignments.has(channel.id)) {
                const assignedBot = sharedAssignments.get(channel.id);
                if (assignedBot !== botInstance.botNumber) {
                    await message.reply(`⚠️ Voice channel ${channel} sudah dijaga oleh **Satpam Bot #${assignedBot}**!`);
                    return;
                } else {
                    await message.reply(`ℹ️ **Satpam Bot #${botInstance.botNumber}** sudah menjaga ${channel}!`);
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

                await message.reply(
                    `✅ **Satpam Bot #${botInstance.botNumber}** sekarang menjaga ${channel}!\n` +
                    `🎭 Tier: **${tierInfo.name}** (${result.stayDurationHours} jam stay setelah kamu keluar)`
                );
            } catch (error) {
                await message.reply(`❌ Error: ${error.message}`);
            }
            return;
        }

        // Command: pulang
        if (commandName === 'pulang' || commandName === 'leave' || commandName === 'disconnect') {
            const channel = message.member.voice?.channel;
            
            if (!channel) {
                await message.reply('❌ Kamu harus berada di voice channel!');
                return;
            }

            if (!sharedAssignments.has(channel.id) || sharedAssignments.get(channel.id) !== botInstance.botNumber) {
                await message.reply(`⚠️ Voice channel ${channel} tidak dijaga oleh Bot #${botInstance.botNumber}!`);
                return;
            }

            await botInstance.disconnect();
            sharedAssignments.delete(channel.id);
            channelTimers.delete(channel.id);

            // Send notification
            await notificationManager.sendLeaveNotification(channel, message.member, botInstance.botNumber);

            await message.reply(`✅ **Satpam Bot #${botInstance.botNumber}** sudah pulang dari ${channel}!`);
            return;
        }

        // Command: status
        if (commandName === 'status' || commandName === 'info' || commandName === 'check') {
            if (botInstance.currentChannel) {
                let statusMsg = '';
                if (botInstance.isIdle) {
                    statusMsg = `💤 **Satpam Bot #${botInstance.botNumber}** sedang di idle channel: ${botInstance.currentChannel}\n⏳ Menunggu untuk dipanggil...`;
                } else {
                    statusMsg = `🟢 **Satpam Bot #${botInstance.botNumber}** sedang menjaga ${botInstance.currentChannel}\n`;
                    if (botInstance.stayUntil) {
                        const remaining = (botInstance.stayUntil.getTime() - Date.now()) / (1000 * 60 * 60);
                        if (remaining > 0) {
                            statusMsg += `⏰ **Waktu stay tersisa:** ${remaining.toFixed(1)} jam\n`;
                        }
                    }
                }
                await message.reply(statusMsg);
            } else {
                await message.reply(`⚪ **Satpam Bot #${botInstance.botNumber}** sedang tidak aktif (tersedia)`);
            }
            return;
        }

        // Command: tier
        if (commandName === 'tier' || commandName === 'mytier') {
            const tierInfo = getUserTierInfo(message.member);
            const embed = new EmbedBuilder()
                .setTitle('📊 Tier Info')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Tier', value: `**${tierInfo.tier_name}**`, inline: false },
                    { name: 'Durasi Stay', value: `**${tierInfo.stay_duration_hours} jam** setelah keluar voice`, inline: false },
                    { name: 'Cara Dapatkan', value: tierInfo.requirement, inline: false }
                );
            await message.reply({ embeds: [embed] });
            return;
        }

        // Command: tiers
        if (commandName === 'tiers' || commandName === 'tierlist') {
            const embed = new EmbedBuilder()
                .setTitle('💎 Tier Categories')
                .setDescription('Tier otomatis berdasarkan role dan server boost!')
                .setColor(0xFFD700);

            for (const [tierKey, tierInfo] of Object.entries(TIER_CATEGORIES)) {
                const emoji = {
                    free: '🆓',
                    booster: '🚀',
                    donatur: '💝',
                    loyalist: '👑'
                }[tierKey] || '📌';

                embed.addFields({
                    name: `${emoji} ${tierInfo.name}`,
                    value: `⏰ **${tierInfo.stay_duration_hours} jam** stay\n` +
                          `📝 ${tierInfo.description}\n` +
                          `🔑 ${tierInfo.requirement}`,
                    inline: true
                });
            }

            await message.reply({ embeds: [embed] });
            return;
        }
    });
}
