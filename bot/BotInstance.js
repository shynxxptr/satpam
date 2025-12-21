import { Client, GatewayIntentBits, Collection, ChannelType } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { getIdleChannelId, getMusicEnabledBot } from '../utils/config.js';
import { getUserTier, getStayDurationHours, getTierInfo } from '../managers/tierManager.js';
import { setupSlashCommands, sharedAssignments, channelTimers } from './commands.js';
import { setupPrefixCommands } from './prefixCommands.js';
import { backupManager, AUTO_BACKUP_INTERVAL } from '../managers/backupManager.js';
import { initDisTube } from '../managers/musicPlayer.js';

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
            
            // Initialize DisTube for music-enabled bot (for better YouTube search/resolve)
            if (this.musicEnabled) {
                try {
                    initDisTube(this.client);
                } catch (error) {
                    console.error(`❌ Bot #${this.botNumber}: Failed to initialize DisTube:`, error.message);
                }
            }
            
            // Setup commands
            setupSlashCommands(this);
            setupPrefixCommands(this);
            
            // Auto-join idle channel (non-blocking, bot tetap jalan meski gagal)
            if (this.idleChannelId) {
                setTimeout(async () => {
                    const success = await this.joinIdleChannel();
                    if (!success) {
                        console.log(`ℹ️  Bot #${this.botNumber}: Bot tetap aktif, tapi tidak akan auto-join idle channel`);
                        console.log(`   💡 Bot masih bisa digunakan untuk jaga voice channel dengan command /panggil`);
                    }
                }, 2000);
            } else {
                console.log(`ℹ️  Bot #${this.botNumber}: Idle channel tidak dikonfigurasi (opsional)`);
            }
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceStateUpdate(oldState, newState);
        });
    }

    async joinIdleChannel() {
        if (!this.idleChannelId) {
            console.log(`ℹ️  Bot #${this.botNumber}: Idle channel ID tidak di-set (opsional)`);
            return false;
        }

        try {
            // idleChannelId should already be a string from getIdleChannelId()
            // But convert to string again just to be safe
            const channelId = String(this.idleChannelId);
            console.log(`[Bot #${this.botNumber}] Attempting to fetch idle channel: ${channelId}`);
            
            const channel = await this.client.channels.fetch(channelId);
            
            if (!channel) {
                console.log(`⚠️  Bot #${this.botNumber}: Idle channel dengan ID ${channelId} tidak ditemukan!`);
                console.log(`   💡 Pastikan channel ID di config.json benar dan bot memiliki akses ke channel tersebut`);
                return false;
            }

            // Check if it's a voice channel
            if (channel.type !== ChannelType.GuildVoice) {
                console.log(`⚠️  Bot #${this.botNumber}: Channel ${channel.name} (${channelId}) bukan voice channel!`);
                console.log(`   💡 Idle channel harus berupa voice channel`);
                return false;
            }

            // Disconnect from current channel if any
            if (this.voiceConnection) {
                this.voiceConnection.destroy();
                this.voiceConnection = null;
            }

            // Disconnect dari connection yang sudah ada di guild ini (jika ada)
            const existingConnection = getVoiceConnection(channel.guild.id);
            if (existingConnection) {
                existingConnection.destroy();
            }

            // Join idle channel menggunakan @discordjs/voice
            this.voiceConnection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            this.currentChannel = channel;
            this.isIdle = true;
            this.callerUserId = null;
            this.stayUntil = null;

            // Set deafen (setelah connection ready)
            if (this.voiceConnection) {
                this.voiceConnection.on(VoiceConnectionStatus.Ready, () => {
                    // Set deafen setelah ready
                    const member = channel.guild.members.cache.get(this.client.user.id);
                    if (member && member.voice) {
                        member.voice.setDeaf(true).catch(err => {
                            console.log(`⚠️  Bot #${this.botNumber}: Tidak bisa set deafen: ${err.message}`);
                        });
                    }
                });
            }

            console.log(`✅ Bot #${this.botNumber} join ke idle channel: ${channel.name} (${channelId})`);
            return true;
        } catch (error) {
            if (error.code === 10003 || error.status === 404) {
                // Unknown Channel error
                console.log(`⚠️  Bot #${this.botNumber}: Channel dengan ID ${this.idleChannelId} tidak ditemukan!`);
                console.log(`   💡 Kemungkinan penyebab:`);
                console.log(`      - Channel ID di config.json salah`);
                console.log(`      - Channel sudah dihapus`);
                console.log(`      - Bot tidak memiliki akses ke channel tersebut`);
                console.log(`      - Bot tidak ada di server yang memiliki channel tersebut`);
                console.log(`   💡 Bot tetap bisa berjalan, tapi tidak akan auto-join idle channel`);
                console.log(`   💡 Untuk nonaktifkan fitur ini, hapus atau set "idle_voice_channel_id" ke null di config.json`);
            } else if (error.code === 50013 || error.status === 403) {
                // Missing Permissions
                console.log(`⚠️  Bot #${this.botNumber}: Bot tidak memiliki permission untuk join channel ${this.idleChannelId}`);
                console.log(`   💡 Pastikan bot memiliki permission "Connect" dan "View Channel"`);
            } else {
                console.error(`❌ Bot #${this.botNumber}: Error join idle channel:`, error.message || error);
            }
            return false;
        }
    }

    async joinChannel(channel, member) {
        try {
            // Validasi channel
            if (!channel) {
                throw new Error('Channel tidak valid atau null');
            }

            // Validasi channel type (harus GuildVoice)
            if (channel.type !== ChannelType.GuildVoice) {
                throw new Error(`Channel harus berupa voice channel. Tipe channel saat ini: ${channel.type} (harus ${ChannelType.GuildVoice})`);
            }

            // Cek apakah channel bisa di-join (permissions)
            if (!channel.joinable) {
                throw new Error('Bot tidak memiliki permission untuk join channel ini. Pastikan bot memiliki permission "Connect" dan "View Channel"');
            }

            // Disconnect from current channel if any
            if (this.voiceConnection) {
                this.voiceConnection.destroy();
                this.voiceConnection = null;
            }

            // Disconnect dari connection yang sudah ada di channel ini (jika ada)
            const existingConnection = getVoiceConnection(channel.guild.id);
            if (existingConnection) {
                existingConnection.destroy();
            }

            // Join channel menggunakan @discordjs/voice
            this.voiceConnection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            this.currentChannel = channel;
            this.callerUserId = member.id;
            this.isIdle = false;

            // Set timer
            const tier = getUserTier(member);
            const stayDurationHours = getStayDurationHours(member);

            const stayUntil = new Date();
            stayUntil.setHours(stayUntil.getHours() + stayDurationHours);
            this.stayUntil = stayUntil;

            // Set deafen (setelah connection ready)
            if (this.voiceConnection) {
                this.voiceConnection.on(VoiceConnectionStatus.Ready, () => {
                    const member = channel.guild.members.cache.get(this.client.user.id);
                    if (member && member.voice) {
                        member.voice.setDeaf(true).catch(err => {
                            console.log(`⚠️  Bot #${this.botNumber}: Tidak bisa set deafen: ${err.message}`);
                        });
                    }
                });
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

