import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { getIdleChannelId, getMusicEnabledBot } from '../utils/config.js';
import { getUserTier, getStayDurationHours, getTierInfo } from '../managers/tierManager.js';
import { setupSlashCommands, sharedAssignments, channelTimers } from './commands.js';
import { setupPrefixCommands } from './prefixCommands.js';
import { backupManager, AUTO_BACKUP_INTERVAL } from '../managers/backupManager.js';

/**
 * Bot Instance Class
 */
export class BotInstance {
    constructor(botNumber, token) {
        this.botNumber = botNumber;
        this.token = token;
        this.currentChannel = null;
        this.voiceConnection = null;
        this.callerUserId = null;
        this.stayUntil = null;
        this.isIdle = false;
        this.idleChannelId = getIdleChannelId();
        this.musicEnabled = this.checkMusicEnabled();
        
        // Create Discord client
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent
            ]
        });

        // Disable default help command
        this.client.commands = new Collection();
        
        this.setupEvents();
    }

    checkMusicEnabled() {
        const musicBot = getMusicEnabledBot();
        if (musicBot === null) {
            return true; // All bots can play music by default
        }
        return this.botNumber === musicBot;
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log(`🛡️  Satpam Bot #${this.botNumber} (${this.client.user.tag}) telah online!`);
            
            // Setup commands
            setupSlashCommands(this);
            setupPrefixCommands(this);
            
            // Auto-join idle channel
            if (this.idleChannelId) {
                setTimeout(() => this.joinIdleChannel(), 2000);
            }
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });
    }

    async joinIdleChannel() {
        if (!this.idleChannelId) return false;

        try {
            const channel = await this.client.channels.fetch(this.idleChannelId);
            if (!channel || channel.type !== 2) { // 2 = VoiceChannel
                console.log(`⚠️  Bot #${this.botNumber}: Idle channel tidak ditemukan!`);
                return false;
            }

            // Disconnect from current channel if any
            if (this.voiceConnection) {
                this.voiceConnection.destroy();
            }

            // Join idle channel
            this.voiceConnection = await channel.join();
            this.currentChannel = channel;
            this.isIdle = true;
            this.callerUserId = null;
            this.stayUntil = null;

            // Set deafen
            if (this.voiceConnection) {
                this.voiceConnection.setDeaf(true);
            }

            console.log(`✅ Bot #${this.botNumber} join ke idle channel: ${channel.name}`);
            return true;
        } catch (error) {
            console.error(`❌ Bot #${this.botNumber}: Error join idle channel:`, error);
            return false;
        }
    }

    async joinChannel(channel, member) {
        try {
            // Disconnect from current channel if any
            if (this.voiceConnection) {
                this.voiceConnection.destroy();
            }

            this.voiceConnection = await channel.join();
            this.currentChannel = channel;
            this.callerUserId = member.id;
            this.isIdle = false;

            // Set timer
            const tier = getUserTier(member);
            const stayDurationHours = getStayDurationHours(member);

            const stayUntil = new Date();
            stayUntil.setHours(stayUntil.getHours() + stayDurationHours);
            this.stayUntil = stayUntil;

            // Set deafen
            if (this.voiceConnection) {
                this.voiceConnection.setDeaf(true);
            }

            return { tier, stayDurationHours, stayUntil };
        } catch (error) {
            throw error;
        }
    }

    async handleVoiceStateUpdate(oldState, newState) {
        // Skip if it's the bot itself
        if (newState.member.id === this.client.user.id) return;

        // Check if user left the channel we're guarding
        if (oldState.channel && this.currentChannel && 
            oldState.channel.id === this.currentChannel.id && 
            !this.isIdle) {
            
            setTimeout(async () => {
                if (!this.currentChannel) return;

                try {
                    const channel = await this.client.channels.fetch(this.currentChannel.id);
                    if (channel.members.size <= 1) {
                        // Channel is empty, start timer
                        await this.startTimer();
                    }
                } catch (error) {
                    console.error(`Error in voice state update:`, error);
                }
            }, 2000);
        }
    }

    async startTimer() {
        if (!this.callerUserId || !this.stayUntil) return;

        const remaining = this.stayUntil.getTime() - Date.now();
        if (remaining <= 0) {
            await this.disconnect();
            return;
        }

        // Wait until 5 minutes before expiry
        const waitTime = remaining - (5 * 60 * 1000);
        if (waitTime > 0) {
            setTimeout(() => this.send5MinuteWarning(), waitTime);
        }

        // Wait until expiry
        setTimeout(() => this.disconnect(), remaining);
    }

    async send5MinuteWarning() {
        // TODO: Implement 5 minute warning with buttons
        console.log(`⚠️  Bot #${this.botNumber}: 5 minutes remaining`);
    }

    async disconnect() {
        if (this.voiceConnection) {
            this.voiceConnection.destroy();
            this.voiceConnection = null;
        }

        this.currentChannel = null;
        this.callerUserId = null;
        this.stayUntil = null;
        this.isIdle = false;

        // Return to idle channel
        if (this.idleChannelId) {
            await this.joinIdleChannel();
        }
    }

    async start() {
        try {
            await this.client.login(this.token);
        } catch (error) {
            console.error(`❌ Bot #${this.botNumber}: Login failed:`, error);
            throw error;
        }
    }

    startAutoBackupTask() {
        setInterval(() => {
            try {
                const backupData = {
                    assignments: Object.fromEntries(sharedAssignments),
                    timers: Object.fromEntries(channelTimers),
                    timestamp: new Date().toISOString()
                };
                const backupId = backupManager.createBackup(backupData);
                if (backupId) {
                    console.log(`💾 Auto backup created: ${backupId}`);
                }
            } catch (error) {
                console.error(`⚠️  Error in auto backup:`, error);
            }
        }, AUTO_BACKUP_INTERVAL);
    }

    async stop() {
        await this.disconnect();
        this.client.destroy();
    }
}

