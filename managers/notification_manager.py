"""
Notification Manager untuk bot satpam
Notifikasi akan dikirim ke voice channel (bukan DM)
"""
import discord
from typing import Dict, Optional
from datetime import datetime, timedelta

class NotificationManager:
    """Manager untuk handle notifications"""
    
    def __init__(self):
        self.pending_confirmations: Dict[int, Dict] = {}  # {channel_id: {user_id, message, task}}
    
    async def send_notification(self, channel: discord.TextChannel, user: discord.Member, message: str):
        """Send notification to voice channel's text channel"""
        try:
            # Get text channel associated with voice channel
            # If voice channel, try to find associated text channel
            if isinstance(channel, discord.VoiceChannel):
                # Try to find text channel with same name or in same category
                guild = channel.guild
                text_channel = None
                
                # Try to find text channel in same category
                if channel.category:
                    for ch in channel.category.text_channels:
                        if ch.permissions_for(guild.me).send_messages:
                            text_channel = ch
                            break
                
                # Fallback: find any text channel bot can send to
                if not text_channel:
                    for ch in guild.text_channels:
                        if ch.permissions_for(guild.me).send_messages:
                            text_channel = ch
                            break
                
                if text_channel:
                    await text_channel.send(f"{user.mention} {message}")
                else:
                    # If no text channel found, try to send in voice channel (won't work but try)
                    print(f"⚠️  No text channel found for voice channel {channel.name}")
            else:
                # It's already a text channel
                await channel.send(f"{user.mention} {message}")
        except Exception as e:
            print(f"⚠️  Error sending notification: {e}")
    
    async def send_timer_warning(self, channel: discord.VoiceChannel, user: discord.Member, 
                                 remaining_minutes: int, bot_number: int) -> discord.Message:
        """Send timer warning with confirmation buttons"""
        try:
            # Get text channel
            guild = channel.guild
            text_channel = None
            
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in guild.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                print(f"⚠️  No text channel found for timer warning")
                return None
            
            # Create embed with buttons
            embed = discord.Embed(
                title="⏰ Timer Warning",
                description=f"{user.mention} **Satpam Bot #{bot_number}** akan disconnect dalam **{remaining_minutes} menit**!",
                color=discord.Color.orange()
            )
            embed.add_field(
                name="Channel",
                value=channel.mention,
                inline=False
            )
            embed.add_field(
                name="Aksi",
                value="Pilih opsi di bawah untuk melanjutkan atau menghentikan bot.",
                inline=False
            )
            
            # Create buttons
            view = TimerConfirmationView(user.id, bot_number, channel.id)
            
            message = await text_channel.send(embed=embed, view=view)
            
            # Store confirmation info
            self.pending_confirmations[channel.id] = {
                "user_id": user.id,
                "message": message,
                "bot_number": bot_number,
                "channel_id": channel.id
            }
            
            return message
            
        except Exception as e:
            print(f"⚠️  Error sending timer warning: {e}")
            return None
    
    async def send_join_notification(self, channel: discord.VoiceChannel, user: discord.Member, 
                                    bot_number: int, tier: str, duration_hours: int):
        """Send join notification"""
        try:
            # Get text channel
            guild = channel.guild
            text_channel = None
            
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in guild.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if text_channel:
                message = f"{user.mention} ✅ **Satpam Bot #{bot_number}** sekarang menjaga {channel.mention}!\n"
                message += f"📊 **Tier:** {tier}\n"
                message += f"⏰ **Durasi Stay:** {duration_hours} jam"
                await text_channel.send(message)
        except Exception as e:
            print(f"⚠️  Error sending join notification: {e}")
    
    async def send_leave_notification(self, channel: discord.VoiceChannel, user: discord.Member, bot_number: int):
        """Send leave notification"""
        try:
            # Get text channel
            guild = channel.guild
            text_channel = None
            
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in guild.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if text_channel:
                message = f"{user.mention} 👋 **Satpam Bot #{bot_number}** sudah pulang dari {channel.mention}!"
                await text_channel.send(message)
        except Exception as e:
            print(f"⚠️  Error sending leave notification: {e}")
    
    async def send_queue_notification(self, channel: discord.VoiceChannel, user: discord.Member, position: int):
        """Send queue join notification"""
        try:
            # Get text channel
            guild = channel.guild
            text_channel = None
            
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in guild.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if text_channel:
                message = f"{user.mention} 🎯 Kamu masuk queue di posisi **#{position}**!\n"
                message += f"Bot akan otomatis assign saat ada bot yang tersedia."
                await text_channel.send(message)
        except Exception as e:
            print(f"⚠️  Error sending queue notification: {e}")
    
    async def send_queue_ready_notification(self, channel: discord.VoiceChannel, user: discord.Member, bot_number: int):
        """Send queue ready notification"""
        try:
            # Get text channel
            guild = channel.guild
            text_channel = None
            
            if channel.category:
                for ch in channel.category.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if not text_channel:
                for ch in guild.text_channels:
                    if ch.permissions_for(guild.me).send_messages:
                        text_channel = ch
                        break
            
            if text_channel:
                message = f"{user.mention} 🎉 Giliran kamu! **Satpam Bot #{bot_number}** sekarang tersedia!\n"
                message += f"Bot akan otomatis join ke {channel.mention} dalam 30 detik."
                await text_channel.send(message)
        except Exception as e:
            print(f"⚠️  Error sending queue ready notification: {e}")


