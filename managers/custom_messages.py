"""
Custom Messages Manager untuk bot satpam
"""
import json
import os
from typing import Dict, Optional

CUSTOM_MESSAGES_FILE = "custom_messages.json"

# Default messages
DEFAULT_MESSAGES = {
    "join": "🛡️ **Satpam Bot {bot}** sekarang menjaga {channel}!\n📊 **Tier:** {tier}\n⏰ **Durasi Stay:** {duration} jam",
    "leave": "👋 **Satpam Bot {bot}** sudah pulang dari {channel}!",
    "timer_warning": "⏰ **Satpam Bot {bot}** akan disconnect dalam {time} menit!",
    "queue_join": "🎯 Kamu masuk queue di posisi **#{position}**!\nBot akan otomatis assign saat ada bot yang tersedia.",
    "queue_ready": "🎉 Giliran kamu! **Satpam Bot {bot}** sekarang tersedia!\nBot akan otomatis join ke {channel} dalam 30 detik."
}


class CustomMessagesManager:
    """Manager untuk handle custom messages"""
    
    def __init__(self):
        self.messages = DEFAULT_MESSAGES.copy()
        self.load_messages()
    
    def load_messages(self):
        """Load custom messages dari file"""
        if os.path.exists(CUSTOM_MESSAGES_FILE):
            try:
                with open(CUSTOM_MESSAGES_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Merge dengan default
                    self.messages.update(data.get("messages", {}))
            except Exception as e:
                print(f"⚠️  Error loading custom messages: {e}")
    
    def save_messages(self):
        """Save custom messages ke file"""
        try:
            with open(CUSTOM_MESSAGES_FILE, 'w', encoding='utf-8') as f:
                json.dump({"messages": self.messages}, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️  Error saving custom messages: {e}")
    
    def get_message(self, event: str, **kwargs) -> str:
        """Get formatted message for event"""
        template = self.messages.get(event, DEFAULT_MESSAGES.get(event, ""))
        
        # Format with variables
        try:
            return template.format(**kwargs)
        except KeyError as e:
            print(f"⚠️  Missing variable in message template: {e}")
            return template
    
    def set_message(self, event: str, message: str):
        """Set custom message for event"""
        if event not in DEFAULT_MESSAGES:
            raise ValueError(f"Invalid event: {event}")
        
        self.messages[event] = message
        self.save_messages()
    
    def reset_message(self, event: str):
        """Reset message to default"""
        if event in DEFAULT_MESSAGES:
            self.messages[event] = DEFAULT_MESSAGES[event]
            self.save_messages()
    
    def get_all_messages(self) -> Dict:
        """Get all custom messages"""
        return self.messages.copy()


# Global instance
custom_messages_manager = CustomMessagesManager()

