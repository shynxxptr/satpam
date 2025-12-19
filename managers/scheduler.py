"""
Scheduler untuk Scheduled Stay system
"""
import json
import os
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import asyncio

SCHEDULES_DB_FILE = "schedules.json"


class Scheduler:
    """Manager untuk handle scheduled stays"""
    
    def __init__(self):
        self.schedules: List[Dict] = []
        self.running_tasks: Dict[int, asyncio.Task] = {}  # {schedule_id: task}
        self.load_schedules()
    
    def load_schedules(self):
        """Load schedules dari file"""
        if os.path.exists(SCHEDULES_DB_FILE):
            try:
                with open(SCHEDULES_DB_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.schedules = data.get("schedules", [])
            except Exception as e:
                print(f"⚠️  Error loading schedules: {e}")
                self.schedules = []
        else:
            self.schedules = []
    
    def save_schedules(self):
        """Save schedules ke file"""
        try:
            with open(SCHEDULES_DB_FILE, 'w', encoding='utf-8') as f:
                json.dump({"schedules": self.schedules}, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            print(f"⚠️  Error saving schedules: {e}")
    
    def create_schedule(self, user_id: int, channel_id: int, scheduled_time: str, 
                       recurring: Optional[str] = None) -> int:
        """Create new schedule"""
        schedule_id = len(self.schedules) + 1
        
        # Parse scheduled_time
        if scheduled_time.startswith("+"):
            # Relative time
            parts = scheduled_time[1:].split()
            if len(parts) == 2:
                amount = int(parts[0])
                unit = parts[1].lower()
                
                if unit in ["minute", "minutes", "min", "mins"]:
                    scheduled_datetime = datetime.now() + timedelta(minutes=amount)
                elif unit in ["hour", "hours", "hr", "hrs"]:
                    scheduled_datetime = datetime.now() + timedelta(hours=amount)
                else:
                    raise ValueError(f"Invalid time unit: {unit}")
            else:
                raise ValueError("Invalid relative time format")
        else:
            # Absolute time (HH:MM)
            try:
                hour, minute = map(int, scheduled_time.split(":"))
                scheduled_datetime = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
                # If time already passed today, schedule for tomorrow
                if scheduled_datetime < datetime.now():
                    scheduled_datetime += timedelta(days=1)
            except:
                raise ValueError("Invalid time format. Use HH:MM or +X minutes/hours")
        
        schedule = {
            "id": schedule_id,
            "user_id": user_id,
            "channel_id": channel_id,
            "scheduled_time": scheduled_datetime.isoformat(),
            "recurring": recurring,  # "daily", "weekly", or None
            "active": True,
            "created_at": datetime.now().isoformat()
        }
        
        self.schedules.append(schedule)
        self.save_schedules()
        return schedule_id
    
    def get_user_schedules(self, user_id: int) -> List[Dict]:
        """Get all schedules for user"""
        return [s for s in self.schedules if s["user_id"] == user_id and s["active"]]
    
    def get_schedule(self, schedule_id: int) -> Optional[Dict]:
        """Get schedule by ID"""
        for schedule in self.schedules:
            if schedule["id"] == schedule_id:
                return schedule
        return None
    
    def delete_schedule(self, schedule_id: int, user_id: int) -> bool:
        """Delete schedule"""
        for schedule in self.schedules:
            if schedule["id"] == schedule_id and schedule["user_id"] == user_id:
                schedule["active"] = False
                self.save_schedules()
                
                # Cancel running task
                if schedule_id in self.running_tasks:
                    self.running_tasks[schedule_id].cancel()
                    del self.running_tasks[schedule_id]
                
                return True
        return False
    
    def edit_schedule(self, schedule_id: int, user_id: int, scheduled_time: str) -> bool:
        """Edit schedule time"""
        schedule = self.get_schedule(schedule_id)
        if not schedule or schedule["user_id"] != user_id:
            return False
        
        # Parse new time
        if scheduled_time.startswith("+"):
            parts = scheduled_time[1:].split()
            if len(parts) == 2:
                amount = int(parts[0])
                unit = parts[1].lower()
                
                if unit in ["minute", "minutes", "min", "mins"]:
                    scheduled_datetime = datetime.now() + timedelta(minutes=amount)
                elif unit in ["hour", "hours", "hr", "hrs"]:
                    scheduled_datetime = datetime.now() + timedelta(hours=amount)
                else:
                    return False
            else:
                return False
        else:
            try:
                hour, minute = map(int, scheduled_time.split(":"))
                scheduled_datetime = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
                if scheduled_datetime < datetime.now():
                    scheduled_datetime += timedelta(days=1)
            except:
                return False
        
        schedule["scheduled_time"] = scheduled_datetime.isoformat()
        self.save_schedules()
        return True


# Global instance
scheduler = Scheduler()

