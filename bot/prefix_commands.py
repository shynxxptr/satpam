"""
Prefix commands dengan "satpam!" untuk bot satpam
"""
import discord
from discord.ext import commands
from typing import Optional
from datetime import datetime, timedelta
from subscription_manager import subscription_manager
from statistics import statistics_manager
from queue_manager import queue_manager
from notification_manager import notification_manager
from managers.music_manager import music_manager

def setup_prefix_commands(bot_instance):
    """Setup prefix commands untuk bot instance"""
    
    @bot_instance.bot.command(name='panggil', aliases=['call', 'guard'])
    async def panggil_prefix(ctx, channel: Optional[discord.VoiceChannel] = None):
        """Panggil bot satpam ke voice channel"""
        # Jika channel tidak disebutkan, cek apakah user ada di voice channel
        if channel is None:
            if ctx.author.voice and ctx.author.voice.channel:
                channel = ctx.author.voice.channel
            else:
                await ctx.send("❌ Kamu harus berada di voice channel atau sebutkan channel yang mau dijaga!")
                return
        
        # Cek apakah channel sudah dijaga bot lain
        from bot_multi import shared_assignments, channel_timers
        if channel.id in shared_assignments:
            assigned_bot = shared_assignments[channel.id]
            if assigned_bot != bot_instance.bot_number:
                await ctx.send(f"⚠️ Voice channel {channel.mention} sudah dijaga oleh **Satpam Bot #{assigned_bot}**!")
                return
            else:
                await ctx.send(f"ℹ️ **Satpam Bot #{bot_instance.bot_number}** sudah menjaga {channel.mention}!")
                return
        
        # Cek apakah bot ini sedang di channel lain
        if bot_instance.voice_client and bot_instance.voice_client.is_connected():
            if bot_instance.is_idle:
                old_channel = bot_instance.voice_client.channel
                await bot_instance.voice_client.disconnect()
                if old_channel and old_channel.id in shared_assignments:
                    del shared_assignments[old_channel.id]
                bot_instance.is_idle = False
            else:
                # Bot sedang menjaga channel lain, stop music jika ada
                if bot_instance.music_enabled:
                    status = music_manager.get_radio_status()
                    if status and status['bot_number'] == bot_instance.bot_number:
                        if bot_instance.voice_client.is_playing():
                            bot_instance.voice_client.stop()
                        music_manager.unlock_radio()
                        music_manager.is_playing = False
                
                old_channel = bot_instance.voice_client.channel
                await bot_instance.voice_client.disconnect()
                if old_channel and old_channel.id in shared_assignments:
                    del shared_assignments[old_channel.id]
        
        # Get user tier
        member = ctx.author
        if isinstance(member, discord.User):
            try:
                member = await ctx.guild.fetch_member(member.id)
            except:
                await ctx.send("❌ Error: Tidak bisa mendapatkan info member!")
                return
        
        tier = subscription_manager.get_user_tier(member)
        stay_duration_hours = subscription_manager.get_stay_duration_hours(member)
        tier_info = subscription_manager.get_tier_info(tier)
        user_id = member.id
        
        # Join voice channel
        try:
            bot_instance.voice_client = await channel.connect()
            bot_instance.current_channel = channel
            bot_instance.caller_user_id = user_id
            bot_instance.is_idle = False
            shared_assignments[channel.id] = bot_instance.bot_number
            
            # Set bot to deafen
            await bot_instance.voice_client.guild.change_voice_state(
                channel=channel,
                self_deaf=True,
                self_mute=False
            )
            
            # Track statistics
            statistics_manager.track_call(user_id, channel.id, bot_instance.bot_number)
            
            # Send notification
            await notification_manager.send_join_notification(
                channel, member, bot_instance.bot_number, tier_info['name'], stay_duration_hours
            )
            
            await ctx.send(
                f"✅ **Satpam Bot #{bot_instance.bot_number}** sudah menjaga {channel.mention}!\n"
                f"🎭 Tier: **{tier_info['name']}** ({stay_duration_hours} jam stay setelah kamu keluar)"
            )
            
        except Exception as e:
            await ctx.send(f"❌ Error: {str(e)}")
    
    @bot_instance.bot.command(name='pulang', aliases=['leave', 'disconnect'])
    async def pulang_prefix(ctx):
        """Suruh bot satpam pulang dari voice channel"""
        if not bot_instance.voice_client or not bot_instance.voice_client.is_connected():
            await ctx.send(f"❌ **Satpam Bot #{bot_instance.bot_number}** tidak sedang di voice channel!")
            return
        
        channel = bot_instance.voice_client.channel
        
        # Stop music jika ada
        if bot_instance.music_enabled:
            status = music_manager.get_radio_status()
            if status and status['bot_number'] == bot_instance.bot_number:
                if bot_instance.voice_client.is_playing():
                    bot_instance.voice_client.stop()
                music_manager.unlock_radio()
                music_manager.is_playing = False
        
        # Disconnect
        await bot_instance.voice_client.disconnect()
        bot_instance.voice_client = None
        bot_instance.current_channel = None
        bot_instance.caller_user_id = None
        bot_instance.stay_until = None
        bot_instance.is_idle = False
        
        # Remove assignment
        from bot_multi import shared_assignments, channel_timers
        if channel.id in shared_assignments:
            del shared_assignments[channel.id]
        if channel.id in channel_timers:
            del channel_timers[channel.id]
        
        # Join idle channel
        if bot_instance.idle_channel_id:
            await bot_instance.join_idle_channel()
        
        # Check queue
        await bot_instance._check_and_assign_queue()
        
        await ctx.send(f"✅ **Satpam Bot #{bot_instance.bot_number}** sudah pulang dari {channel.mention}!")
    
    @bot_instance.bot.command(name='status', aliases=['info', 'check'])
    async def status_prefix(ctx):
        """Lihat status bot satpam"""
        embed = discord.Embed(
            title=f"🤖 Satpam Bot #{bot_instance.bot_number} Status",
            color=discord.Color.blue()
        )
        
        if bot_instance.voice_client and bot_instance.voice_client.is_connected():
            channel = bot_instance.voice_client.channel
            embed.add_field(
                name="📍 Current Channel",
                value=channel.mention if channel else "Unknown",
                inline=True
            )
            embed.add_field(
                name="🆔 Status",
                value="🟢 **Aktif**" if not bot_instance.is_idle else "🟡 **Idle**",
                inline=True
            )
            
            if bot_instance.caller_user_id:
                try:
                    user = await ctx.guild.fetch_member(bot_instance.caller_user_id)
                    embed.add_field(
                        name="👤 Called by",
                        value=user.mention if user else f"User {bot_instance.caller_user_id}",
                        inline=False
                    )
                except:
                    embed.add_field(
                        name="👤 Called by",
                        value=f"User {bot_instance.caller_user_id}",
                        inline=False
                    )
            
            if bot_instance.stay_until:
                stay_until = bot_instance.stay_until
                embed.add_field(
                    name="⏰ Stay Until",
                    value=f"<t:{int(stay_until.timestamp())}:F>",
                    inline=False
                )
        else:
            embed.add_field(
                name="📍 Current Channel",
                value="❌ Tidak di voice channel",
                inline=True
            )
            embed.add_field(
                name="🆔 Status",
                value="🔴 **Offline**",
                inline=True
            )
        
        # Music status
        if bot_instance.music_enabled:
            status = music_manager.get_radio_status()
            if status and status['bot_number'] == bot_instance.bot_number:
                embed.add_field(
                    name="🎵 Music",
                    value="🔴 **Playing**",
                    inline=True
                )
            else:
                embed.add_field(
                    name="🎵 Music",
                    value="🟢 **Available**",
                    inline=True
                )
        
        await ctx.send(embed=embed)
    
    @bot_instance.bot.command(name='tier', aliases=['mytier'])
    async def tier_prefix(ctx):
        """Lihat tier kamu"""
        member = ctx.author
        if isinstance(member, discord.User):
            try:
                member = await ctx.guild.fetch_member(member.id)
            except:
                await ctx.send("❌ Error: Tidak bisa mendapatkan info member!")
                return
        
        tier = subscription_manager.get_user_tier(member)
        tier_info = subscription_manager.get_tier_info(tier)
        stay_duration = subscription_manager.get_stay_duration_hours(member)
        
        embed = discord.Embed(
            title="🎭 Your Tier",
            color=discord.Color.gold()
        )
        embed.add_field(name="Tier", value=tier_info['name'], inline=True)
        embed.add_field(name="Stay Duration", value=f"{stay_duration} jam", inline=True)
        embed.add_field(name="Description", value=tier_info['description'], inline=False)
        
        tier_source = subscription_manager.get_user_tier_info(member)
        if tier_source:
            embed.add_field(name="Source", value=tier_source, inline=False)
        
        await ctx.send(embed=embed)
    
    @bot_instance.bot.command(name='tiers', aliases=['tierlist'])
    async def tiers_prefix(ctx):
        """Lihat semua tier categories"""
        from subscription_manager import TIER_CATEGORIES
        
        embed = discord.Embed(
            title="🎭 Tier Categories",
            color=discord.Color.blue()
        )
        
        for tier_name, tier_info in TIER_CATEGORIES.items():
            embed.add_field(
                name=f"{tier_info['name']} ({tier_info['duration_hours']} jam)",
                value=tier_info['description'],
                inline=False
            )
        
        await ctx.send(embed=embed)
    
    @bot_instance.bot.command(name='stats', aliases=['statistics'])
    async def stats_prefix(ctx):
        """Lihat statistik bot"""
        stats = statistics_manager.get_stats()
        
        embed = discord.Embed(
            title="📊 Bot Statistics",
            color=discord.Color.green()
        )
        embed.add_field(name="👥 Total Users", value=stats.get('total_users', 0), inline=True)
        embed.add_field(name="📞 Total Calls", value=stats.get('total_calls', 0), inline=True)
        embed.add_field(name="⏰ Total Hours", value=stats.get('total_hours', 0), inline=True)
        embed.add_field(name="🤖 Active Bots", value=f"{len([b for b in shared_assignments.values()])}/5", inline=True)
        
        await ctx.send(embed=embed)
    
    @bot_instance.bot.command(name='queue', aliases=['q'])
    async def queue_prefix(ctx):
        """Lihat status queue"""
        queue_list = queue_manager.get_queue_list()
        user_position = queue_manager.get_user_position(ctx.author.id)
        
        if user_position:
            embed = discord.Embed(
                title="📋 Queue Status",
                color=discord.Color.orange()
            )
            embed.add_field(name="📍 Your Position", value=f"#{user_position}", inline=True)
            embed.add_field(name="👥 Total in Queue", value=len(queue_list), inline=True)
            await ctx.send(embed=embed)
        else:
            if queue_list:
                await ctx.send(f"📋 Ada {len(queue_list)} user di queue, tapi kamu tidak ada di queue.")
            else:
                await ctx.send("📋 Queue kosong!")
    
    @bot_instance.bot.command(name='queue_leave', aliases=['qleave'])
    async def queue_leave_prefix(ctx):
        """Keluar dari queue"""
        if queue_manager.remove_from_queue(ctx.author.id):
            await ctx.send("✅ Kamu sudah keluar dari queue!")
        else:
            await ctx.send("❌ Kamu tidak ada di queue!")
    
    # Music commands (hanya untuk bot yang enabled)
    if bot_instance.music_enabled and music_manager is not None:
        @bot_instance.bot.command(name='play', aliases=['p'])
        async def play_prefix(ctx, *, query: str):
            """Play music dari YouTube/Spotify"""
            # Cek apakah radio tersedia
            if not music_manager.is_radio_available():
                status = music_manager.get_radio_status()
                await ctx.send(
                    f"⚠️ **Radio sedang digunakan!**\n"
                    f"📻 **Satpam Bot #{status['bot_number']}** sedang memutar music di channel lain.\n"
                    f"⏰ Tunggu sampai music selesai atau minta bot tersebut untuk stop."
                )
                return
            
            # Cek apakah user di voice channel
            if not ctx.author.voice or not ctx.author.voice.channel:
                await ctx.send("❌ Kamu harus berada di voice channel untuk play music!")
                return
            
            channel = ctx.author.voice.channel
            
            # Cek apakah bot sudah di voice channel
            if not bot_instance.voice_client or not bot_instance.voice_client.is_connected():
                try:
                    bot_instance.voice_client = await channel.connect()
                except Exception as e:
                    await ctx.send(f"❌ Error connecting to voice channel: {str(e)}")
                    return
            
            # Get song info
            try:
                if query.startswith("http"):
                    if "youtube.com" in query or "youtu.be" in query:
                        song_info = music_manager.get_youtube_info(query)
                    elif "spotify.com" in query:
                        # Spotify - get info via Spotify API and convert to YouTube
                        try:
                            song_info = music_manager.get_spotify_info(query)
                        except Exception as e:
                            await ctx.send(
                                f"❌ **Error dengan Spotify:** {str(e)}\n"
                                f"💡 Pastikan Spotify API credentials sudah di-set di config.json"
                            )
                            return
                    else:
                        await ctx.send("❌ URL tidak didukung! Gunakan YouTube atau Spotify URL.")
                        return
                else:
                    song_info = music_manager.search_youtube(query)
                
                # Lock radio
                music_manager.lock_radio(bot_instance.bot_number, channel.id, ctx.author.id)
                
                # Set current song untuk autoplay
                music_manager.set_current_song(song_info)
                
                # Play music
                # Import _after_play from bot_music_commands
                from .music_commands import _after_play
                
                source = music_manager.create_source(song_info["url"])
                bot_instance.voice_client.play(
                    source,
                    after=lambda e: asyncio.create_task(_after_play(bot_instance, channel))
                )
                
                music_manager.is_playing = True
                
                await ctx.send(f"✅ Music dimulai!\n🎵 **{song_info['title']}**")
                
            except Exception as e:
                music_manager.unlock_radio()
                await ctx.send(f"❌ Error: {str(e)}")
        
        @bot_instance.bot.command(name='stop', aliases=['s'])
        async def stop_prefix(ctx):
            """Stop music"""
            status = music_manager.get_radio_status()
            if not status or status['bot_number'] != bot_instance.bot_number:
                await ctx.send("❌ Bot ini tidak sedang memutar music!")
                return
            
            if bot_instance.voice_client and bot_instance.voice_client.is_playing():
                bot_instance.voice_client.stop()
            
            music_manager.is_playing = False
            music_manager.unlock_radio()
            music_manager.clear_queue()
            
            await ctx.send("✅ Music dihentikan!")
        
        @bot_instance.bot.command(name='pause')
        async def pause_prefix(ctx):
            """Pause music"""
            status = music_manager.get_radio_status()
            if not status or status['bot_number'] != bot_instance.bot_number:
                await ctx.send("❌ Bot ini tidak sedang memutar music!")
                return
            
            if bot_instance.voice_client and bot_instance.voice_client.is_playing():
                bot_instance.voice_client.pause()
                music_manager.is_paused = True
                await ctx.send("⏸️ Music di-pause!")
            else:
                await ctx.send("❌ Tidak ada music yang sedang diputar!")
        
        @bot_instance.bot.command(name='resume', aliases=['r'])
        async def resume_prefix(ctx):
            """Resume music"""
            status = music_manager.get_radio_status()
            if not status or status['bot_number'] != bot_instance.bot_number:
                await ctx.send("❌ Bot ini tidak sedang memutar music!")
                return
            
            if bot_instance.voice_client and bot_instance.voice_client.is_paused():
                bot_instance.voice_client.resume()
                music_manager.is_paused = False
                await ctx.send("▶️ Music di-resume!")
            else:
                await ctx.send("❌ Tidak ada music yang di-pause!")
        
        @bot_instance.bot.command(name='radio', aliases=['radio_status'])
        async def radio_prefix(ctx):
            """Lihat status radio"""
            status = music_manager.get_radio_status()
            
            if not status:
                await ctx.send("📻 **Radio Status:** Tersedia\n✅ Tidak ada yang menggunakan radio saat ini.")
                return
            
            try:
                user = await ctx.guild.fetch_member(status['user_id'])
                user_mention = user.mention
            except:
                user_mention = f"User {status['user_id']}"
            
            channel = bot_instance.bot.get_channel(status['channel_id'])
            channel_name = channel.mention if channel else f"Channel {status['channel_id']}"
            
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
            
            await ctx.send(embed=embed)
    
    @bot_instance.bot.command(name='help', aliases=['h', 'commands'])
    async def help_prefix(ctx):
        """Lihat semua commands"""
        embed = discord.Embed(
            title=f"🤖 Satpam Bot #{bot_instance.bot_number} Commands",
            description="Prefix: `satpam!` atau `satpam#1!` atau `!`",
            color=discord.Color.blue()
        )
        
        embed.add_field(
            name="🛡️ Guard Commands",
            value="`satpam!panggil` - Panggil bot jaga voice\n"
                  "`satpam!pulang` - Suruh bot pulang\n"
                  "`satpam!status` - Lihat status bot",
            inline=False
        )
        
        embed.add_field(
            name="🎭 Tier Commands",
            value="`satpam!tier` - Lihat tier kamu\n"
                  "`satpam!tiers` - Lihat semua tier",
            inline=False
        )
        
        embed.add_field(
            name="📊 Info Commands",
            value="`satpam!stats` - Lihat statistik\n"
                  "`satpam!queue` - Lihat queue\n"
                  "`satpam!queue_leave` - Keluar dari queue",
            inline=False
        )
        
        if bot_instance.music_enabled:
            embed.add_field(
                name="🎵 Music Commands",
                value="`satpam!play <url/query>` - Play music\n"
                      "`satpam!stop` - Stop music\n"
                      "`satpam!pause` - Pause music\n"
                      "`satpam!resume` - Resume music\n"
                      "`satpam!radio` - Lihat radio status\n"
                      "`satpam!autoplay` - Enable/disable autoplay",
                inline=False
            )
        
        embed.add_field(
            name="ℹ️ Note",
            value="Semua commands juga tersedia sebagai slash commands (`/panggil`, `/tier`, dll)",
            inline=False
        )
        
        await ctx.send(embed=embed)

