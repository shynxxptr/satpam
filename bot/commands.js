import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUserTier, getStayDurationHours, getTierInfo, getUserTierInfo, TIER_CATEGORIES } from '../managers/tierManager.js';
import { notificationManager } from '../managers/notificationManager.js';
import {
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed,
    createInfoEmbed,
    createStatusEmbed,
    createTierInfoEmbed,
    createTiersListEmbed
} from '../utils/embedHelper.js';

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
                    const embed = createErrorEmbed(
                        'Channel Tidak Ditemukan',
                        'Kamu harus berada di voice channel atau sebutkan channel yang mau dijaga!'
                    );
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
            }

            // Cek apakah channel sudah dijaga bot lain
            if (sharedAssignments.has(channel.id)) {
                const assignedBot = sharedAssignments.get(channel.id);
                if (assignedBot !== botInstance.botNumber) {
                    const embed = createWarningEmbed(
                        'Channel Sudah Dijaga',
                        `Voice channel ${channel} sudah dijaga oleh **Satpam Bot #${assignedBot}**!\n` +
                        `Silakan gunakan bot yang sudah assigned atau panggil bot lain.`
                    );
                    await interaction.editReply({ embeds: [embed] });
                    return;
                } else {
                    const embed = createInfoEmbed(
                        'Bot Sudah Aktif',
                        `**Satpam Bot #${botInstance.botNumber}** sudah menjaga ${channel}!\n` +
                        `Gunakan \`/status\` untuk melihat detail lebih lanjut.`
                    );
                    await interaction.editReply({ embeds: [embed] });
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

                const embed = createSuccessEmbed(
                    'Bot Berhasil Dipanggil',
                    `**Satpam Bot #${botInstance.botNumber}** sekarang menjaga ${channel}!`,
                    [
                        {
                            name: '🎭 Tier',
                            value: tierInfo.name,
                            inline: true
                        },
                        {
                            name: '⏰ Durasi Stay',
                            value: `${result.stayDurationHours} jam`,
                            inline: true
                        },
                        {
                            name: '📝 Keterangan',
                            value: `Bot akan tetap stay selama **${result.stayDurationHours} jam** setelah kamu keluar dari voice channel.`,
                            inline: false
                        }
                    ]
                );

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                const embed = createErrorEmbed(
                    'Error Memanggil Bot',
                    `Terjadi kesalahan saat memanggil bot:\n\`\`\`${error.message}\`\`\``
                );
                await interaction.editReply({ embeds: [embed] });
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
                    const embed = createErrorEmbed(
                        'Channel Tidak Ditemukan',
                        'Kamu harus berada di voice channel atau sebutkan channel yang mau dikosongkan!'
                    );
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
            }

            // Cek apakah channel dijaga oleh bot ini
            if (!sharedAssignments.has(channel.id)) {
                const embed = createWarningEmbed(
                    'Channel Tidak Dijaga',
                    `Voice channel ${channel} tidak dijaga oleh bot satpam!`
                );
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (sharedAssignments.get(channel.id) !== botInstance.botNumber) {
                const assignedBot = sharedAssignments.get(channel.id);
                const embed = createWarningEmbed(
                    'Bot Tidak Cocok',
                    `Voice channel ${channel} dijaga oleh **Satpam Bot #${assignedBot}**, bukan Bot #${botInstance.botNumber}!\n` +
                    `Silakan gunakan bot yang benar untuk command ini.`
                );
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Disconnect
            await botInstance.disconnect();
            sharedAssignments.delete(channel.id);
            channelTimers.delete(channel.id);

            // Send notification
            await notificationManager.sendLeaveNotification(channel, interaction.member, botInstance.botNumber);

            const embed = createSuccessEmbed(
                'Bot Berhasil Dipulangkan',
                `**Satpam Bot #${botInstance.botNumber}** sudah pulang dari ${channel} dan kembali ke idle channel.`,
                [
                    {
                        name: '📍 Channel',
                        value: `${channel}`,
                        inline: true
                    },
                    {
                        name: '🛡️ Bot',
                        value: `Satpam Bot #${botInstance.botNumber}`,
                        inline: true
                    }
                ]
            );

            await interaction.editReply({ embeds: [embed] });
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
                const memberCount = botInstance.currentChannel.members.size - 1;
                const embed = createStatusEmbed(
                    botInstance.botNumber,
                    botInstance.currentChannel,
                    botInstance.isIdle,
                    botInstance.stayUntil,
                    memberCount
                );
                await interaction.editReply({ embeds: [embed] });
            } else {
                const embed = createInfoEmbed(
                    'Bot Tidak Aktif',
                    `**Satpam Bot #${botInstance.botNumber}** sedang tidak aktif dan siap untuk dipanggil.`,
                    [
                        {
                            name: '📊 Status',
                            value: '⚪ Offline / Tidak Terhubung',
                            inline: true
                        }
                    ]
                );
                await interaction.editReply({ embeds: [embed] });
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
            const embed = createTierInfoEmbed(tierInfo, interaction.member);

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
                const embed = createErrorEmbed(
                    'Error',
                    `Terjadi kesalahan saat menjalankan command:\n\`\`\`${error.message}\`\`\``
                );
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                const embed = createErrorEmbed(
                    'Error',
                    `Terjadi kesalahan saat menjalankan command:\n\`\`\`${error.message}\`\`\``
                );
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    });
}
