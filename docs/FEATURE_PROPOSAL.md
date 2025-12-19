# Feature Proposal - Bot Satpam 🚀

Dokumentasi lengkap untuk fitur-fitur yang akan diimplementasikan.

## 📊 1. Statistics & Analytics

### Deskripsi
Sistem tracking dan statistik untuk monitor penggunaan bot satpam.

### Fitur
- **User Statistics**: Track berapa kali user panggil bot, total durasi stay
- **Bot Statistics**: Track berapa kali setiap bot dipanggil, total jam aktif
- **Channel Statistics**: Track channel mana yang paling sering dijaga
- **Tier Statistics**: Track distribusi penggunaan per tier
- **Leaderboard**: Ranking user yang paling aktif pakai bot

### Commands
```
/stats [user]          - Lihat statistik user (atau user sendiri)
/stats_bot [bot_number] - Lihat statistik bot tertentu
/stats_channel         - Lihat statistik channel
/leaderboard           - Lihat leaderboard user paling aktif
```

### Data yang Ditrack
```json
{
  "users": {
    "123456789": {
      "total_calls": 45,
      "total_hours": 120.5,
      "tier_usage": {
        "free": 10,
        "booster": 20,
        "donatur": 15
      },
      "last_used": "2024-01-15T10:30:00"
    }
  },
  "bots": {
    "1": {
      "total_calls": 150,
      "total_hours": 500.2,
      "channels_guarded": 25
    }
  },
  "channels": {
    "1451645891600453652": {
      "total_guards": 80,
      "total_hours": 300.5
    }
  }
}
```

### Contoh Output
```
📊 Statistik User: @username
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Total Panggilan: 45 kali
⏰ Total Durasi: 120.5 jam
📈 Tier Usage:
   🆓 Free: 10 kali
   🚀 Booster: 20 kali
   💝 Donatur: 15 kali
🕐 Terakhir Digunakan: 2 jam yang lalu
```

---

## 🎯 2. Queue System

### Deskripsi
Sistem antrian ketika semua bot sedang sibuk. User bisa masuk queue dan akan otomatis dapat bot saat ada yang free.

### Fitur
- **Auto Queue**: Otomatis masuk queue jika semua bot sibuk
- **Position Tracking**: User tahu posisi di queue
- **Auto Assign**: Bot otomatis assign ke user berikutnya saat free
- **Queue Notifications**: Notifikasi saat giliran tiba
- **Queue Timeout**: Auto remove dari queue setelah X menit

### Commands
```
/panggil [channel]     - Jika semua bot sibuk, auto masuk queue
/queue_status          - Lihat posisi di queue
/queue_leave           - Keluar dari queue
/queue_list            - Lihat semua user di queue (Admin)
```

### Flow
1. User panggil bot → Semua bot sibuk
2. Bot reply: "Semua bot sibuk! Kamu masuk queue di posisi #3"
3. Bot #1 selesai → Auto assign ke user pertama di queue
4. User dapat notifikasi: "Giliran kamu! Bot #1 sekarang tersedia"
5. User punya 30 detik untuk claim, jika tidak auto skip

### Data Structure
```json
{
  "queue": [
    {
      "user_id": 123456789,
      "channel_id": 1451645891600453652,
      "position": 1,
      "joined_at": "2024-01-15T10:00:00",
      "tier": "booster"
    }
  ],
  "queue_timeout_minutes": 5
}
```

### Contoh Output
```
🎯 Queue Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Posisi: #3 dari 5 user
⏰ Estimasi: ~15 menit
👥 Di depan kamu:
   1. @user1 (Booster)
   2. @user2 (Donatur)
```

---

## 🔔 3. Notification System

### Deskripsi
Sistem notifikasi untuk berbagai event bot (join, leave, timer warning, dll).

### Fitur
- **Timer Warning**: Notifikasi 5 menit sebelum bot disconnect
- **Join/Leave Notifications**: Notifikasi saat bot join/leave channel
- **Queue Notifications**: Notifikasi saat giliran di queue
- **DM Notifications**: Bisa kirim via DM atau channel
- **Customizable**: User bisa enable/disable notifikasi tertentu

### Commands
```
/notify_settings       - Atur preferensi notifikasi
/notify_test           - Test notifikasi
```

### Notification Types
1. **Timer Warning**: "⏰ Bot akan disconnect dalam 5 menit!"
2. **Bot Join**: "✅ Bot #1 sekarang menjaga channel kamu!"
3. **Bot Leave**: "👋 Bot #1 sudah pulang"
4. **Queue Ready**: "🎯 Giliran kamu! Bot #1 tersedia"
5. **Timer Expired**: "⏰ Waktu stay habis, bot sudah pulang"

### Settings
```json
{
  "notifications": {
    "timer_warning": true,
    "join_notification": true,
    "leave_notification": false,
    "queue_notification": true,
    "dm_enabled": true,
    "channel_id": null  // null = DM, atau channel ID
  }
}
```

