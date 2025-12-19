import discord
from discord.ext import commands
from discord import app_commands
import asyncio
import os
from typing import Dict, Optional, List
import json
from datetime import datetime, timedelta
from managers.subscription_manager import subscription_manager, TIER_CATEGORIES
from managers.statistics import statistics_manager
from managers.queue_manager import queue_manager
from managers.notification_manager import notification_manager
from managers.custom_messages import custom_messages_manager
from managers.backup_manager import backup_manager
from managers.scheduler import scheduler

# Load .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Konfigurasi
MAX_SATPAM_BOTS = 5  # Jumlah maksimal bot satpam

# Helper function untuk mencari config.json
def find_config_file():
    """Find config.json file in multiple possible locations"""
    config_paths = [
        'config.json',  # Current directory
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.json'),  # Root from bot/
        os.path.join(os.path.dirname(__file__), '..', 'config.json'),  # Relative from bot/
        os.path.join(os.getcwd(), 'config.json'),  # Absolute from current working directory
    ]
    
    for config_path in config_paths:
        abs_path = os.path.abspath(config_path)
        if os.path.exists(abs_path):
            return abs_path
    return None

# Load bot tokens dari config
def load_bot_tokens():
    """Load bot tokens dari file config atau environment variables"""
    tokens = []
    
    # Coba load dari file config.json
    config_path = find_config_file()
    if config_path:
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                tokens = config.get('bot_tokens', [])
        except (FileNotFoundError, json.JSONDecodeError):
            pass
    
    # Filter out empty/placeholder tokens
    if tokens:
        tokens = [
            token for token in tokens 
            if token and token not in ['', 'token_bot_1_disini', 'token_bot_2_disini', 
                                      'token_bot_3_disini', 'token_bot_4_disini', 'token_bot_5_disini']
        ]
    
    # Atau load dari environment variables
    if not tokens:
        for i in range(1, MAX_SATPAM_BOTS + 1):
            token = os.getenv(f'DISCORD_BOT_TOKEN_{i}')
            if token and token != 'YOUR_BOT_TOKEN_HERE':
                tokens.append(token)
    
    # Fallback: coba single token
    if not tokens:
        single_token = os.getenv('DISCORD_BOT_TOKEN')
        if single_token and single_token != 'YOUR_BOT_TOKEN_HERE':
            tokens = [single_token]
    
    return tokens

# Load idle voice channel ID dari config
def load_idle_channel_id():
    """Load idle voice channel ID dari config"""
    config_path = find_config_file()
    if config_path:
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                idle_id = config.get('idle_voice_channel_id')
                if idle_id:
                    return int(idle_id)
        except (FileNotFoundError, ValueError, KeyError, json.JSONDecodeError):
            pass
    
    # Default dari environment variable
    idle_id = os.getenv('IDLE_VOICE_CHANNEL_ID')
    if idle_id:
        try:
            return int(idle_id)
        except ValueError:
            pass
    
    return None

# Load music enabled bot number dari config
def load_music_enabled_bot():
    """Load bot number yang enabled untuk music dari config"""
    config_path = find_config_file()
    if config_path:
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                music_bot = config.get('music_enabled_bot')
                if music_bot:
                    return int(music_bot)
        except (FileNotFoundError, ValueError, KeyError, json.JSONDecodeError):
            pass
    
    # Default dari environment variable
    music_bot = os.getenv('MUSIC_ENABLED_BOT')
    if music_bot:
        try:
            return int(music_bot)
        except ValueError:
            pass
    
    return None  # None = semua bot bisa music (default behavior)

# Shared state untuk semua bot instances (bisa pakai database/file nanti)
# Format: {channel_id: bot_instance_number}
shared_assignments: Dict[int, int] = {}

# Track channel assignments dengan info user dan timer
# Format: {channel_id: {bot_number, user_id, stay_until, timer_task}}
channel_timers: Dict[int, Dict] = {}

# Shared bot instances untuk akses dari notification manager
shared_bot_instances: Dict[int, 'SatpamBotInstance'] = {}

intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.guilds = True

# Helper functions untuk check bot availability
def get_available_bot() -> Optional[int]:
    """Get first available bot (idle or not connected)"""
    for bot_number, bot_instance in shared_bot_instances.items():
        if bot_instance.is_idle or (not bot_instance.voice_client or not bot_instance.voice_client.is_connected()):
            return bot_number
    return None

def are_all_bots_busy() -> bool:
    """Check if all bots are busy (not idle and connected)"""
    if not shared_bot_instances:
        return True
    
    for bot_instance in shared_bot_instances.values():
        if bot_instance.is_idle or (not bot_instance.voice_client or not bot_instance.voice_client.is_connected()):
            return False
    return True

