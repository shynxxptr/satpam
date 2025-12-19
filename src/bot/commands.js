import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserTier, getStayDurationHours, getTierInfo, getUserTierInfo, TIER_CATEGORIES } from '../managers/tierManager.js';
import { notificationManager } from '../managers/notificationManager.js';
import { notificationManager } from '../managers/notificationManager.js';

// Shared state untuk semua bot instances
export const sharedAssignments = new Map(); // channelId -> botNumber
export const channelTimers = new Map(); // channelId -> {botNumber, userId, stayUntil, stayDurationHours}

/**
 * Setup slash commands untuk bot instance
 */
export function setupSlashCommands(botInstance) {
    const client = botInstance.client;

    // Command: /panggil
    client.commands.set('panggil', {
        data: new SlashCommandBuilder()
            .setName('panggil')
            .setDescription(`Panggil Satpam Bot #${botInstance.botNumber} untuk jaga voice channel`)
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Voice channel yang mau dijaga (kosongkan untuk channel kamu sekarang)')
                    .setRequired(false)
            ),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });

            let channel = interaction.options.getChannel('channel');
            
            // Jika channel tidak disebutkan, cek apakah user ada di voice channel
            if (!channel) {
                if (interaction.member.voice?.channel) {
                    channel = interaction.member.voice.channel;
                } else {
                    await interaction.editReply({
                        content: '❌ Kamu harus berada di voice channel atau sebutkan channel yang mau dijaga!'
                    });
                    return;
                }
            }

            // Cek apakah channel sudah dijaga bot lain
            if (sharedAssignments.has(channel.id)) {
                const assignedBot = sharedAssignments.get(channel.id);
                if (assignedBot !== botInstance.botNumber) {
                    await interaction.editReply({
                        content: `⚠️ Voice channel ${channel} sudah dijaga oleh **Satpam Bot #${assignedBot}**!`
                    });
                    return;
                } else {
                    await interaction.editReply({
                        content: `ℹ️ **Satpam Bot #${botInstance.botNumber}** sudah menjaga ${channel}!`
                    });
                    return;
                }
            }

            // Get user tier
            const member = interaction.member;
            const tier = getUserTier(member);
            const stayDurationHours = getStayDurationHours(member);
            const tierInfo = getTierInfo(tier);

            // Join voice channel
            try {
                const result = await botInstance.joinChannel(channel, member);

                sharedAssignments.set(channel.id, botInstance.botNumber);
                channelTimers.set(channel.id, {
                    botNumber: botInstance.botNumber,
                    userId: member.id,
                    stayUntil: result.stayUntil.toISOString(),
                    stayDurationHours: result.stayDurationHours
                });

                // Send notification
                await notificationManager.sendJoinNotification(
                    channel, member, botInstance.botNumber, tierInfo.name, result.stayDurationHours
                );

                await interaction.editReply({
                    content: `✅ **Satpam Bot #${botInstance.botNumber}** sekarang menjaga ${channel}!\n` +
                            `📊 **Tier:** ${tierInfo.name} (${result.stayDurationHours} jam stay)\n` +
                            `⏰ Bot akan stay selama **${result.stayDurationHours} jam** setelah kamu keluar dari voice.`
                });
            } catch (error) {
                await interaction.editReply({
                    content: `❌ Error: ${error.message}`
                });
            }
        }
    });

    // Command: /pulang
    client.commands.set('pulang', {
        data: new SlashCommandBuilder()
            .setName('pulang')
            .setDescription(`Suruh Satpam Bot #${botInstance.botNumber} pulang`)
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Voice channel yang mau dikosongkan (kosongkan untuk channel kamu sekarang)')
                    .setRequired(false)
            ),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });

            let channel = interaction.options.getChannel('channel');
            if (!channel) {
                if (interaction.member.voice?.channel) {
                    channel = interaction.member.voice.channel;
                } else {
                    await interaction.editReply({
                        content: '❌ Kamu harus berada di voice channel atau sebutkan channel yang mau dikosongkan!'
                    });
                    return;
                }
            }

            // Cek apakah channel dijaga oleh bot ini
            if (!sharedAssignments.has(channel.id)) {
                await interaction.editReply({
                    content: `⚠️ Voice channel ${channel} tidak dijaga bot satpam!`
                });
                return;
            }

            if (sharedAssignments.get(channel.id) !== botInstance.botNumber) {
                await interaction.editReply({
                    content: `⚠️ Voice channel ${channel} dijaga oleh **Satpam Bot #${sharedAssignments.get(channel.id)}**, bukan Bot #${botInstance.botNumber}!`
                });
                return;
            }

            // Disconnect
            await botInstance.disconnect();
            sharedAssignments.delete(channel.id);
            channelTimers.delete(channel.id);

            await interaction.editReply({
                content: `✅ **Satpam Bot #${botInstance.botNumber}** sudah pulang dari ${channel}!`
            });
        }
    });

    // Command: /status
    client.commands.set('status', {
        data: new SlashCommandBuilder()
            .setName('status')
            .setDescription(`Lihat status Satpam Bot #${botInstance.botNumber}`),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });

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
                        } else {
                            statusMsg += `⏰ **Waktu stay:** Habis (akan disconnect segera)\n`;
                        }
                    }

                    const memberCount = botInstance.currentChannel.members.size - 1;
                    statusMsg += `👥 **Status:** ${memberCount > 0 ? `${memberCount} member aktif` : 'Channel kosong (timer aktif)'}`;
                }
                await interaction.editReply({ content: statusMsg });
            } else {
                await interaction.editReply({
                    content: `⚪ **Satpam Bot #${botInstance.botNumber}** sedang tidak aktif (tersedia)`
                });
            }
        }
    });

    // Command: /tier
    client.commands.set('tier', {
        data: new SlashCommandBuilder()
            .setName('tier')
            .setDescription('Lihat tier kamu berdasarkan role dan server boost'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: true });

            const tierInfo = getUserTierInfo(interaction.member);
            const embed = new EmbedBuilder()
                .setTitle('📊 Tier Info')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Tier', value: `**${tierInfo.tier_name}**`, inline: false },
                    { name: 'Durasi Stay', value: `**${tierInfo.stay_duration_hours} jam** setelah keluar voice`, inline: false },
                    { name: 'Cara Dapatkan', value: tierInfo.requirement, inline: false }
                );

            if (tierInfo.tier === 'booster' && tierInfo.boost_since) {
                const boostDate = new Date(tierInfo.boost_since);
                embed.addFields({
                    name: 'Server Boost',
                    value: `✅ Boost sejak: <t:${Math.floor(boostDate.getTime() / 1000)}:R>`,
                    inline: false
                });
            } else if (tierInfo.has_role) {
                embed.addFields({
                    name: 'Role',
                    value: `✅ Memiliki role: **${tierInfo.has_role}**`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });
        }
    });

    // Command: /tiers
    client.commands.set('tiers', {
        data: new SlashCommandBuilder()
            .setName('tiers')
            .setDescription('Lihat semua tier categories yang tersedia'),
        async execute(interaction) {
            await interaction.deferReply({ ephemeral: false });

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

            embed.setFooter({ text: 'Tier otomatis terdeteksi berdasarkan role dan server boost kamu!' });

            await interaction.editReply({ embeds: [embed] });
        }
    });

    // Register commands
    client.on('ready', async () => {
        try {
            const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
            await client.application.commands.set(commands);
            console.log(`   Synced ${commands.length} command(s)`);
        } catch (error) {
            console.error(`   Failed to sync commands:`, error);
        }
    });

    // Handle command interactions
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '❌ Error executing command!', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Error executing command!', ephemeral: true });
            }
        }
    });
}

