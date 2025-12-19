# 🛡️ Satpam Discord Bot

Discord bot untuk jaga voice channel dengan multiple bot instances.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Config

Copy `config.json.example` ke `config.json`:

```bash
cp config.json.example config.json
```

Edit `config.json` dan isi bot tokens:

```json
{
  "bot_tokens": [
    "YOUR_BOT_TOKEN_1",
    "YOUR_BOT_TOKEN_2",
    "",
    "",
    ""
  ],
  "role_ids": {
    "donatur": [1450281880233447467],
    "loyalist": [1451645134700544262]
  },
  "idle_voice_channel_id": 1451645891600453652,
  "music_enabled_bot": 1
}
```

### 3. Run Bot

```bash
npm start
```

## 📁 Project Structure

```
satpam/
├── src/
│   ├── index.js              # Main entry point
│   ├── bot/
│   │   ├── BotInstance.js    # Bot instance class
│   │   ├── commands.js        # Slash commands
│   │   └── prefixCommands.js  # Prefix commands
│   ├── managers/
│   │   ├── tierManager.js     # Tier/subscription manager
│   │   ├── queueManager.js    # Queue system
│   │   ├── statistics.js      # Statistics tracking
│   │   ├── notificationManager.js # Notification system
│   │   ├── backupManager.js   # Backup & recovery
│   │   └── scheduler.js       # Scheduled stays
│   └── utils/
│       ├── config.js          # Config loader
│       └── startupCheck.js    # Startup checks
├── config.json.example
├── package.json
└── README.md
```

## 🎯 Features

- ✅ Multiple bot instances (up to 5)
- ✅ Voice channel guard system
- ✅ Role-based tier system (Free, Booster, Donatur, Loyalist)
- ✅ Queue system
- ✅ Statistics tracking
- ✅ Auto-reconnect
- ✅ Scheduled stays
- ✅ Backup & recovery
- ✅ Prefix commands (`satpam!`)
- ✅ Slash commands (`/panggil`)

## 📝 Commands

### Prefix Commands
- `satpam!panggil` - Panggil bot jaga voice
- `satpam!pulang` - Suruh bot pulang
- `satpam!status` - Lihat status bot
- `satpam!help` - Lihat semua commands
- `satpam!tier` - Lihat tier kamu
- `satpam!tiers` - Lihat semua tier

### Slash Commands
- `/panggil` - Panggil bot
- `/pulang` - Suruh bot pulang
- `/status` - Status bot
- `/tier` - Lihat tier kamu
- `/tiers` - Lihat semua tier

## 🔧 Configuration

Edit `config.json` untuk mengatur:
- `bot_tokens` - Array bot tokens (1-5 tokens)
- `role_ids` - Role IDs untuk Donatur dan Loyalist
- `idle_voice_channel_id` - ID voice channel untuk idle
- `music_enabled_bot` - Nomor bot yang bisa play music (optional)

## 📖 Documentation

Lihat `docs/` folder untuk dokumentasi lengkap.

## 🐛 Troubleshooting

### Bot tidak start
```bash
# Check config
npm test

# Check logs
tail -f logs/bot.log
```

### Module not found
```bash
npm install
```

## 📄 License

MIT