class TimerConfirmationView(discord.ui.View):
    """View untuk timer confirmation buttons"""
    
    def __init__(self, user_id: int, bot_number: int, channel_id: int):
        super().__init__(timeout=300)  # 5 minutes timeout
        self.user_id = user_id
        self.bot_number = bot_number
        self.channel_id = channel_id
        self.confirmed = False
    
    @discord.ui.button(label="Lanjutkan", style=discord.ButtonStyle.green, emoji="✅")
    async def continue_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ Hanya user yang memanggil bot yang bisa konfirmasi!", ephemeral=True)
            return
        
        self.confirmed = True
        self.stop()
        
        # Update embed
        embed = interaction.message.embeds[0]
        embed.color = discord.Color.green()
        embed.description = f"{interaction.user.mention} **Satpam Bot #{self.bot_number}** akan tetap stay di channel!"
        
        await interaction.response.edit_message(embed=embed, view=None)
        
        # Store confirmation
        from bot_multi import shared_bot_instances
        if self.bot_number in shared_bot_instances:
            bot_instance = shared_bot_instances[self.bot_number]
            if hasattr(bot_instance, 'timer_confirmation'):
                bot_instance.timer_confirmation = True
    
    @discord.ui.button(label="Hentikan", style=discord.ButtonStyle.red, emoji="❌")
    async def stop_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id != self.user_id:
            await interaction.response.send_message("❌ Hanya user yang memanggil bot yang bisa konfirmasi!", ephemeral=True)
            return
        
        self.confirmed = False
        self.stop()
        
        # Update embed
        embed = interaction.message.embeds[0]
        embed.color = discord.Color.red()
        embed.description = f"{interaction.user.mention} **Satpam Bot #{self.bot_number}** akan segera pulang!"
        
        await interaction.response.edit_message(embed=embed, view=None)
        
        # Store confirmation
        from bot_multi import shared_bot_instances
        if self.bot_number in shared_bot_instances:
            bot_instance = shared_bot_instances[self.bot_number]
            if hasattr(bot_instance, 'timer_confirmation'):
                bot_instance.timer_confirmation = False
                # Trigger immediate disconnect
                if bot_instance.voice_client and bot_instance.voice_client.is_connected():
                    await bot_instance.voice_client.disconnect()


# Global instance
notification_manager = NotificationManager()

