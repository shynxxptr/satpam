/**
 * Notification Manager
 */
export class NotificationManager {
    /**
     * Send join notification
     */
    async sendJoinNotification(channel, user, botNumber, tierName, durationHours) {
        try {
            const textChannel = await this.findTextChannel(channel);
            if (textChannel) {
                await textChannel.send(
                    `✅ ${user} **Satpam Bot #${botNumber}** sekarang menjaga ${channel}!\n` +
                    `📊 **Tier:** ${tierName} (${durationHours} jam stay)\n` +
                    `⏰ Bot akan stay selama **${durationHours} jam** setelah kamu keluar dari voice.`
                );
            }
        } catch (error) {
            console.error('Error sending join notification:', error);
        }
    }

    /**
     * Send leave notification
     */
    async sendLeaveNotification(channel, user, botNumber) {
        try {
            const textChannel = await this.findTextChannel(channel);
            if (textChannel) {
                await textChannel.send(
                    `👋 ${user} **Satpam Bot #${botNumber}** sudah pulang dari ${channel}.`
                );
            }
        } catch (error) {
            console.error('Error sending leave notification:', error);
        }
    }

    /**
     * Send timer warning (5 minutes remaining)
     */
    async sendTimerWarning(channel, user, botNumber, minutesRemaining) {
        try {
            const textChannel = await this.findTextChannel(channel);
            if (textChannel) {
                const message = await textChannel.send(
                    `⚠️ ${user} **Satpam Bot #${botNumber}** akan pulang dalam **${minutesRemaining} menit**!\n` +
                    `Pilih aksi:`
                );

                // Add buttons (would need discord.js button components)
                // For now, just send message
            }
        } catch (error) {
            console.error('Error sending timer warning:', error);
        }
    }

    /**
     * Send queue ready notification
     */
    async sendQueueReadyNotification(channel, user, botNumber) {
        try {
            const textChannel = await this.findTextChannel(channel);
            if (textChannel) {
                await textChannel.send(
                    `🎯 ${user} Bot sudah tersedia! **Satpam Bot #${botNumber}** akan segera menjaga ${channel}.`
                );
            }
        } catch (error) {
            console.error('Error sending queue ready notification:', error);
        }
    }

    /**
     * Find associated text channel for voice channel
     */
    async findTextChannel(voiceChannel) {
        try {
            // Try to find text channel in same category
            if (voiceChannel.parent) {
                const textChannels = voiceChannel.parent.children.cache.filter(
                    ch => ch.type === 0 && ch.permissionsFor(voiceChannel.guild.members.me)?.has(['SendMessages', 'ViewChannel'])
                );
                if (textChannels.size > 0) {
                    return textChannels.first();
                }
            }

            // Fallback: find any text channel bot has access to
            const textChannels = voiceChannel.guild.channels.cache.filter(
                ch => ch.type === 0 && ch.permissionsFor(voiceChannel.guild.members.me)?.has(['SendMessages', 'ViewChannel'])
            );
            
            return textChannels.first() || null;
        } catch (error) {
            console.error('Error finding text channel:', error);
            return null;
        }
    }
}

export const notificationManager = new NotificationManager();

