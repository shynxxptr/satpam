import discord
from discord.ext import commands
from discord import app_commands
import asyncio
import os
from typing import Dict, Optional

# Load .env file if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Konfigurasi
BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE')
MAX_SATPAM_BOTS = 5  # Jumlah maksimal bot satpam

# In-memory storage untuk track bot assignments
# Format: {voice_channel_id: bot_instance_id}
bot_assignments: Dict[int, int] = {}
available_bots = list(range(1, MAX_SATPAM_BOTS + 1))  # Bot 1-5

intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True
intents.guilds = True

bot = commands.Bot(command_prefix='!', intents=intents)


class SatpamBot:
    """Class untuk manage bot satpam instances"""
    
    def __init__(self):
        self.bot_instances: Dict[int, Optional[discord.VoiceClient]] = {}
        self.channel_assignments: Dict[int, int] = {}  # {channel_id: bot_id}
        self.bot_channels: Dict[int, int] = {}  # {bot_id: channel_id}
    
    def get_available_bot(self) -> Optional[int]:
        """Mendapatkan bot yang tersedia"""
        for bot_id in range(1, MAX_SATPAM_BOTS + 1):
            if bot_id not in self.bot_channels:
                return bot_id
        return None
    
    def assign_bot(self, channel_id: int, bot_id: int):
        """Assign bot ke channel"""
        self.channel_assignments[channel_id] = bot_id
        self.bot_channels[bot_id] = channel_id
    
    def unassign_bot(self, channel_id: int):
        """Unassign bot dari channel"""
        if channel_id in self.channel_assignments:
            bot_id = self.channel_assignments[channel_id]
            del self.channel_assignments[channel_id]
            if bot_id in self.bot_channels:
                del self.bot_channels[bot_id]
            return bot_id
        return None
    
    def get_bot_for_channel(self, channel_id: int) -> Optional[int]:
        """Mendapatkan bot ID yang assigned ke channel"""
        return self.channel_assignments.get(channel_id)
    
    def is_channel_guarded(self, channel_id: int) -> bool:
        """Cek apakah channel sudah dijaga bot"""
        return channel_id in self.channel_assignments
    
    def get_all_assignments(self) -> Dict[int, int]:
        """Mendapatkan semua assignments"""
        return self.channel_assignments.copy()


satpam_manager = SatpamBot()


@bot.event
async def on_ready():
    print(f'{bot.user} telah online!')
    print(f'Bot ID: {bot.user.id}')
    try:
        synced = await bot.tree.sync()
        print(f'Synced {len(synced)} command(s)')
    except Exception as e:
        print(f'Failed to sync commands: {e}')


@bot.tree.command(name="panggil", description="Panggil bot satpam untuk jaga voice channel kamu")
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
    
    # Cek apakah channel sudah dijaga
    if satpam_manager.is_channel_guarded(channel.id):
        bot_id = satpam_manager.get_bot_for_channel(channel.id)
        await interaction.followup.send(
            f"⚠️ Voice channel {channel.mention} sudah dijaga oleh **Satpam Bot #{bot_id}**!",
            ephemeral=True
        )
        return
    
    # Cek apakah ada bot yang tersedia
    available_bot_id = satpam_manager.get_available_bot()
    if available_bot_id is None:
        await interaction.followup.send(
            f"❌ Semua bot satpam sedang sibuk! Maksimal {MAX_SATPAM_BOTS} bot bisa aktif bersamaan.",
            ephemeral=True
        )
        return
    
    # Join voice channel
    try:
        voice_client = await channel.connect()
        satpam_manager.bot_instances[available_bot_id] = voice_client
        satpam_manager.assign_bot(channel.id, available_bot_id)
        
        await interaction.followup.send(
            f"✅ **Satpam Bot #{available_bot_id}** sekarang menjaga {channel.mention}!\n"
            f"Bot akan tetap aktif di channel ini sampai dipanggil pergi.",
            ephemeral=False
        )
        
        # Set bot to deafen (optional, biar tidak dengar suara)
        await voice_client.guild.change_voice_state(channel=channel, self_deaf=True, self_mute=False)
        
    except discord.errors.ClientException:
        await interaction.followup.send(
            "❌ Bot sudah terhubung ke voice channel lain!",
            ephemeral=True
        )
    except Exception as e:
        await interaction.followup.send(
            f"❌ Error: {str(e)}",
            ephemeral=True
        )


