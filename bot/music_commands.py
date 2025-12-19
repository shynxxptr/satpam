"""
Music commands untuk bot satpam
Global lock: hanya 1 music stream aktif
"""
import discord
from discord import app_commands
from typing import Optional
from managers.music_manager import music_manager
import asyncio

def setup_music_commands(bot_instance):
    """Setup music commands untuk bot instance"""
    
    @bot_instance.bot.tree.command(name="play", description="Putar music dari YouTube/Spotify")
    @app_commands.describe(query="URL YouTube/Spotify atau search query")
    async def play_music(interaction: discord.Interaction, query: str):
        """Command untuk play music"""
        await interaction.response.defer(ephemeral=True)
        
        # Cek apakah bot ini enabled untuk music
        if not bot_instance.music_enabled:
            music_bot = bot_instance.music_enabled if hasattr(bot_instance, 'music_enabled') else None
            from bot_multi import load_music_enabled_bot
            enabled_bot = load_music_enabled_bot()
            await interaction.followup.send(
                f"❌ **Bot ini tidak bisa play music!**\n"
                f"🎵 Hanya **Satpam Bot #{enabled_bot}** yang bisa play music.\n"
                f"💡 Gunakan Bot #{enabled_bot} untuk play music, atau gunakan bot ini untuk jaga voice channel saja.",
                ephemeral=True
            )
            return
        
        # Cek apakah radio tersedia
        if not music_manager.is_radio_available():
            status = music_manager.get_radio_status()
            await interaction.followup.send(
                f"⚠️ **Radio sedang digunakan!**\n"
                f"📻 **Satpam Bot #{status['bot_number']}** sedang memutar music di channel lain.\n"
                f"⏰ Tunggu sampai music selesai atau minta bot tersebut untuk stop.",
                ephemeral=True
            )
            return
        
        # Cek apakah user di voice channel
        if not interaction.user.voice or not interaction.user.voice.channel:
            await interaction.followup.send(
                "❌ Kamu harus berada di voice channel untuk play music!",
                ephemeral=True
            )
            return
        
        channel = interaction.user.voice.channel
        
        # Cek apakah bot sudah di voice channel
        if not bot_instance.voice_client or not bot_instance.voice_client.is_connected():
            try:
                bot_instance.voice_client = await channel.connect()
            except Exception as e:
                await interaction.followup.send(
                    f"❌ Error connecting to voice channel: {str(e)}",
                    ephemeral=True
                )
                return
        
        # Get song info
        try:
            if query.startswith("http"):
                # URL
                if "youtube.com" in query or "youtu.be" in query:
                    song_info = music_manager.get_youtube_info(query)
                elif "spotify.com" in query:
                    # Spotify - get info via Spotify API and convert to YouTube
                    try:
                        song_info = music_manager.get_spotify_info(query)
                    except Exception as e:
                        await interaction.followup.send(
                            f"❌ **Error dengan Spotify:** {str(e)}\n"
                            f"💡 Pastikan Spotify API credentials sudah di-set di config.json",
                            ephemeral=True
                        )
                        return
                else:
                    await interaction.followup.send(
                        "❌ URL tidak didukung! Gunakan YouTube atau Spotify URL.",
                        ephemeral=True
                    )
                    return
            else:
                # Search query
                song_info = music_manager.search_youtube(query)
            
            # Lock radio
            music_manager.lock_radio(bot_instance.bot_number, channel.id, interaction.user.id)
            
            # Set current song untuk autoplay
            music_manager.set_current_song(song_info)
            
            # Play music
            source = music_manager.create_source(song_info["url"])
            bot_instance.voice_client.play(
                source,
                after=lambda e: asyncio.create_task(_after_play(bot_instance, channel))
            )
            
            music_manager.is_playing = True
            
            # Send notification
            embed = discord.Embed(
                title="🎵 Now Playing",
                description=f"**{song_info['title']}**",
                color=discord.Color.green()
            )
            embed.add_field(name="Channel", value=channel.mention, inline=True)
            embed.add_field(name="Requested by", value=interaction.user.mention, inline=True)
            
            if song_info.get('thumbnail'):
                embed.set_thumbnail(url=song_info['thumbnail'])
            
            # Get text channel untuk notification
            text_channel = None
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(channel.guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in channel.guild.text_channels:
                    if ch.permissions_for(channel.guild.me).send_messages:
                        text_channel = ch
                        break
            
            if text_channel:
                await text_channel.send(
                    f"{interaction.user.mention} 🎵 **Satpam Bot #{bot_instance.bot_number}** sekarang memutar music!",
                    embed=embed
                )
            
            await interaction.followup.send(
                f"✅ Music dimulai!\n"
                f"🎵 **{song_info['title']}**",
                ephemeral=False
            )
            
        except Exception as e:
            music_manager.unlock_radio()
            await interaction.followup.send(
                f"❌ Error: {str(e)}",
                ephemeral=True
            )
    
    @bot_instance.bot.tree.command(name="stop", description="Stop music")
    async def stop_music(interaction: discord.Interaction):
        """Command untuk stop music"""
        await interaction.response.defer(ephemeral=True)
        
        # Cek apakah bot ini enabled untuk music
        if not bot_instance.music_enabled:
            from bot_multi import load_music_enabled_bot
            enabled_bot = load_music_enabled_bot()
            await interaction.followup.send(
                f"❌ **Bot ini tidak bisa stop music!**\n"
                f"🎵 Hanya **Satpam Bot #{enabled_bot}** yang bisa control music.",
                ephemeral=True
            )
            return
        
        # Cek apakah bot sedang play music
        status = music_manager.get_radio_status()
        if not status or status['bot_number'] != bot_instance.bot_number:
            await interaction.followup.send(
                "❌ Bot ini tidak sedang memutar music!",
                ephemeral=True
            )
            return
        
        # Cek permission (hanya yang request atau admin)
        if status['user_id'] != interaction.user.id:
            if not interaction.user.guild_permissions.administrator:
                await interaction.followup.send(
                    "❌ Hanya user yang request music atau admin yang bisa stop!",
                    ephemeral=True
                )
                return
        
        # Stop music
        if bot_instance.voice_client and bot_instance.voice_client.is_playing():
            bot_instance.voice_client.stop()
        
        music_manager.is_playing = False
        music_manager.unlock_radio()
        music_manager.clear_queue()
        
        # Send notification
        channel = bot_instance.voice_client.channel if bot_instance.voice_client else None
        if channel:
            text_channel = None
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(channel.guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in channel.guild.text_channels:
                    if ch.permissions_for(channel.guild.me).send_messages:
                        text_channel = ch
                        break
            
            if text_channel:
                await text_channel.send(
                    f"{interaction.user.mention} ⏹️ **Satpam Bot #{bot_instance.bot_number}** menghentikan music!"
                )
        
        await interaction.followup.send(
            "✅ Music dihentikan!",
            ephemeral=False
        )
    
    @bot_instance.bot.tree.command(name="pause", description="Pause music")
    async def pause_music(interaction: discord.Interaction):
        """Command untuk pause music"""
        await interaction.response.defer(ephemeral=True)
        
        # Cek apakah bot ini enabled untuk music
        if not bot_instance.music_enabled:
            from bot_multi import load_music_enabled_bot
            enabled_bot = load_music_enabled_bot()
            await interaction.followup.send(
                f"❌ **Bot ini tidak bisa pause music!**\n"
                f"🎵 Hanya **Satpam Bot #{enabled_bot}** yang bisa control music.",
                ephemeral=True
            )
            return
        
        status = music_manager.get_radio_status()
        if not status or status['bot_number'] != bot_instance.bot_number:
            await interaction.followup.send("❌ Bot ini tidak sedang memutar music!", ephemeral=True)
            return
        
        if bot_instance.voice_client and bot_instance.voice_client.is_playing():
            bot_instance.voice_client.pause()
            music_manager.is_paused = True
            await interaction.followup.send("⏸️ Music di-pause!", ephemeral=False)
        else:
            await interaction.followup.send("❌ Tidak ada music yang sedang diputar!", ephemeral=True)
    
    @bot_instance.bot.tree.command(name="resume", description="Resume music")
    async def resume_music(interaction: discord.Interaction):
        """Command untuk resume music"""
        await interaction.response.defer(ephemeral=True)
        
        # Cek apakah bot ini enabled untuk music
        if not bot_instance.music_enabled:
            from bot_multi import load_music_enabled_bot
            enabled_bot = load_music_enabled_bot()
            await interaction.followup.send(
                f"❌ **Bot ini tidak bisa resume music!**\n"
                f"🎵 Hanya **Satpam Bot #{enabled_bot}** yang bisa control music.",
                ephemeral=True
            )
            return
        
        status = music_manager.get_radio_status()
        if not status or status['bot_number'] != bot_instance.bot_number:
            await interaction.followup.send("❌ Bot ini tidak sedang memutar music!", ephemeral=True)
            return
        
        if bot_instance.voice_client and bot_instance.voice_client.is_paused():
            bot_instance.voice_client.resume()
            music_manager.is_paused = False
            await interaction.followup.send("▶️ Music di-resume!", ephemeral=False)
        else:
            await interaction.followup.send("❌ Tidak ada music yang di-pause!", ephemeral=True)
    
    @bot_instance.bot.tree.command(name="radio_status", description="Lihat status radio")
    async def radio_status(interaction: discord.Interaction):
        """Command untuk melihat radio status"""
        await interaction.response.defer(ephemeral=True)
        
        # Info tentang bot yang bisa music
        from bot_multi import load_music_enabled_bot
        enabled_bot = load_music_enabled_bot()
        
        status = music_manager.get_radio_status()
        
        # Jika bot ini tidak enabled untuk music, show info
        if enabled_bot and bot_instance.bot_number != enabled_bot:
            embed = discord.Embed(
                title="📻 Radio Status",
                color=discord.Color.blue()
            )
            embed.add_field(
                name="Music Bot",
                value=f"🎵 **Satpam Bot #{enabled_bot}** adalah bot yang bisa play music",
                inline=False
            )
            embed.add_field(
                name="Bot Ini",
                value=f"🛡️ **Satpam Bot #{bot_instance.bot_number}** hanya untuk jaga voice channel",
                inline=False
            )
            
            if status:
                embed.add_field(
                    name="Status",
                    value=f"🔴 Radio sedang digunakan oleh **Satpam Bot #{status['bot_number']}**",
                    inline=False
                )
            else:
                embed.add_field(
                    name="Status",
                    value="🟢 Radio tersedia",
                    inline=False
                )
            
            await interaction.followup.send(embed=embed, ephemeral=True)
            return
        
        # Bot ini enabled untuk music, show full status
        if not status:
            await interaction.followup.send(
                "📻 **Radio Status:** Tersedia\n"
                "✅ Tidak ada yang menggunakan radio saat ini.",
                ephemeral=True
            )
            return
        
        try:
            user = await interaction.guild.fetch_member(status['user_id'])
            user_mention = user.mention
        except:
            user_mention = f"User {status['user_id']}"
        
        channel = bot_instance.bot.get_channel(status['channel_id'])
        channel_name = channel.mention if channel else f"Channel {status['channel_id']}"
        
        from datetime import datetime
        started_at = datetime.fromisoformat(status['started_at'])
        
        embed = discord.Embed(
            title="📻 Radio Status",
            color=discord.Color.orange()
        )
        embed.add_field(name="Status", value="🔴 **Sedang Digunakan**", inline=False)
        embed.add_field(name="Bot", value=f"**Satpam Bot #{status['bot_number']}**", inline=True)
        embed.add_field(name="Channel", value=channel_name, inline=True)
        embed.add_field(name="Requested by", value=user_mention, inline=False)
        embed.add_field(
            name="Started",
            value=f"<t:{int(started_at.timestamp())}:R>",
            inline=False
        )
        
        await interaction.followup.send(embed=embed, ephemeral=True)
    
    @bot_instance.bot.tree.command(name="autoplay", description="Enable/disable autoplay")
    async def autoplay_command(interaction: discord.Interaction):
        """Command untuk enable/disable autoplay"""
        await interaction.response.defer(ephemeral=True)
        
        # Cek apakah bot ini enabled untuk music
        if not bot_instance.music_enabled:
            from bot_multi import load_music_enabled_bot
            enabled_bot = load_music_enabled_bot()
            await interaction.followup.send(
                f"❌ **Bot ini tidak bisa control autoplay!**\n"
                f"🎵 Hanya **Satpam Bot #{enabled_bot}** yang bisa control music.",
                ephemeral=True
            )
            return
        
        # Toggle autoplay
        current_state = music_manager.is_autoplay_enabled()
        music_manager.set_autoplay(not current_state)
        new_state = music_manager.is_autoplay_enabled()
        
        embed = discord.Embed(
            title="🔄 Autoplay",
            color=discord.Color.green() if new_state else discord.Color.red()
        )
        embed.add_field(
            name="Status",
            value="✅ **Enabled**" if new_state else "❌ **Disabled**",
            inline=False
        )
        embed.add_field(
            name="Description",
            value="Bot akan otomatis play lagu terkait setelah lagu selesai" if new_state else "Bot akan stop setelah queue habis",
            inline=False
        )
        
        await interaction.followup.send(embed=embed, ephemeral=False)


# Helper function untuk after play
async def _after_play(bot_instance, channel):
    """Callback setelah music selesai"""
    try:
        music_manager.is_playing = False
        
        # Check queue first
        next_song = music_manager.get_next_in_queue()
        
        # If no queue, check autoplay
        if not next_song and music_manager.is_autoplay_enabled():
            current_song = music_manager.get_current_song()
            if current_song:
                # Get related song
                next_song = music_manager.get_related_song(current_song)
                if next_song:
                    # Send notification about autoplay
                    try:
                        # Find text channel
                        text_channel = None
                        if channel.category:
                            for ch in channel.category.text_channels:
                                if ch.permissions_for(channel.guild.me).send_messages:
                                    text_channel = ch
                                    break
                        
                        if not text_channel:
                            for ch in channel.guild.text_channels:
                                if ch.permissions_for(channel.guild.me).send_messages:
                                    text_channel = ch
                                    break
                        
                        if text_channel:
                            embed = discord.Embed(
                                title="🎵 Autoplay",
                                description=f"**{next_song['title']}**",
                                color=discord.Color.blue()
                            )
                            embed.add_field(name="Mode", value="🔄 Autoplay (Related Song)", inline=False)
                            if next_song.get('thumbnail'):
                                embed.set_thumbnail(url=next_song['thumbnail'])
                            await text_channel.send(embed=embed)
                    except:
                        pass
        
        if next_song and bot_instance.voice_client and bot_instance.voice_client.is_connected():
            # Play next song
            source = music_manager.create_source(next_song["url"])
            bot_instance.voice_client.play(
                source,
                after=lambda e: asyncio.create_task(_after_play(bot_instance, channel))
            )
            music_manager.is_playing = True
            music_manager.lock_radio(bot_instance.bot_number, channel.id, next_song.get("user_id", 0))
            
            # Update current song untuk autoplay
            if next_song.get("autoplay"):
                music_manager.set_current_song(next_song)
            else:
                music_manager.set_current_song(next_song)
        else:
            # No more songs, unlock radio
            music_manager.unlock_radio()
            
            # Disconnect after 30 seconds if idle
            await asyncio.sleep(30)
            if bot_instance.voice_client and bot_instance.voice_client.is_connected():
                if not bot_instance.voice_client.is_playing():
                    if bot_instance.idle_channel_id:
                        await bot_instance.join_idle_channel()
                    else:
                        await bot_instance.voice_client.disconnect()
    except Exception as e:
        print(f"Error in after_play: {e}")
        music_manager.unlock_radio()

