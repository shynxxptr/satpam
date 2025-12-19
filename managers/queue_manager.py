"""
Queue Manager untuk bot satpam
"""
import json
import os
from typing import Dict, Optional, List
from datetime import datetime, timedelta

QUEUE_DB_FILE = "queue.json"
QUEUE_TIMEOUT_MINUTES = 5


class QueueManager:
    """Manager untuk handle queue system"""
    
    def __init__(self):
        self.queue: List[Dict] = []
        self.load_queue()
    
    def load_queue(self):
        """Load queue dari file"""
        if os.path.exists(QUEUE_DB_FILE):
            try:
                with open(QUEUE_DB_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.queue = data.get("queue", [])
            except Exception as e:
                print(f"⚠️  Error loading queue: {e}")
                self.queue = []
        else:
            self.queue = []
    
    def save_queue(self):
        """Save queue ke file"""
        try:
            with open(QUEUE_DB_FILE, 'w', encoding='utf-8') as f:
                json.dump({"queue": self.queue}, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            print(f"⚠️  Error saving queue: {e}")
    
    def add_to_queue(self, user_id: int, channel_id: int, tier: str) -> int:
        """Add user to queue, return position"""
        # Remove user if already in queue
        self.remove_from_queue(user_id)
        
        position = len(self.queue) + 1
        queue_entry = {
            "user_id": user_id,
            "channel_id": channel_id,
            "tier": tier,
            "position": position,
            "joined_at": datetime.now().isoformat()
        }
        
        self.queue.append(queue_entry)
        self._update_positions()
        self.save_queue()
        return position
    
    def remove_from_queue(self, user_id: int) -> bool:
        """Remove user from queue"""
        initial_len = len(self.queue)
        self.queue = [q for q in self.queue if q["user_id"] != user_id]
        
        if len(self.queue) != initial_len:
            self._update_positions()
            self.save_queue()
            return True
        return False
    
    def _update_positions(self):
        """Update positions in queue"""
        for i, entry in enumerate(self.queue, start=1):
            entry["position"] = i
    
    def get_queue_position(self, user_id: int) -> Optional[int]:
        """Get user position in queue"""
        for entry in self.queue:
            if entry["user_id"] == user_id:
                return entry["position"]
        return None
    
    def get_next_in_queue(self) -> Optional[Dict]:
        """Get next user in queue"""
        if not self.queue:
            return None
        
        # Remove expired entries
        self._clean_expired()
        
        if not self.queue:
            return None
        
        return self.queue[0]
    
    def _clean_expired(self):
        """Remove expired queue entries"""
        now = datetime.now()
        expired = []
        
        for entry in self.queue:
            joined_at = datetime.fromisoformat(entry["joined_at"])
            if (now - joined_at).total_seconds() > QUEUE_TIMEOUT_MINUTES * 60:
                expired.append(entry["user_id"])
        
        for user_id in expired:
            self.remove_from_queue(user_id)
    
    def get_queue_info(self, user_id: int) -> Optional[Dict]:
        """Get queue info for user"""
        position = self.get_queue_position(user_id)
        if position is None:
            return None
        
        entry = next((q for q in self.queue if q["user_id"] == user_id), None)
        if not entry:
            return None
        
        # Calculate estimated wait time (rough estimate: 15 minutes per user)
        estimated_minutes = (position - 1) * 15
        
        return {
            "position": position,
            "total_in_queue": len(self.queue),
            "estimated_minutes": estimated_minutes,
            "joined_at": entry["joined_at"]
        }
    
    def get_queue_list(self) -> List[Dict]:
        """Get full queue list"""
        self._clean_expired()
        return self.queue.copy()
    
    def clear_queue(self):
        """Clear entire queue"""
        self.queue = []
        self.save_queue()


# Global instance
queue_manager = QueueManager()