async def check_and_assign_queue_global():
    """Global function to check queue and assign any available bot"""
    try:
        next_user = queue_manager.get_next_in_queue()
        if not next_user:
            return
        
        # Find available bot
        available_bot_number = get_available_bot()
        if not available_bot_number:
            return  # No bot available
        
        available_bot = shared_bot_instances[available_bot_number]
        
        # Get channel
        channel = available_bot.bot.get_channel(next_user["channel_id"])
        if not channel:
            try:
                channel = await available_bot.bot.fetch_channel(next_user["channel_id"])
            except:
                queue_manager.remove_from_queue(next_user["user_id"])
                return
        
        # Get user
        try:
            user = await channel.guild.fetch_member(next_user["user_id"])
        except:
            queue_manager.remove_from_queue(next_user["user_id"])
            return
        
        # Remove from queue
        queue_manager.remove_from_queue(next_user["user_id"])
        
        # Get user tier
        tier = subscription_manager.get_user_tier(user)
        stay_duration_hours = subscription_manager.get_stay_duration_hours(user)
        tier_info = subscription_manager.get_tier_info(tier)
        
        # Join channel
        try:
            if available_bot.voice_client and available_bot.voice_client.is_connected():
                await available_bot.voice_client.disconnect()
            
            available_bot.voice_client = await channel.connect()
            available_bot.current_channel = channel
            available_bot.caller_user_id = user.id
            available_bot.is_idle = False
            shared_assignments[channel.id] = available_bot_number
            
            # Set timer
            stay_until = datetime.now() + timedelta(hours=stay_duration_hours)
            available_bot.stay_until = stay_until
            
            channel_timers[channel.id] = {
                "bot_number": available_bot_number,
                "user_id": user.id,
                "stay_until": stay_until.isoformat(),
                "stay_duration_hours": stay_duration_hours
            }
            
            # Send notification
            await notification_manager.send_queue_ready_notification(channel, user, available_bot_number)
            await notification_manager.send_join_notification(channel, user, available_bot_number, tier_info['name'], stay_duration_hours)
            
            # Set bot to deafen
            await available_bot.voice_client.guild.change_voice_state(
                channel=channel,
                self_deaf=True,
                self_mute=False
            )
            
            print(f"✅ Bot #{available_bot_number} auto-assigned to queue user {user.id} in channel {channel.id}")
            
        except Exception as e:
            print(f"Error auto-assigning from queue: {e}")
            # Re-add to queue if failed
            queue_manager.add_to_queue(user.id, channel.id, tier)
            
    except Exception as e:
        print(f"Error in global queue check: {e}")


