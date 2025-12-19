# Project Structure 📁

Struktur project yang lebih modular dan terorganisir.

## 📂 Current Structure (Before)

```
satpam/
├── bot_multi.py
├── bot_commands.py
├── bot_music_commands.py
├── prefix_commands.py
├── music_manager.py
├── spotify_manager.py
├── subscription_manager.py
├── statistics.py
├── queue_manager.py
├── notification_manager.py
├── custom_messages.py
├── backup_manager.py
├── scheduler.py
├── logger.py
├── config_validator.py
├── startup_check.py
├── run_multi.py
├── config.json.example
├── requirements.txt
└── *.md (documentation)
```

## 📂 Proposed Structure (After)

```
satpam/
├── bot/
│   ├── __init__.py
│   ├── bot_multi.py          # Main bot instance
│   ├── commands.py           # Slash commands
│   ├── music_commands.py     # Music slash commands
│   └── prefix_commands.py    # Prefix commands
├── managers/
│   ├── __init__.py
│   ├── music_manager.py
│   ├── spotify_manager.py
│   ├── subscription_manager.py
│   ├── statistics.py
│   ├── queue_manager.py
│   ├── notification_manager.py
│   ├── custom_messages.py
│   ├── backup_manager.py
│   └── scheduler.py
├── utils/
│   ├── __init__.py
│   ├── logger.py
│   ├── config_validator.py
│   └── startup_check.py
├── config/
│   └── config.json.example
├── docs/
│   ├── README.md
│   ├── QUICK_START.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── SETUP_GUIDE.md
│   ├── MUSIC_SETUP.md
│   ├── SPOTIFY_SETUP.md
│   └── ... (other docs)
├── run_multi.py              # Entry point
├── requirements.txt
└── .gitignore
```

## 🔄 Migration Plan

1. Create folder structure
2. Move files to appropriate folders
3. Update all imports
4. Add __init__.py files
5. Test all functionality

