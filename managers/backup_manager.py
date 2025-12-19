"""
Backup & Recovery Manager untuk bot satpam
"""
import json
import os
import shutil
from typing import Dict, Optional, List
from datetime import datetime
import glob

BACKUP_DIR = "backups"
BACKUP_RETENTION = 10
AUTO_BACKUP_INTERVAL = 300  # 5 minutes


class BackupManager:
    """Manager untuk handle backup dan recovery"""
    
    def __init__(self):
        self.backup_dir = BACKUP_DIR
        self.ensure_backup_dir()
    
    def ensure_backup_dir(self):
        """Ensure backup directory exists"""
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)
    
    def create_backup(self, data: Dict) -> str:
        """Create backup from data"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_id = f"backup_{timestamp}"
        backup_file = os.path.join(self.backup_dir, f"{backup_id}.json")
        
        backup_data = {
            "backup_id": backup_id,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        try:
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False, default=str)
            
            # Clean old backups
            self._clean_old_backups()
            
            return backup_id
        except Exception as e:
            print(f"⚠️  Error creating backup: {e}")
            return None
    
    def _clean_old_backups(self):
        """Clean old backups, keep only last N"""
        backup_files = glob.glob(os.path.join(self.backup_dir, "backup_*.json"))
        backup_files.sort(key=os.path.getmtime, reverse=True)
        
        # Keep only last N backups
        if len(backup_files) > BACKUP_RETENTION:
            for old_backup in backup_files[BACKUP_RETENTION:]:
                try:
                    os.remove(old_backup)
                except Exception as e:
                    print(f"⚠️  Error removing old backup: {e}")
    
    def get_latest_backup(self) -> Optional[Dict]:
        """Get latest backup"""
        backup_files = glob.glob(os.path.join(self.backup_dir, "backup_*.json"))
        if not backup_files:
            return None
        
        # Get most recent
        latest_file = max(backup_files, key=os.path.getmtime)
        
        try:
            with open(latest_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Error loading backup: {e}")
            return None
    
    def restore_backup(self, backup_id: Optional[str] = None) -> Optional[Dict]:
        """Restore from backup"""
        if backup_id:
            backup_file = os.path.join(self.backup_dir, f"{backup_id}.json")
            if not os.path.exists(backup_file):
                return None
            
            try:
                with open(backup_file, 'r', encoding='utf-8') as f:
                    backup = json.load(f)
                    return backup.get("data")
            except Exception as e:
                print(f"⚠️  Error restoring backup: {e}")
                return None
        else:
            # Restore from latest
            backup = self.get_latest_backup()
            if backup:
                return backup.get("data")
            return None
    
    def list_backups(self) -> List[Dict]:
        """List all backups"""
        backup_files = glob.glob(os.path.join(self.backup_dir, "backup_*.json"))
        backups = []
        
        for backup_file in sorted(backup_files, key=os.path.getmtime, reverse=True):
            try:
                with open(backup_file, 'r', encoding='utf-8') as f:
                    backup_data = json.load(f)
                    backups.append({
                        "backup_id": backup_data.get("backup_id"),
                        "timestamp": backup_data.get("timestamp"),
                        "file": os.path.basename(backup_file)
                    })
            except Exception as e:
                print(f"⚠️  Error reading backup: {e}")
        
        return backups
    
    def get_backup_status(self) -> Dict:
        """Get backup system status"""
        backups = self.list_backups()
        latest = self.get_latest_backup()
        
        return {
            "enabled": True,
            "backup_count": len(backups),
            "latest_backup": latest.get("timestamp") if latest else None,
            "backup_dir": self.backup_dir,
            "retention": BACKUP_RETENTION
        }


# Global instance
backup_manager = BackupManager()