class SatpamBotInstance:
    """Class untuk setiap bot instance"""
    
    def __init__(self, bot_number: int, token: str):
        self.bot_number = bot_number
        self.token = token
        # Prefix commands: "satpam!" atau "satpam#bot_number!" atau "!"
        self.bot = commands.Bot(
            command_prefix=lambda bot, msg: [
                f'satpam!',
                f'satpam#{bot_number}!',
                f'!',
                f'!{bot_number}'
            ],
            intents=intents
        )
        self.current_channel: Optional[discord.VoiceChannel] = None
        self.voice_client: Optional[discord.VoiceClient] = None
        self.caller_user_id: Optional[int] = None  # User yang memanggil bot
        self.stay_until: Optional[datetime] = None  # Bot stay sampai waktu ini
        self.timer_task: Optional[asyncio.Task] = None  # Task untuk timer
        self.idle_channel_id: Optional[int] = load_idle_channel_id()  # Idle channel ID
        self.is_idle: bool = False  # Flag untuk cek apakah bot sedang di idle channel
        self.timer_confirmation: Optional[bool] = None  # Timer confirmation status
        self.warning_sent: bool = False  # Flag untuk cek apakah warning sudah dikirim
        self.reconnect_retries: int = 0  # Reconnect retry counter
        self.music_enabled: bool = False  # Flag apakah bot ini bisa play music
        self._check_music_enabled()
        self.setup_commands()
        shared_bot_instances[bot_number] = self  # Register instance
    
    def _check_music_enabled(self):
        """Cek apakah bot ini enabled untuk music"""
        music_bot = load_music_enabled_bot()
        if music_bot is None:
            # Tidak ada config, semua bot bisa music (default)
            self.music_enabled = True
        else:
            # Hanya bot tertentu yang bisa music
            # Cek apakah bot number valid (tidak melebihi jumlah bot yang ada)
            tokens = load_bot_tokens()
            if music_bot > len(tokens):
                # Music bot number melebihi jumlah bot, disable music
                self.music_enabled = False
            else:
                self.music_enabled = (self.bot_number == music_bot)
    
    async def join_idle_channel(self):
        """Join ke idle channel jika tersedia"""
        if not self.idle_channel_id:
            return False
        
        try:
            # Cek apakah bot sudah di idle channel
            if self.voice_client and self.voice_client.is_connected():
                if self.current_channel and self.current_channel.id == self.idle_channel_id:
                    return True  # Sudah di idle channel
            
            # Get channel
            idle_channel = self.bot.get_channel(self.idle_channel_id)
            if not idle_channel:
                # Try fetch jika channel tidak ada di cache
                try:
                    idle_channel = await self.bot.fetch_channel(self.idle_channel_id)
                except:
                    print(f"⚠️  Bot #{self.bot_number}: Idle channel tidak ditemukan!")
                    return False
            
            # Disconnect dari channel lain jika ada
            if self.voice_client and self.voice_client.is_connected():
                await self.voice_client.disconnect()
            
            # Join idle channel
            self.voice_client = await idle_channel.connect()
            self.current_channel = idle_channel
            self.is_idle = True
            self.caller_user_id = None
            self.stay_until = None
            
            # Set bot to deafen
            await self.voice_client.guild.change_voice_state(
                channel=idle_channel,
                self_deaf=True,
                self_mute=False
            )
            
            print(f"✅ Bot #{self.bot_number} join ke idle channel: {idle_channel.name}")
            return True
            
        except Exception as e:
            print(f"❌ Bot #{self.bot_number}: Error join idle channel: {e}")
            return False
    
    def setup_commands(self):
        """Setup commands untuk bot instance ini"""
        
        @self.bot.event
        async def on_ready():
            print(f'🛡️  Satpam Bot #{self.bot_number} ({self.bot.user}) telah online!')
            try:
                synced = await self.bot.tree.sync()
                print(f'   Synced {len(synced)} command(s)')
            except Exception as e:
                print(f'   Failed to sync commands: {e}')
            
            # Auto-join idle channel jika tersedia
            if self.idle_channel_id:
                await asyncio.sleep(2)  # Tunggu bot fully ready
                await self.join_idle_channel()
            
            # Setup additional commands
            from bot_commands import setup_additional_commands
            setup_additional_commands(self)
            
            # Setup prefix commands
            try:
                from prefix_commands import setup_prefix_commands
                setup_prefix_commands(self)
                print(f"💬 Bot #{self.bot_number}: Prefix commands enabled (satpam!)")
            except Exception as e:
                print(f"⚠️  Bot #{self.bot_number}: Error setting up prefix commands: {e}")
            
            # Setup music commands (optional - requires yt-dlp)
            # Hanya setup jika bot ini enabled untuk music
            if self.music_enabled:
                try:
                    from bot_music_commands import setup_music_commands
                    setup_music_commands(self)
                    print(f"🎵 Bot #{self.bot_number}: Music commands enabled")
                except ImportError:
                    print(f"⚠️  Bot #{self.bot_number}: Music commands not available (yt-dlp not installed)")
            else:
                print(f"🔇 Bot #{self.bot_number}: Music disabled (only Bot #{load_music_enabled_bot()} can play music)")
            
            # Start auto-reconnect task
            asyncio.create_task(self._auto_reconnect_task())
            
            # Start scheduled stay task
            asyncio.create_task(self._scheduled_stay_task())
            
            # Setup auto-backup task
            asyncio.create_task(self._auto_backup_task())
        
        @self.bot.tree.command(name="panggil", description=f"Panggil Satpam Bot #{self.bot_number} untuk jaga voice channel")
        @app_commands.describe(channel="Voice channel yang mau dijaga (kosongkan untuk channel kamu sekarang)")
        async def panggil_satpam(interaction: discord.Interaction, channel: Optional[discord.VoiceChannel] = None):
            """Command untuk memanggil bot satpam ke voice channel"""
            await interaction.response.defer(ephemeral=True)
            
            # Jika channel tidak disebutkan, cek apakah user ada di voice channel
            if channel is None:
                if interaction.user.voice and interaction.user.voice.channel:
                    channel = interaction.user.voice.channel
                else:
                    await interaction.followup.send(
                        "❌ Kamu harus berada di voice channel atau sebutkan channel yang mau dijaga!",
                        ephemeral=True
                    )
                    return
            
            # Cek apakah channel sudah dijaga bot lain
            if channel.id in shared_assignments:
                assigned_bot = shared_assignments[channel.id]
                if assigned_bot != self.bot_number:
                    await interaction.followup.send(
                        f"⚠️ Voice channel {channel.mention} sudah dijaga oleh **Satpam Bot #{assigned_bot}**!",
                        ephemeral=True
                    )
                    return
                else:
                    # Bot ini sudah di channel ini
                    await interaction.followup.send(
                        f"ℹ️ **Satpam Bot #{self.bot_number}** sudah menjaga {channel.mention}!",
                        ephemeral=True
                    )
                    return
            
            # Cek apakah bot ini sedang di channel lain (atau di idle channel)
            # Jika bot ini tidak available, cek apakah ada bot lain yang available
            if self.voice_client and self.voice_client.is_connected() and not self.is_idle:
                # Bot ini sedang menjaga channel lain, cek apakah ada bot lain yang available
                available_bot = get_available_bot()
                if available_bot and available_bot != self.bot_number:
                    # Ada bot lain yang available, gunakan bot itu
                    await interaction.followup.send(
                        f"ℹ️ Bot #{self.bot_number} sedang sibuk. Mencoba menggunakan bot lain...",
                        ephemeral=True
                    )
                    # Let the available bot handle it (will be handled by queue or direct call)
                    # For now, add to queue if all bots are busy
                    if are_all_bots_busy():
                        tier = subscription_manager.get_user_tier(member)
                        position = queue_manager.add_to_queue(member.id, channel.id, tier)
                        await interaction.followup.send(
                            f"⏳ Semua bot sedang sibuk! Kamu sudah ditambahkan ke antrian (posisi #{position}).\n"
                            f"Bot akan otomatis dipanggil saat ada bot yang tersedia.",
                            ephemeral=False
                        )
                        return
                else:
                    # Tidak ada bot lain yang available, bot ini harus pindah
                    # Jika bot ini enabled music dan sedang play music, stop music dulu
                    if self.music_enabled:
                        from managers.music_manager import music_manager
                        status = music_manager.get_radio_status()
                        if status and status['bot_number'] == self.bot_number:
                            # Bot sedang play music, stop music dulu
                            if self.voice_client.is_playing():
                                self.voice_client.stop()
                            music_manager.unlock_radio()
                            music_manager.is_playing = False
                    
                    # Disconnect dari channel lama dan pindah ke channel baru
                    old_channel = self.voice_client.channel
                    await self.voice_client.disconnect()
                    if old_channel and old_channel.id in shared_assignments:
                        del shared_assignments[old_channel.id]
                    # Continue to join new channel
            elif self.is_idle:
                # Bot sedang di idle channel, bisa langsung pindah
                old_channel = self.voice_client.channel if self.voice_client else None
                if self.voice_client and self.voice_client.is_connected():
                    await self.voice_client.disconnect()
                if old_channel and old_channel.id in shared_assignments:
                    del shared_assignments[old_channel.id]
                self.is_idle = False
            elif are_all_bots_busy():
                # Semua bot sibuk, tambahkan ke queue
                tier = subscription_manager.get_user_tier(member)
                position = queue_manager.add_to_queue(member.id, channel.id, tier)
                await interaction.followup.send(
                    f"⏳ Semua bot sedang sibuk! Kamu sudah ditambahkan ke antrian (posisi #{position}).\n"
                    f"Bot akan otomatis dipanggil saat ada bot yang tersedia.",
                    ephemeral=False
                )
                return
            
            # Get user tier dan durasi stay berdasarkan role
            member = interaction.user
            if isinstance(member, discord.User):
                # Jika user belum di guild, coba get member
                try:
                    member = await interaction.guild.fetch_member(member.id)
                except:
                    await interaction.followup.send(
                        "❌ Error: Tidak bisa mendapatkan info member!",
                        ephemeral=True
                    )
                    return
            
            tier = subscription_manager.get_user_tier(member)
            stay_duration_hours = subscription_manager.get_stay_duration_hours(member)
            tier_info = subscription_manager.get_tier_info(tier)
            user_id = member.id
            
            # Join voice channel
            try:
                self.voice_client = await channel.connect()
                self.current_channel = channel
                self.caller_user_id = user_id
                self.is_idle = False  # Tidak lagi di idle channel
                shared_assignments[channel.id] = self.bot_number
                
                # Set timer untuk stay (akan di-set saat user keluar)
                # Bot akan stay selama durasi sesuai tier user
                stay_until = datetime.now() + timedelta(hours=stay_duration_hours)
                self.stay_until = stay_until
                
                # Store timer info
                channel_timers[channel.id] = {
                    "bot_number": self.bot_number,
                    "user_id": user_id,
                    "stay_until": stay_until.isoformat(),
                    "stay_duration_hours": stay_duration_hours
                }
                
                # Send notification using custom message
                message = custom_messages_manager.get_message(
                    "join",
                    bot=f"#{self.bot_number}",
                    channel=channel.mention,
                    tier=tier_info['name'],
                    duration=stay_duration_hours
                )
                
                # Send notification to voice channel
                await notification_manager.send_join_notification(
                    channel, member, self.bot_number, tier_info['name'], stay_duration_hours
                )
                
                await interaction.followup.send(
                    f"✅ **Satpam Bot #{self.bot_number}** sekarang menjaga {channel.mention}!\n"
                    f"📊 **Tier:** {tier_info['name']} ({stay_duration_hours} jam stay)\n"
                    f"⏰ Bot akan stay selama **{stay_duration_hours} jam** setelah kamu keluar dari voice.",
                    ephemeral=False
                )
                
                # Record statistics (will be updated when bot actually disconnects)
                # For now, just mark that call was made
                
                # Set bot to deafen (optional)
                await self.voice_client.guild.change_voice_state(
                    channel=channel, 
                    self_deaf=True, 
                    self_mute=False
                )
                
            except discord.errors.ClientException as e:
                await interaction.followup.send(
                    f"❌ Bot sudah terhubung ke voice channel lain! Error: {str(e)}",
                    ephemeral=True
                )
            except Exception as e:
                await interaction.followup.send(
                    f"❌ Error: {str(e)}",
                    ephemeral=True
                )
        
        @self.bot.tree.command(name="pulang", description=f"Suruh Satpam Bot #{self.bot_number} pulang")
        @app_commands.describe(channel="Voice channel yang mau dikosongkan (kosongkan untuk channel kamu sekarang)")
        async def pulang_satpam(interaction: discord.Interaction, channel: Optional[discord.VoiceChannel] = None):
            """Command untuk menyuruh bot satpam pulang"""
            await interaction.response.defer(ephemeral=True)
            
            # Jika channel tidak disebutkan, cek apakah user ada di voice channel
            if channel is None:
                if interaction.user.voice and interaction.user.voice.channel:
                    channel = interaction.user.voice.channel
                else:
                    await interaction.followup.send(
                        "❌ Kamu harus berada di voice channel atau sebutkan channel yang mau dikosongkan!",
                        ephemeral=True
                    )
                    return
            
            # Cek apakah channel dijaga oleh bot ini
            if channel.id not in shared_assignments:
                await interaction.followup.send(
                    f"⚠️ Voice channel {channel.mention} tidak dijaga bot satpam!",
                    ephemeral=True
                )
                return
            
            if shared_assignments[channel.id] != self.bot_number:
                await interaction.followup.send(
                    f"⚠️ Voice channel {channel.mention} dijaga oleh **Satpam Bot #{shared_assignments[channel.id]}**, bukan Bot #{self.bot_number}!",
                    ephemeral=True
                )
                return
            
            # Cancel timer jika ada
            if self.timer_task and not self.timer_task.done():
                self.timer_task.cancel()
                self.timer_task = None
            
            # Disconnect bot
            if self.voice_client and self.voice_client.is_connected():
                await self.voice_client.disconnect()
                self.voice_client = None
                self.current_channel = None
                self.caller_user_id = None
                self.stay_until = None
                self.is_idle = False
            
            if channel.id in shared_assignments:
                del shared_assignments[channel.id]
            if channel.id in channel_timers:
                del channel_timers[channel.id]
            
            # Join idle channel setelah disconnect
            if self.idle_channel_id:
                await self.join_idle_channel()
            
            # Check queue dan auto-assign
            await self._check_and_assign_queue()
            
            await interaction.followup.send(
                f"✅ **Satpam Bot #{self.bot_number}** sudah pulang dari {channel.mention}!",
                ephemeral=False
            )
        
        @self.bot.tree.command(name="status", description=f"Lihat status Satpam Bot #{self.bot_number}")
        async def status_satpam(interaction: discord.Interaction):
            """Command untuk melihat status bot ini"""
            await interaction.response.defer(ephemeral=True)
            
            if self.current_channel:
                if self.is_idle:
                    status_msg = f"💤 **Satpam Bot #{self.bot_number}** sedang di idle channel: {self.current_channel.mention}\n"
                    status_msg += "⏳ Menunggu untuk dipanggil..."
                else:
                    status_msg = f"🟢 **Satpam Bot #{self.bot_number}** sedang menjaga {self.current_channel.mention}\n"
                    
                    if self.stay_until:
                        remaining = (self.stay_until - datetime.now()).total_seconds() / 3600
                        if remaining > 0:
                            status_msg += f"⏰ **Waktu stay tersisa:** {remaining:.1f} jam\n"
                        else:
                            status_msg += f"⏰ **Waktu stay:** Habis (akan disconnect segera)\n"
                    
                    if len(self.current_channel.members) <= 1:
                        status_msg += "👥 **Status:** Channel kosong (timer aktif)"
                    else:
                        status_msg += f"👥 **Status:** {len(self.current_channel.members)-1} member aktif"
                
                await interaction.followup.send(status_msg, ephemeral=True)
            else:
                await interaction.followup.send(
                    f"⚪ **Satpam Bot #{self.bot_number}** sedang tidak aktif (tersedia)",
                    ephemeral=True
                )
        
        @self.bot.tree.command(name="tier", description="Lihat tier kamu berdasarkan role dan server boost")
        async def tier_info(interaction: discord.Interaction):
            """Command untuk melihat tier info user"""
            await interaction.response.defer(ephemeral=True)
            
            member = interaction.user
            if isinstance(member, discord.User):
                try:
                    member = await interaction.guild.fetch_member(member.id)
                except:
                    await interaction.followup.send(
                        "❌ Error: Tidak bisa mendapatkan info member!",
                        ephemeral=True
                    )
                    return
            
            tier_info = subscription_manager.get_user_tier_info(member)
            
            embed = discord.Embed(
                title="📊 Tier Info",
                color=discord.Color.blue()
            )
            embed.add_field(
                name="Tier",
                value=f"**{tier_info['tier_name']}**",
                inline=False
            )
            embed.add_field(
                name="Durasi Stay",
                value=f"**{tier_info['stay_duration_hours']} jam** setelah keluar voice",
                inline=False
            )
            embed.add_field(
                name="Cara Dapatkan",
                value=tier_info['requirement'],
                inline=False
            )
            
            # Add info spesifik berdasarkan tier
            if tier_info['tier'] == "booster" and "boost_since" in tier_info:
                embed.add_field(
                    name="Server Boost",
                    value=f"✅ Boost sejak: <t:{int(datetime.fromisoformat(tier_info['boost_since']).timestamp())}:R>",
                    inline=False
                )
            elif tier_info['tier'] in ["donatur", "loyalist"] and "has_role" in tier_info:
                embed.add_field(
                    name="Role",
                    value=f"✅ Memiliki role: **{tier_info['has_role']}**",
                    inline=False
                )
            
            await interaction.followup.send(embed=embed, ephemeral=True)
        
        @self.bot.tree.command(name="tiers", description="Lihat semua tier categories yang tersedia")
        async def tiers_info(interaction: discord.Interaction):
            """Command untuk melihat semua tier categories"""
            await interaction.response.defer(ephemeral=False)
            
            embed = discord.Embed(
                title="💎 Tier Categories",
                description="Tier otomatis berdasarkan role dan server boost!",
                color=discord.Color.gold()
            )
            
            for tier_key, tier_info in TIER_CATEGORIES.items():
                emoji = {
                    "free": "🆓",
                    "booster": "🚀",
                    "donatur": "💝",
                    "loyalist": "👑"
                }.get(tier_key, "📌")
                
                embed.add_field(
                    name=f"{emoji} {tier_info['name']}",
                    value=f"⏰ **{tier_info['stay_duration_hours']} jam** stay\n"
                          f"📝 {tier_info['description']}\n"
                          f"🔑 {tier_info['requirement']}",
                    inline=True
                )
            
            embed.set_footer(text="Tier otomatis terdeteksi berdasarkan role dan server boost kamu!")
            
            await interaction.followup.send(embed=embed, ephemeral=False)
        
        # Auto disconnect dengan timer system
        @self.bot.event
        async def on_voice_state_update(member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
            """Handle voice state update dengan timer system"""
            # Skip jika ini bot sendiri
            if member.id == self.bot.user.id:
                return
            
            # Cek jika ada member yang keluar dari channel yang dijaga bot ini
            if before.channel and self.current_channel and before.channel.id == self.current_channel.id:
                await asyncio.sleep(2)
                
                if not self.current_channel:
                    return
                
                try:
                    # Cek apakah channel masih ada dan hanya bot yang tersisa
                    if len(self.current_channel.members) <= 1:
                        # Channel kosong, start timer
                        if self.caller_user_id and self.stay_until:
                            # Cancel timer lama jika ada
                            if self.timer_task and not self.timer_task.done():
                                self.timer_task.cancel()
                            
                            # Start timer task
                            self.timer_task = asyncio.create_task(
                                self._timer_task(self.current_channel, self.stay_until, self.caller_user_id)
                            )
                            
                            # Notify di channel
                            try:
                                hours = (self.stay_until - datetime.now()).total_seconds() / 3600
                                await self.current_channel.send(
                                    f"🔔 **Satpam Bot #{self.bot_number}** akan stay selama **{hours:.1f} jam** "
                                    f"karena channel kosong. Bot akan otomatis pulang setelah waktu habis."
                                )
                            except:
                                pass
                    
                    # Jika ada member baru join, cancel timer
                    elif len(self.current_channel.members) > 1:
                        if self.timer_task and not self.timer_task.done():
                            self.timer_task.cancel()
                            self.timer_task = None
                            
                except Exception as e:
                    print(f"Error in voice state update: {e}")
        
        async def _timer_task(self, channel: discord.VoiceChannel, stay_until: datetime, user_id: int):
            """Task untuk timer - bot akan disconnect setelah waktu habis dengan 5 min warning"""
            try:
                # Tunggu sampai 5 menit sebelum habis
                wait_seconds = (stay_until - datetime.now()).total_seconds() - (5 * 60)
                
                if wait_seconds > 0:
                    await asyncio.sleep(wait_seconds)
                
                # Send 5 minute warning dengan konfirmasi
                if self.current_channel and self.current_channel.id == channel.id:
                    if len(self.current_channel.members) <= 1:
                        try:
                            user = await channel.guild.fetch_member(user_id)
                            await notification_manager.send_timer_warning(
                                channel, user, 5, self.bot_number
                            )
                            self.warning_sent = True
                            
                            # Wait for confirmation (5 minutes)
                            await asyncio.sleep(5 * 60)
                            
                            # Cek konfirmasi
                            if hasattr(self, 'timer_confirmation') and self.timer_confirmation is False:
                                # User pilih hentikan
                                if self.voice_client and self.voice_client.is_connected():
                                    await self.voice_client.disconnect()
                                
                                # Send notification
                                await notification_manager.send_leave_notification(
                                    channel, user, self.bot_number
                                )
                                
                                # Cleanup
                                if self.current_channel.id in shared_assignments:
                                    del shared_assignments[self.current_channel.id]
                                if self.current_channel.id in channel_timers:
                                    del channel_timers[self.current_channel.id]
                                
                                self.current_channel = None
                                self.voice_client = None
                                self.caller_user_id = None
                                self.stay_until = None
                                self.is_idle = False
                                self.timer_confirmation = None
                                self.warning_sent = False
                                
                                # Join idle channel
                                if self.idle_channel_id:
                                    await self.join_idle_channel()
                                
                                return
                            
                            # User pilih lanjutkan atau tidak respond (default lanjutkan)
                            # Update stay_until untuk tambah waktu
                            self.stay_until = datetime.now() + timedelta(hours=1)  # Tambah 1 jam
                            self.timer_confirmation = None
                            self.warning_sent = False
                            
                            # Restart timer task
                            self.timer_task = asyncio.create_task(
                                self._timer_task(self.current_channel, self.stay_until, user_id)
                            )
                            
                        except Exception as e:
                            print(f"Error in timer warning: {e}")
                
                # Wait until stay_until
                remaining = (stay_until - datetime.now()).total_seconds()
                if remaining > 0:
                    await asyncio.sleep(remaining)
                
                # Cek lagi apakah channel masih kosong
                if self.current_channel and self.current_channel.id == channel.id:
                    if len(self.current_channel.members) <= 1:
                        # Disconnect bot
                        if self.voice_client and self.voice_client.is_connected():
                            await self.voice_client.disconnect()
                            
                            # Notify
                            try:
                                user = await channel.guild.fetch_member(user_id)
                                await notification_manager.send_leave_notification(
                                    channel, user, self.bot_number
                                )
                            except:
                                pass
                        
                        # Record statistics
                        duration_hours = (datetime.now() - (stay_until - timedelta(hours=channel_timers.get(channel.id, {}).get('stay_duration_hours', 0)))).total_seconds() / 3600
                        tier = subscription_manager.get_user_tier(await channel.guild.fetch_member(user_id))
                        statistics_manager.record_call(user_id, self.bot_number, channel.id, tier, duration_hours)
                        
                        # Cleanup
                        if self.current_channel.id in shared_assignments:
                            del shared_assignments[self.current_channel.id]
                        if self.current_channel.id in channel_timers:
                            del channel_timers[self.current_channel.id]
                        
                        self.current_channel = None
                        self.voice_client = None
                        self.caller_user_id = None
                        self.stay_until = None
                        self.is_idle = False
                        self.timer_confirmation = None
                        self.warning_sent = False
                        
                        # Join idle channel setelah disconnect
                        if self.idle_channel_id:
                            await self.join_idle_channel()
                        
                        # Check queue dan auto-assign
                        await self._check_and_assign_queue()
                        
            except asyncio.CancelledError:
                # Timer dibatalkan (ada user join lagi)
                pass
            except Exception as e:
                print(f"Error in timer task: {e}")
    
    async def _check_and_assign_queue(self):
        """Check queue dan auto-assign bot ke user berikutnya (wrapper untuk global function)"""
        await check_and_assign_queue_global()
    
    async def _auto_reconnect_task(self):
        """Auto-reconnect task untuk handle disconnections"""
        while True:
            try:
                await asyncio.sleep(10)  # Check every 10 seconds
                
                # Cek apakah bot seharusnya connected tapi tidak
                if not self.voice_client or not self.voice_client.is_connected():
                    if self.is_idle:
                        # Bot seharusnya di idle channel, reconnect ke idle
                        if self.idle_channel_id:
                            try:
                                await self.join_idle_channel()
                                self.reconnect_retries = 0
                            except Exception as e:
                                print(f"⚠️  Bot #{self.bot_number}: Failed to reconnect to idle channel: {e}")
                                self.reconnect_retries += 1
                                if self.reconnect_retries >= 3:
                                    self.reconnect_retries = 0
                    elif self.current_channel:
                        # Bot seharusnya di channel lain, try reconnect
                        self.reconnect_retries += 1
                        
                        if self.reconnect_retries <= 3:
                            try:
                                print(f"🔄 Bot #{self.bot_number}: Attempting reconnect ({self.reconnect_retries}/3)...")
                                
                                # Verify channel still exists
                                try:
                                    channel = self.bot.get_channel(self.current_channel.id)
                                    if not channel:
                                        channel = await self.bot.fetch_channel(self.current_channel.id)
                                    
                                    # Check if channel is still assigned to this bot
                                    if channel.id in shared_assignments and shared_assignments[channel.id] == self.bot_number:
                                        self.voice_client = await channel.connect()
                                        
                                        # Restore state
                                        await self.voice_client.guild.change_voice_state(
                                            channel=channel,
                                            self_deaf=True,
                                            self_mute=False
                                        )
                                        
                                        print(f"✅ Bot #{self.bot_number}: Reconnected successfully!")
                                        self.reconnect_retries = 0
                                    else:
                                        # Channel reassigned, go to idle
                                        self.current_channel = None
                                        self.caller_user_id = None
                                        self.stay_until = None
                                        if self.idle_channel_id:
                                            await self.join_idle_channel()
                                        self.reconnect_retries = 0
                                except discord.errors.NotFound:
                                    # Channel deleted, go to idle
                                    self.current_channel = None
                                    self.caller_user_id = None
                                    self.stay_until = None
                                    if channel.id in shared_assignments:
                                        del shared_assignments[channel.id]
                                    if channel.id in channel_timers:
                                        del channel_timers[channel.id]
                                    if self.idle_channel_id:
                                        await self.join_idle_channel()
                                    self.reconnect_retries = 0
                                    
                            except Exception as e:
                                print(f"❌ Bot #{self.bot_number}: Reconnect failed: {e}")
                                if self.reconnect_retries >= 3:
                                    # Max retries, join idle channel
                                    self.current_channel = None
                                    self.caller_user_id = None
                                    self.stay_until = None
                                    if self.idle_channel_id:
                                        await self.join_idle_channel()
                                    self.reconnect_retries = 0
                                    # Check queue after going idle
                                    await check_and_assign_queue_global()
                        else:
                            # Max retries reached, join idle
                            self.current_channel = None
                            self.caller_user_id = None
                            self.stay_until = None
                            if self.idle_channel_id:
                                await self.join_idle_channel()
                            self.reconnect_retries = 0
                            # Check queue after going idle
                            await check_and_assign_queue_global()
                    else:
                        # No current channel, should be in idle
                        if self.idle_channel_id and not self.is_idle:
                            await self.join_idle_channel()
                            self.reconnect_retries = 0
                else:
                    # Connected, reset retries
                    self.reconnect_retries = 0
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️  Error in auto-reconnect task: {e}")
    
    async def _scheduled_stay_task(self):
        """Task untuk handle scheduled stays (runs on all bots, but only one will execute)"""
        # Only run on first bot to avoid duplicate checks
        if self.bot_number != 1:
            return
        
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                now = datetime.now()
                active_schedules = [s for s in scheduler.schedules if s.get("active", False)]
                
                for schedule in active_schedules:
                    scheduled_time = datetime.fromisoformat(schedule["scheduled_time"])
                    
                    # Check if time is within 1 minute
                    time_diff = (scheduled_time - now).total_seconds()
                    
                    if 0 <= time_diff <= 60:  # Within 1 minute
                        # Execute schedule
                        try:
                            # Use any bot instance to fetch channel
                            any_bot = list(shared_bot_instances.values())[0] if shared_bot_instances else None
                            if not any_bot:
                                continue
                            
                            channel = any_bot.bot.get_channel(schedule["channel_id"])
                            if not channel:
                                channel = await any_bot.bot.fetch_channel(schedule["channel_id"])
                            
                            user = await channel.guild.fetch_member(schedule["user_id"])
                            
                            # Check if channel is already guarded
                            if channel.id not in shared_assignments:
                                # Find available bot
                                available_bot_number = get_available_bot()
                                if available_bot_number:
                                    available_bot = shared_bot_instances[available_bot_number]
                                    
                                    tier = subscription_manager.get_user_tier(user)
                                    stay_duration_hours = subscription_manager.get_stay_duration_hours(user)
                                    
                                    if available_bot.voice_client and available_bot.voice_client.is_connected():
                                        await available_bot.voice_client.disconnect()
                                    
                                    available_bot.voice_client = await channel.connect()
                                    available_bot.current_channel = channel
                                    available_bot.caller_user_id = user.id
                                    available_bot.is_idle = False
                                    shared_assignments[channel.id] = available_bot_number
                                    
                                    stay_until = datetime.now() + timedelta(hours=stay_duration_hours)
                                    available_bot.stay_until = stay_until
                                    
                                    channel_timers[channel.id] = {
                                        "bot_number": available_bot_number,
                                        "user_id": user.id,
                                        "stay_until": stay_until.isoformat(),
                                        "stay_duration_hours": stay_duration_hours
                                    }
                                    
                                    # Notify
                                    tier_info = subscription_manager.get_tier_info(tier)
                                    await notification_manager.send_join_notification(
                                        channel, user, available_bot_number, tier_info['name'], stay_duration_hours
                                    )
                                    
                                    print(f"✅ Scheduled stay executed: Bot #{available_bot_number} assigned to {channel.name} for user {user.id}")
                            
                            # Handle recurring
                            if schedule.get("recurring") == "daily":
                                # Schedule for tomorrow
                                schedule["scheduled_time"] = (scheduled_time + timedelta(days=1)).isoformat()
                                scheduler.save_schedules()
                            elif schedule.get("recurring") == "weekly":
                                # Schedule for next week
                                schedule["scheduled_time"] = (scheduled_time + timedelta(days=7)).isoformat()
                                scheduler.save_schedules()
                            else:
                                # One-time, deactivate
                                schedule["active"] = False
                                scheduler.save_schedules()
                                
                        except Exception as e:
                            print(f"Error executing schedule: {e}")
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️  Error in scheduled stay task: {e}")
    
    async def _auto_backup_task(self):
        """Auto backup task"""
        from managers.backup_manager import AUTO_BACKUP_INTERVAL
        
        while True:
            try:
                await asyncio.sleep(AUTO_BACKUP_INTERVAL)
                
                # Create backup data
                backup_data = {
                    "assignments": shared_assignments.copy(),
                    "timers": {
                        str(k): v for k, v in channel_timers.items()
                    },
                    "queue": queue_manager.get_queue_list(),
                    "statistics": statistics_manager.stats.copy()
                }
                
                backup_id = backup_manager.create_backup(backup_data)
                if backup_id:
                    print(f"💾 Auto backup created: {backup_id}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️  Error in auto backup: {e}")
    
    async def start(self):
        """Start bot instance"""
        try:
            # Start auto-backup task
            asyncio.create_task(self._auto_backup_task())
            await self.bot.start(self.token)
        except discord.errors.LoginFailure as e:
            print(f"❌ Bot #{self.bot_number}: Login failed - Token tidak valid!")
            print(f"   Error: {e}")
            print(f"   💡 Pastikan token Bot #{self.bot_number} valid di config.json")
            raise
        except Exception as e:
            print(f"❌ Bot #{self.bot_number}: Error starting bot: {e}")
            raise


async def main():
    """Main function untuk run semua bot instances"""
    tokens = load_bot_tokens()
    
    if not tokens:
        print("❌ ERROR: Tidak ada bot token yang ditemukan!")
        print("\nCara setup:")
        print("1. Buat file config.json dengan format:")
        print('   {"bot_tokens": ["token1", "token2", ...]}')
        print("   (Bisa 1-5 bot tokens)")
        print("\n2. Atau set environment variables:")
        print("   DISCORD_BOT_TOKEN_1=token1")
        print("   DISCORD_BOT_TOKEN_2=token2")
        print("   ... dst")
        return
    
    if len(tokens) > MAX_SATPAM_BOTS:
        print(f"⚠️  WARNING: Hanya akan menggunakan {MAX_SATPAM_BOTS} bot pertama dari {len(tokens)} token yang diberikan")
        tokens = tokens[:MAX_SATPAM_BOTS]
    
    print(f"🚀 Starting {len(tokens)} Satpam Bot(s)...")
    if len(tokens) < MAX_SATPAM_BOTS:
        print(f"ℹ️  Note: Kamu bisa menambahkan lebih banyak bot (maksimal {MAX_SATPAM_BOTS})")
    print("-" * 50)
    
    # Validate music_enabled_bot jika di-set
    music_bot = load_music_enabled_bot()
    if music_bot and music_bot > len(tokens):
        print(f"⚠️  WARNING: music_enabled_bot={music_bot} tapi hanya ada {len(tokens)} bot(s)")
        print(f"   Music akan di-disable untuk semua bot")
    
    # Create bot instances
    bot_instances: List[SatpamBotInstance] = []
    for i, token in enumerate(tokens, start=1):
        # Validate token format (basic check)
        if not token or len(token) < 50:
            print(f"⚠️  Bot #{i}: Token terlalu pendek atau kosong, akan di-skip")
            continue
        
        bot_instance = SatpamBotInstance(i, token)
        bot_instances.append(bot_instance)
    
    if not bot_instances:
        print("❌ ERROR: Tidak ada bot instance yang valid untuk dijalankan!")
        print("💡 Pastikan token di config.json valid dan tidak kosong")
        return
    
    print(f"✅ {len(bot_instances)} bot instance(s) siap untuk dijalankan")
    print()
    
    # Run all bots concurrently
    tasks = [bot.start() for bot in bot_instances]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down all bots...")
    except Exception as e:
        print(f"\n❌ Error: {e}")