### Contoh Output
```
🔔 Notification Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Timer Warning (5 menit sebelum disconnect)
✅ Join Notification
❌ Leave Notification
✅ Queue Notification
📬 Delivery: DM
```

---

## 💬 4. Custom Messages

### Deskripsi
Admin bisa set custom message untuk berbagai event, dengan support variables.

### Fitur
- **Event-based Messages**: Berbeda untuk join, leave, timer warning
- **Variables Support**: `{user}`, `{channel}`, `{tier}`, `{bot}`, `{time}`
- **Tier-specific**: Bisa beda message per tier
- **Rich Formatting**: Support embed, emoji, dll

### Commands
```
/message_set <event> <message> - Set custom message
/message_list                  - Lihat semua custom messages
/message_reset <event>         - Reset ke default
```

### Events
- `join` - Saat bot join channel
- `leave` - Saat bot leave channel
- `timer_warning` - Warning sebelum disconnect
- `queue_join` - Saat masuk queue
- `queue_ready` - Saat giliran di queue

### Variables
- `{user}` - Mention user
- `{user_name}` - Nama user
- `{channel}` - Mention channel
- `{channel_name}` - Nama channel
- `{tier}` - Tier user (Free, Booster, dll)
- `{bot}` - Bot number (#1, #2, dll)
- `{time}` - Waktu tersisa (untuk timer)
- `{duration}` - Durasi stay

### Contoh
```
Event: join
Message: "🛡️ **Satpam Bot {bot}** sekarang menjaga {channel}!\n📊 Tier: {tier}\n⏰ Stay: {duration} jam"

Output:
🛡️ **Satpam Bot #1** sekarang menjaga #general-voice!
📊 Tier: Booster
⏰ Stay: 36 jam
```

### Config
```json
{
  "custom_messages": {
    "join": "🛡️ **Satpam Bot {bot}** sekarang menjaga {channel}!",
    "leave": "👋 **Satpam Bot {bot}** sudah pulang dari {channel}",
    "timer_warning": "⏰ **Satpam Bot {bot}** akan disconnect dalam {time}",
    "queue_join": "🎯 Kamu masuk queue di posisi #{position}",
    "queue_ready": "🎉 Giliran kamu! **Satpam Bot {bot}** tersedia"
  }
}
```

---

## 🔄 6. Auto-Reconnect

### Deskripsi
Sistem auto-reconnect jika bot terputus karena error atau network issue.

### Fitur
- **Auto Reconnect**: Otomatis reconnect ke channel yang sama
- **Health Check**: Periodic check apakah bot masih connected
- **Reconnect Retry**: Retry dengan exponential backoff
- **State Recovery**: Restore state setelah reconnect
- **Idle Channel Fallback**: Jika tidak bisa reconnect, join idle channel

### Behavior
1. Bot terputus → Detect disconnect
2. Wait 5 detik → Cek apakah benar-benar disconnect
3. Retry connect → Maksimal 3 kali dengan delay 5s, 10s, 20s
4. Success → Restore state (timer, assignments, dll)
5. Failed → Join idle channel sebagai fallback

### Logging
```
[2024-01-15 10:30:00] ⚠️  Bot #1 disconnected from channel
[2024-01-15 10:30:05] 🔄 Attempting reconnect (1/3)...
[2024-01-15 10:30:10] ✅ Reconnected successfully!
[2024-01-15 10:30:10] 🔄 State restored
```

### Config
```json
{
  "auto_reconnect": {
    "enabled": true,
    "max_retries": 3,
    "retry_delays": [5, 10, 20],  // seconds
    "health_check_interval": 30  // seconds
  }
}
```

---

## 📅 9. Scheduled Stay

### Deskripsi
User bisa schedule bot untuk stay di channel pada waktu tertentu.

### Fitur
- **Schedule Creation**: User bisa schedule bot untuk waktu tertentu
- **Recurring Schedule**: Support daily, weekly schedule
- **Multiple Schedules**: User bisa punya beberapa schedule
- **Auto Cancel**: Auto cancel jika channel sudah dijaga bot lain
- **Notifications**: Notifikasi saat schedule aktif

### Commands
```
/schedule_create <channel> <time> [recurring] - Buat schedule
/schedule_list                                 - Lihat semua schedule
/schedule_delete <id>                          - Hapus schedule
/schedule_edit <id> <time>                     - Edit schedule
```

### Time Format
- `HH:MM` - Absolute time (contoh: `20:00`)
- `+X minutes/hours` - Relative time (contoh: `+30 minutes`)
- `daily` - Setiap hari pada waktu yang sama
- `weekly` - Setiap minggu pada hari dan waktu yang sama

### Contoh
```
/schedule_create #general-voice 20:00 daily
→ Bot akan stay di #general-voice setiap hari jam 8 malam

/schedule_create #event-voice +2 hours
→ Bot akan stay di #event-voice 2 jam dari sekarang
```

### Data Structure
```json
{
  "schedules": [
    {
      "id": 1,
      "user_id": 123456789,
      "channel_id": 1451645891600453652,
      "scheduled_time": "20:00",
      "recurring": "daily",
      "active": true,
      "created_at": "2024-01-15T10:00:00"
    }
  ]
}
```

### Flow
1. User create schedule → Bot save schedule
2. Waktu tiba → Bot cek apakah channel masih kosong
3. Jika kosong → Bot auto join dan stay
4. Jika tidak kosong → Skip dan notify user
5. Recurring → Auto repeat sesuai pattern

---

## 💾 10. Backup & Recovery

### Deskripsi
Sistem backup dan recovery untuk state bot, assignments, dan data penting.

### Fitur
- **Auto Backup**: Periodic backup state ke file/database
- **State Recovery**: Restore state setelah restart
- **Data Persistence**: Save assignments, timers, queue, dll
- **Backup History**: Keep multiple backup versions
- **Manual Backup**: Admin bisa trigger manual backup

### Commands
```
/backup_create        - Buat backup manual (Admin)
/backup_list          - Lihat backup history (Admin)
/backup_restore <id>   - Restore dari backup (Admin)
/backup_status        - Lihat status backup system
```

### Data yang Di-backup
- Bot assignments (channel → bot mapping)
- Active timers (stay_until, timer tasks)
- Queue data
- Statistics
- Schedules
- Custom messages
- User settings

### Backup Format
```json
{
  "backup_id": "20240115_103000",
  "timestamp": "2024-01-15T10:30:00",
  "data": {
    "assignments": {...},
    "timers": {...},
    "queue": {...},
    "statistics": {...},
    "schedules": {...}
  }
}
```

### Auto Backup
- **Interval**: Setiap 5 menit
- **Retention**: Keep last 10 backups
- **Location**: `backups/` directory
- **Format**: JSON files dengan timestamp

### Recovery Flow
1. Bot start → Cek apakah ada backup terbaru
2. Load backup → Restore state dari backup
3. Validate → Cek apakah data masih valid
4. Restore → Restore assignments, timers, dll
5. Resume → Bot continue dari state sebelumnya

### Config
```json
{
  "backup": {
    "enabled": true,
    "auto_backup_interval": 300,  // seconds (5 minutes)
    "backup_retention": 10,  // keep last 10 backups
    "backup_location": "backups/",
    "auto_recover": true
  }
}
```

---

## 📋 Implementation Priority

### Phase 1 (Core Features)
1. ✅ Statistics & Analytics
2. ✅ Backup & Recovery
3. ✅ Auto-Reconnect

### Phase 2 (User Experience)
4. ✅ Queue System
5. ✅ Notification System

### Phase 3 (Advanced)
6. ✅ Custom Messages
7. ✅ Scheduled Stay

---

## 🎨 UI/UX Preview

### Statistics Dashboard
```
📊 Bot Satpam Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 Total Users: 150
📞 Total Calls: 1,250
⏰ Total Hours: 5,000+
🤖 Active Bots: 5/5

Top Users:
1. @user1 - 120 calls, 500 hours
2. @user2 - 95 calls, 400 hours
3. @user3 - 80 calls, 350 hours
```

### Queue Interface
```
🎯 Queue Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Your Position: #3
⏰ Estimated Wait: ~15 minutes
👥 Queue: 5 users

[Leave Queue] button
```

### Notification Example
```
🔔 Notification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Bot #1 akan disconnect dalam 5 menit!
Channel: #general-voice
Tier: Booster
```

---

## ⚙️ Configuration Summary

Semua fitur akan bisa di-configure via `config.json`:

```json
{
  "bot_tokens": [...],
  "role_ids": {...},
  "idle_voice_channel_id": 1451645891600453652,
  
  "statistics": {
    "enabled": true,
    "track_users": true,
    "track_bots": true,
    "track_channels": true
  },
  
  "queue": {
    "enabled": true,
    "timeout_minutes": 5,
    "max_queue_size": 20
  },
  
  "notifications": {
    "enabled": true,
    "timer_warning": true,
    "dm_enabled": true
  },
  
  "custom_messages": {
    "enabled": true,
    "messages": {...}
  },
  
  "auto_reconnect": {
    "enabled": true,
    "max_retries": 3
  },
  
  "schedules": {
    "enabled": true,
    "max_per_user": 5
  },
  
  "backup": {
    "enabled": true,
    "auto_backup_interval": 300
  }
}
```

---

## 📝 Notes

- Semua fitur bisa di-enable/disable per fitur
- Data akan disimpan di file JSON atau database (opsional)
- Tidak ada breaking changes ke fitur existing
- Semua command akan menggunakan slash commands
- Support untuk multiple servers (future)

---

**Ready untuk implementasi?** 🚀