@bot.tree.command(name="pulang", description="Suruh bot satpam pulang dari voice channel")
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
    
    # Cek apakah channel dijaga
    if not satpam_manager.is_channel_guarded(channel.id):
        await interaction.followup.send(
            f"⚠️ Voice channel {channel.mention} tidak dijaga bot satpam!",
            ephemeral=True
        )
        return
    
    # Disconnect bot
    bot_id = satpam_manager.get_bot_for_channel(channel.id)
    voice_client = satpam_manager.bot_instances.get(bot_id)
    
    if voice_client:
        await voice_client.disconnect()
        del satpam_manager.bot_instances[bot_id]
    
    satpam_manager.unassign_bot(channel.id)
    
    await interaction.followup.send(
        f"✅ **Satpam Bot #{bot_id}** sudah pulang dari {channel.mention}!",
        ephemeral=False
    )


@bot.tree.command(name="status", description="Lihat status semua bot satpam")
async def status_satpam(interaction: discord.Interaction):
    """Command untuk melihat status semua bot satpam"""
    await interaction.response.defer(ephemeral=True)
    
    assignments = satpam_manager.get_all_assignments()
    
    if not assignments:
        await interaction.followup.send(
            "📊 **Status Bot Satpam:**\n\n"
            f"Semua {MAX_SATPAM_BOTS} bot satpam sedang tidak aktif.",
            ephemeral=True
        )
        return
    
    status_lines = []
    for bot_id in range(1, MAX_SATPAM_BOTS + 1):
        if bot_id in satpam_manager.bot_channels:
            channel_id = satpam_manager.bot_channels[bot_id]
            channel = bot.get_channel(channel_id)
            if channel:
                status_lines.append(f"🟢 **Bot #{bot_id}**: Menjaga {channel.mention}")
            else:
                status_lines.append(f"🟡 **Bot #{bot_id}**: Menjaga channel (tidak ditemukan)")
        else:
            status_lines.append(f"⚪ **Bot #{bot_id}**: Tersedia")
    
    status_text = "\n".join(status_lines)
    active_count = len(assignments)
    
    await interaction.followup.send(
        f"📊 **Status Bot Satpam:**\n\n{status_text}\n\n"
        f"**Aktif:** {active_count}/{MAX_SATPAM_BOTS}",
        ephemeral=True
    )


@bot.tree.command(name="pulang_semua", description="Suruh semua bot satpam pulang (Admin only)")
@app_commands.default_permissions(administrator=True)
async def pulang_semua(interaction: discord.Interaction):
    """Command untuk menyuruh semua bot pulang (admin only)"""
    await interaction.response.defer(ephemeral=True)
    
    assignments = satpam_manager.get_all_assignments().copy()
    
    if not assignments:
        await interaction.followup.send(
            "⚠️ Tidak ada bot satpam yang aktif!",
            ephemeral=True
        )
        return
    
    disconnected_count = 0
    for channel_id, bot_id in assignments.items():
        voice_client = satpam_manager.bot_instances.get(bot_id)
        if voice_client:
            try:
                await voice_client.disconnect()
                disconnected_count += 1
            except:
                pass
            del satpam_manager.bot_instances[bot_id]
        satpam_manager.unassign_bot(channel_id)
    
    await interaction.followup.send(
        f"✅ Semua bot satpam sudah dipulangkan! ({disconnected_count} bot)",
        ephemeral=False
    )


# Auto disconnect jika channel kosong (optional)
@bot.event
async def on_voice_state_update(member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
    """Auto disconnect bot jika channel kosong (hanya bot yang tersisa)"""
    # Cek jika ada channel yang ditinggalkan
    if before.channel and before.channel.id in satpam_manager.channel_assignments:
        # Tunggu sebentar untuk memastikan
        await asyncio.sleep(2)
        
        # Cek apakah channel masih ada dan hanya bot yang tersisa
        channel = before.channel
        if channel and len(channel.members) <= 1:  # Hanya bot yang tersisa
            bot_id = satpam_manager.get_bot_for_channel(channel.id)
            if bot_id:
                voice_client = satpam_manager.bot_instances.get(bot_id)
                if voice_client:
                    await voice_client.disconnect()
                    del satpam_manager.bot_instances[bot_id]
                satpam_manager.unassign_bot(channel.id)
                
                # Notify (optional, bisa di-disable jika tidak perlu)
                try:
                    await channel.send(f"🔔 **Satpam Bot #{bot_id}** pulang karena channel kosong.")
                except:
                    pass


if __name__ == "__main__":
    if BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        print("⚠️  WARNING: Bot token belum di-set!")
        print("Set environment variable DISCORD_BOT_TOKEN atau edit bot.py")
    bot.run(BOT_TOKEN)

