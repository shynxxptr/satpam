"""
Statistics & Analytics Manager untuk bot satpam
"""
import json
import os
from typing import Dict, Optional, List
from datetime import datetime, timedelta

STATS_DB_FILE = "statistics.json"


class StatisticsManager:
    """Manager untuk handle statistics dan analytics"""
    
    def __init__(self):
        self.stats: Dict = {
            "users": {},
            "bots": {},
            "channels": {},
            "tiers": {
                "free": 0,
                "booster": 0,
                "donatur": 0,
                "loyalist": 0
            },
            "total_calls": 0,
            "total_hours": 0.0
        }
        self.load_stats()
    
    def load_stats(self):
        """Load statistics dari file"""
        if os.path.exists(STATS_DB_FILE):
            try:
                with open(STATS_DB_FILE, 'r', encoding='utf-8') as f:
                    self.stats = json.load(f)
            except Exception as e:
                print(f"⚠️  Error loading statistics: {e}")
                self.stats = self._get_default_stats()
        else:
            self.stats = self._get_default_stats()
    
    def _get_default_stats(self):
        """Get default stats structure"""
        return {
            "users": {},
            "bots": {},
            "channels": {},
            "tiers": {
                "free": 0,
                "booster": 0,
                "donatur": 0,
                "loyalist": 0
            },
            "total_calls": 0,
            "total_hours": 0.0
        }
    
    def save_stats(self):
        """Save statistics ke file"""
        try:
            with open(STATS_DB_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.stats, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            print(f"⚠️  Error saving statistics: {e}")
    
    def record_call(self, user_id: int, bot_number: int, channel_id: int, tier: str, duration_hours: float):
        """Record bot call"""
        user_id_str = str(user_id)
        bot_str = str(bot_number)
        channel_str = str(channel_id)
        
        # Update user stats
        if user_id_str not in self.stats["users"]:
            self.stats["users"][user_id_str] = {
                "total_calls": 0,
                "total_hours": 0.0,
                "tier_usage": {
                    "free": 0,
                    "booster": 0,
                    "donatur": 0,
                    "loyalist": 0
                },
                "last_used": None
            }
        
        user_stats = self.stats["users"][user_id_str]
        user_stats["total_calls"] += 1
        user_stats["total_hours"] += duration_hours
        user_stats["tier_usage"][tier] = user_stats["tier_usage"].get(tier, 0) + 1
        user_stats["last_used"] = datetime.now().isoformat()
        
        # Update bot stats
        if bot_str not in self.stats["bots"]:
            self.stats["bots"][bot_str] = {
                "total_calls": 0,
                "total_hours": 0.0,
                "channels_guarded": set()
            }
        
        bot_stats = self.stats["bots"][bot_str]
        bot_stats["total_calls"] += 1
        bot_stats["total_hours"] += duration_hours
        if isinstance(bot_stats["channels_guarded"], set):
            bot_stats["channels_guarded"].add(channel_str)
        else:
            bot_stats["channels_guarded"] = set(bot_stats["channels_guarded"])
            bot_stats["channels_guarded"].add(channel_str)
        
        # Update channel stats
        if channel_str not in self.stats["channels"]:
            self.stats["channels"][channel_str] = {
                "total_guards": 0,
                "total_hours": 0.0
            }
        
        channel_stats = self.stats["channels"][channel_str]
        channel_stats["total_guards"] += 1
        channel_stats["total_hours"] += duration_hours
        
        # Update tier stats
        self.stats["tiers"][tier] = self.stats["tiers"].get(tier, 0) + 1
        
        # Update global stats
        self.stats["total_calls"] += 1
        self.stats["total_hours"] += duration_hours
        
        self.save_stats()
    
    def get_user_stats(self, user_id: int) -> Dict:
        """Get user statistics"""
        user_id_str = str(user_id)
        if user_id_str not in self.stats["users"]:
            return {
                "total_calls": 0,
                "total_hours": 0.0,
                "tier_usage": {"free": 0, "booster": 0, "donatur": 0, "loyalist": 0},
                "last_used": None
            }
        
        stats = self.stats["users"][user_id_str].copy()
        # Convert set to list for JSON
        return stats
    
    def get_bot_stats(self, bot_number: int) -> Dict:
        """Get bot statistics"""
        bot_str = str(bot_number)
        if bot_str not in self.stats["bots"]:
            return {
                "total_calls": 0,
                "total_hours": 0.0,
                "channels_guarded": 0
            }
        
        stats = self.stats["bots"][bot_str].copy()
        if isinstance(stats.get("channels_guarded"), set):
            stats["channels_guarded"] = len(stats["channels_guarded"])
        return stats
    
    def get_channel_stats(self, channel_id: int) -> Dict:
        """Get channel statistics"""
        channel_str = str(channel_id)
        if channel_str not in self.stats["channels"]:
            return {
                "total_guards": 0,
                "total_hours": 0.0
            }
        
        return self.stats["channels"][channel_str].copy()
    
    def get_leaderboard(self, limit: int = 10) -> List[Dict]:
        """Get user leaderboard"""
        users = []
        for user_id_str, stats in self.stats["users"].items():
            users.append({
                "user_id": int(user_id_str),
                "total_calls": stats["total_calls"],
                "total_hours": stats["total_hours"]
            })
        
        # Sort by total calls, then by total hours
        users.sort(key=lambda x: (x["total_calls"], x["total_hours"]), reverse=True)
        return users[:limit]
    
    def get_global_stats(self) -> Dict:
        """Get global statistics"""
        return {
            "total_users": len(self.stats["users"]),
            "total_calls": self.stats["total_calls"],
            "total_hours": self.stats["total_hours"],
            "tier_distribution": self.stats["tiers"].copy(),
            "active_bots": len(self.stats["bots"])
        }


# Global instance
statistics_manager = StatisticsManager()

