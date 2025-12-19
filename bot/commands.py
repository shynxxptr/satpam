"""
Additional commands untuk bot satpam
Statistics, Queue, Custom Messages, Backup, dll
"""
import discord
from discord import app_commands
from typing import Optional
from managers.statistics import statistics_manager
from managers.queue_manager import queue_manager
from managers.custom_messages import custom_messages_manager
from managers.backup_manager import backup_manager
from managers.subscription_manager import subscription_manager
from managers.scheduler import scheduler


def setup_additional_commands(bot_instance):
    """Setup additional commands untuk bot instance"""
    
    @bot_instance.bot.tree.command(name="stats", description="Lihat statistik penggunaan bot")
    @app_commands.describe(user="User yang mau dilihat statistiknya (kosongkan untuk statistik kamu)")
    async def stats_command(interaction: discord.Interaction, user: Optional[discord.Member] = None):
        """Command untuk melihat statistics"""
        await interaction.response.defer(ephemeral=True)
        
        target_user = user or interaction.user
        stats = statistics_manager.get_user_stats(target_user.id)
        
        embed = discord.Embed(
            title=f"📊 Statistik {target_user.display_name}",
            color=discord.Color.blue()
        )
        embed.add_field(
            name="Total Panggilan",
            value=f"**{stats['total_calls']}** kali",
            inline=True
        )
        embed.add_field(
            name="Total Durasi",
            value=f"**{stats['total_hours']:.1f}** jam",
            inline=True
        )
        
        tier_usage = stats.get('tier_usage', {})
        tier_text = "\n".join([
            f"🆓 Free: {tier_usage.get('free', 0)}",
            f"🚀 Booster: {tier_usage.get('booster', 0)}",
            f"💝 Donatur: {tier_usage.get('donatur', 0)}",
            f"👑 Loyalist: {tier_usage.get('loyalist', 0)}"
        ])
        embed.add_field(
            name="Tier Usage",
            value=tier_text,
            inline=False
        )
        
        if stats.get('last_used'):
            from datetime import datetime
            last_used = datetime.fromisoformat(stats['last_used'])
            embed.add_field(
                name="Terakhir Digunakan",
                value=f"<t:{int(last_used.timestamp())}:R>",
                inline=False
            )
        
        await interaction.followup.send(embed=embed, ephemeral=True)
    
    @bot_instance.bot.tree.command(name="leaderboard", description="Lihat leaderboard user paling aktif")
    async def leaderboard_command(interaction: discord.Interaction):
        """Command untuk melihat leaderboard"""
        await interaction.response.defer(ephemeral=False)
        
        leaderboard = statistics_manager.get_leaderboard(limit=10)
        
        if not leaderboard:
            await interaction.followup.send("📊 Belum ada data statistik!", ephemeral=False)
            return
        
        embed = discord.Embed(
            title="🏆 Leaderboard - User Paling Aktif",
            color=discord.Color.gold()
        )
        
        leaderboard_text = ""
        for i, entry in enumerate(leaderboard, start=1):
            try:
                user = await interaction.guild.fetch_member(entry['user_id'])
                username = user.display_name
            except:
                username = f"User {entry['user_id']}"
            
            medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"**{i}.**"
            leaderboard_text += f"{medal} {username}\n"
            leaderboard_text += f"   📞 {entry['total_calls']} calls | ⏰ {entry['total_hours']:.1f} hours\n\n"
        
        embed.description = leaderboard_text
        await interaction.followup.send(embed=embed, ephemeral=False)
    
    @bot_instance.bot.tree.command(name="queue_status", description="Lihat status queue kamu")
    async def queue_status_command(interaction: discord.Interaction):
        """Command untuk melihat queue status"""
        await interaction.response.defer(ephemeral=True)
        
        queue_info = queue_manager.get_queue_info(interaction.user.id)
        
        if not queue_info:
            await interaction.followup.send("✅ Kamu tidak ada di queue!", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="🎯 Queue Status",
            color=discord.Color.orange()
        )
        embed.add_field(
            name="Posisi",
            value=f"**#{queue_info['position']}** dari {queue_info['total_in_queue']} user",
            inline=False
        )
        embed.add_field(
            name="Estimasi Waktu",
            value=f"**~{queue_info['estimated_minutes']} menit**",
            inline=False
        )
        
        await interaction.followup.send(embed=embed, ephemeral=True)
    
    @bot_instance.bot.tree.command(name="queue_leave", description="Keluar dari queue")
    async def queue_leave_command(interaction: discord.Interaction):
        """Command untuk keluar dari queue"""
        await interaction.response.defer(ephemeral=True)
        
        if queue_manager.remove_from_queue(interaction.user.id):
            await interaction.followup.send("✅ Kamu sudah keluar dari queue!", ephemeral=True)
        else:
            await interaction.followup.send("❌ Kamu tidak ada di queue!", ephemeral=True)
    
    @bot_instance.bot.tree.command(name="queue_list", description="Lihat semua user di queue (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def queue_list_command(interaction: discord.Interaction):
        """Command untuk melihat queue list (admin only)"""
        await interaction.response.defer(ephemeral=True)
        
        queue_list = queue_manager.get_queue_list()
        
        if not queue_list:
            await interaction.followup.send("📋 Queue kosong!", ephemeral=True)
            return
        
        embed = discord.Embed(
            title="📋 Queue List",
            color=discord.Color.blue()
        )
        
        queue_text = ""
        for entry in queue_list:
            try:
                user = await interaction.guild.fetch_member(entry['user_id'])
                username = user.display_name
            except:
                username = f"User {entry['user_id']}"
            
            queue_text += f"**#{entry['position']}** {username} ({entry['tier']})\n"
        
        embed.description = queue_text
        await interaction.followup.send(embed=embed, ephemeral=True)
    
    @bot_instance.bot.tree.command(name="backup_status", description="Lihat status backup system (Admin)")
    @app_commands.default_permissions(administrator=True)
    async def backup_status_command(interaction: discord.Interaction):
        """Command untuk melihat backup status"""
        await interaction.response.defer(ephemeral=True)
        
        status = backup_manager.get_backup_status()
        
        embed = discord.Embed(
            title="💾 Backup System Status",
            color=discord.Color.green() if status['enabled'] else discord.Color.red()
        )
        embed.add_field(name="Status", value="✅ Enabled" if status['enabled'] else "❌ Disabled", inline=False)
        embed.add_field(name="Backup Count", value=f"**{status['backup_count']}** backups", inline=True)
        embed.add_field(name="Retention", value=f"**{status['retention']}** backups", inline=True)
        
        if status['latest_backup']:
            from datetime import datetime
            latest = datetime.fromisoformat(status['latest_backup'])
            embed.add_field(
                name="Latest Backup",
                value=f"<t:{int(latest.timestamp())}:R>",
                inline=False
            )
        
        await interaction.followup.send(embed=embed, ephemeral=True)

