"""
Tier Manager untuk sistem role-based bot satpam
Menggunakan role dan server boost untuk menentukan tier user
"""
import json
import os
from typing import Dict, Optional
from datetime import datetime
import discord

# Tier categories dan durasi stay (dalam jam)
TIER_CATEGORIES = {
    "free": {
        "name": "Free User",
        "stay_duration_hours": 12,
        "description": "12 jam stay setelah user keluar",
        "requirement": "Default untuk semua user"
    },
    "booster": {
        "name": "Server Booster",
        "stay_duration_hours": 36,
        "description": "36 jam stay setelah user keluar",
        "requirement": "Discord Server Booster (Nitro Boost)"
    },
    "donatur": {
        "name": "Donatur",
        "stay_duration_hours": 48,
        "description": "48 jam (2 hari) stay setelah user keluar",
        "requirement": "Memiliki role Donatur"
    },
    "loyalist": {
        "name": "Server Loyalist",
        "stay_duration_hours": 24,
        "description": "24 jam (1 hari) stay setelah user keluar",
        "requirement": "Memiliki role Server Loyalist"
    }
}

# Config untuk role names dan IDs (bisa diubah di config.json)
DEFAULT_ROLE_NAMES = {
    "donatur": ["Donatur", "donatur", "DONATUR", "Donator", "donator"],
    "loyalist": ["Server Loyalist", "Loyalist", "loyalist", "LOYALIST", "Server Loyal", "Loyal"]
}

# Default role IDs
DEFAULT_ROLE_IDS = {
    "donatur": [1450281880233447467],
    "loyalist": [1451645134700544262]
}


class SubscriptionManager:
    """Manager untuk handle tier berdasarkan role dan server boost"""
    
    def __init__(self):
        self.role_names = DEFAULT_ROLE_NAMES.copy()
        self.role_ids = DEFAULT_ROLE_IDS.copy()
        self.load_config()
    
    def load_config(self):
        """Load role names dan IDs dari config.json jika ada"""
        try:
            with open('config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
                if 'role_names' in config:
                    # Merge dengan default, config.json override default
                    for key, value in config['role_names'].items():
                        if key in self.role_names:
                            self.role_names[key] = value
                if 'role_ids' in config:
                    # Merge role IDs
                    for key, value in config['role_ids'].items():
                        if key in self.role_ids:
                            # Convert to list if single value
                            if isinstance(value, (int, str)):
                                self.role_ids[key] = [int(value)]
                            else:
                                self.role_ids[key] = [int(v) for v in value]
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"⚠️  Error loading config: {e}")
    
    def get_user_tier(self, member: discord.Member) -> str:
        """
        Get tier untuk user berdasarkan:
        1. Server Booster (highest priority) - 36 jam
        2. Role Donatur - 48 jam
        3. Role Loyalist - 24 jam
        4. Free (default) - 12 jam
        """
        # Priority 1: Server Booster
        if member.premium_since is not None:
            return "booster"
        
        # Priority 2: Donatur (cek by ID atau name)
        for role in member.roles:
            # Cek by role ID
            if role.id in self.role_ids.get("donatur", []):
                return "donatur"
            # Cek by role name
            if role.name in self.role_names.get("donatur", []):
                return "donatur"
        
        # Priority 3: Server Loyalist (cek by ID atau name)
        for role in member.roles:
            # Cek by role ID
            if role.id in self.role_ids.get("loyalist", []):
                return "loyalist"
            # Cek by role name
            if role.name in self.role_names.get("loyalist", []):
                return "loyalist"
        
        # Default: Free
        return "free"
    
    def get_stay_duration_hours(self, member: discord.Member) -> int:
        """Get durasi stay (dalam jam) untuk user berdasarkan tier"""
        tier = self.get_user_tier(member)
        return TIER_CATEGORIES[tier]["stay_duration_hours"]
    
    def get_tier_info(self, tier: str) -> Dict:
        """Get info tentang tier"""
        return TIER_CATEGORIES.get(tier, TIER_CATEGORIES["free"])
    
    def get_user_tier_info(self, member: discord.Member) -> Dict:
        """Get info tier user"""
        tier = self.get_user_tier(member)
        tier_info = self.get_tier_info(tier)
        
        info = {
            "tier": tier,
            "tier_name": tier_info["name"],
            "stay_duration_hours": tier_info["stay_duration_hours"],
            "description": tier_info["description"],
            "requirement": tier_info["requirement"]
        }
        
        # Add info tentang bagaimana user dapat tier ini
        if tier == "booster":
            info["boost_since"] = member.premium_since.isoformat() if member.premium_since else None
        elif tier == "donatur":
            # Cek by ID atau name
            donatur_roles = []
            for role in member.roles:
                if role.id in self.role_ids.get("donatur", []) or role.name in self.role_names.get("donatur", []):
                    donatur_roles.append(role.name)
            info["has_role"] = donatur_roles[0] if donatur_roles else None
        elif tier == "loyalist":
            # Cek by ID atau name
            loyalist_roles = []
            for role in member.roles:
                if role.id in self.role_ids.get("loyalist", []) or role.name in self.role_names.get("loyalist", []):
                    loyalist_roles.append(role.name)
            info["has_role"] = loyalist_roles[0] if loyalist_roles else None
        
        return info


# Global instance
subscription_manager = SubscriptionManager()
