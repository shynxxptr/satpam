# Music Feature Setup Guide 🎵

Panduan setup fitur music untuk bot satpam dengan global lock (hanya 1 stream aktif).

## 🎯 Configuration: 1 Bot Music + 4 Bot Jaga Voice

Sistem dikonfigurasi agar:
- **1 bot** (Bot #1) bisa play music **+ jaga voice**
- **4 bot lainnya** (Bot #2, #3, #4, #5) hanya **jaga voice** (tidak bisa music)

## ⚙️ Configuration

### Set Music Bot

Edit `config.json`:
```json
{
  "bot_tokens": [...],
  "music_enabled_bot": 1
}
```

**Penjelasan:**
- `music_enabled_bot: 1` → Hanya Bot #1 yang bisa play music
- Bot #2, #3, #4, #5 → Hanya bisa jaga voice (tidak bisa music)
- Jika tidak di-set → Semua bot bisa music (default)

**Behavior:**
- Bot #1: Bisa `/play`, `/stop`, `/pause`, `/resume` + bisa `/panggil` untuk jaga voice
- Bot #2-5: Bisa `/panggil` untuk jaga voice, tapi `/play` akan error dengan pesan "Hanya Bot #1 yang bisa play music"

## 📋 Prerequisites

### 1. Install Dependencies

```bash
pip install yt-dlp PyNaCl spotipy
```

Atau uncomment di `requirements.txt`:
```txt
yt-dlp>=2023.12.30
PyNaCl>=1.5.0
spotipy>=2.23.0  # For Spotify API support
```

### Spotify API Setup (Optional)

Untuk support Spotify URLs, setup Spotify API credentials:

1. Buat app di https://developer.spotify.com/dashboard
2. Get Client ID & Secret
3. Tambahkan ke `config.json`:
```json
{
  "spotify": {
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }
}
```

Lihat [SPOTIFY_SETUP.md](SPOTIFY_SETUP.md) untuk setup lengkap.

### 2. Install FFmpeg

**Windows:**
```bash
# Download dari https://ffmpeg.org/download.html
# Extract dan add ke PATH
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Alibaba Cloud (CentOS/Alibaba Linux):**
```bash
sudo yum install epel-release
sudo yum install ffmpeg
# atau
sudo dnf install ffmpeg
```

## 🎯 Fitur

### Global Lock System
- ✅ **Hanya 1 music stream aktif** pada satu waktu
- ✅ Jika bot A sedang play music, bot B, C, D, E **tidak bisa** play music
- ✅ Notifikasi "Radio sedang digunakan" jika ada yang coba play

### Supported Sources
- ✅ **YouTube** (direct URL atau search)
- ✅ **Spotify** (via Spotify API, convert to YouTube)

### Commands
- `/play <url/query>` - Play music dari YouTube atau search
- `/stop` - Stop music (hanya yang request atau admin)
- `/pause` - Pause music
- `/resume` - Resume music
- `/radio_status` - Lihat status radio

## 🎵 Usage Examples

### Play dari YouTube URL
```
/play https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Search YouTube
```
/play never gonna give you up
```

### Spotify (via search)
```
/play spotify:track:4uLU6hMCjMI75M1A2tKUQC
# Bot akan minta user untuk search manual atau pakai YouTube
```

## ⚙️ Configuration

### Audio Quality (Lightweight)
- **Bitrate:** 64kbps (hemat resource)
- **Format:** Opus
- **Optimized untuk:** 1GB RAM server

### Auto-Disconnect
- Music stop → Tunggu 30 detik → Auto disconnect
- Bot kembali ke idle channel jika tersedia

## 🔒 Global Lock Behavior

### Scenario 1: Bot #1 sedang play music
- User coba `/play` di Bot #2 → ❌ "Radio sedang digunakan oleh Bot #1"
- User coba `/play` di Bot #3 → ❌ "Radio sedang digunakan oleh Bot #1"
- Bot #1 stop → ✅ Radio tersedia lagi

### Scenario 2: Bot #1 stop music
- Radio unlocked
- Bot #2 bisa play music sekarang
- Bot #3, #4, #5 juga bisa (first come first served)

## 📊 Resource Usage

### Normal (No Music)
- RAM: ~300-400MB (5 bots)
- CPU: 1-5%

### With 1 Music Stream
- RAM: ~500-600MB
- CPU: 20-40%
- Network: ~64kbps

### Safe Limits
- ✅ 1 music stream = **AMAN**
- ⚠️ 2+ music streams = **OVERLOAD** (tidak mungkin karena global lock)

## 🛠️ Troubleshooting

### Error: "yt-dlp not found"
```bash
pip install yt-dlp
```

### Error: "FFmpeg not found"
```bash
# Install FFmpeg (lihat Prerequisites)
```

### Error: "Radio sedang digunakan"
- Normal behavior - hanya 1 stream aktif
- Tunggu sampai music selesai atau minta bot yang sedang play untuk stop

### Music laggy/choppy
- Cek network bandwidth
- Cek CPU usage (mungkin overload)
- Consider upgrade server

## 🎯 Best Practices

1. **Monitor resources** - Gunakan `/radio_status` untuk cek siapa yang pakai
2. **Stop music setelah selesai** - Jangan biarkan idle terlalu lama
3. **Use lower quality** - 64kbps sudah cukup untuk voice channel
4. **Limit queue** - Jangan queue terlalu banyak lagu

## 📝 Notes

- Spotify direct playback **belum didukung** (perlu Spotify API)
- Untuk Spotify, gunakan YouTube search dengan nama lagu
- Global lock memastikan hanya 1 stream aktif (hemat resource)
- Auto-disconnect setelah 30 detik idle

---

**Ready to use!** 🚀

