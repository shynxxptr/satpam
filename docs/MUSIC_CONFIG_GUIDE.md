# Music Configuration Guide 🎵

Panduan konfigurasi untuk setup 1 bot music + 4 bot jaga voice.

## 🎯 Setup: 1 Bot Music + 4 Bot Jaga Voice

### Konfigurasi

Edit `config.json`:
```json
{
  "bot_tokens": [
    "token_bot_1",
    "token_bot_2",
    "token_bot_3",
    "token_bot_4",
    "token_bot_5"
  ],
  "music_enabled_bot": 1
}
```

### Behavior

#### Bot #1 (Music Enabled)
- ✅ Bisa play music (`/play`, `/stop`, `/pause`, `/resume`)
- ✅ Bisa jaga voice channel (`/panggil`, `/pulang`)
- ✅ Bisa semua fitur satpam

#### Bot #2, #3, #4, #5 (Music Disabled)
- ❌ **TIDAK bisa** play music
- ✅ Bisa jaga voice channel (`/panggil`, `/pulang`)
- ✅ Bisa semua fitur satpam lainnya
- ℹ️ Jika coba `/play` → Error: "Hanya Bot #1 yang bisa play music"

## 📊 Resource Distribution

### Bot #1 (Music + Satpam)
- **RAM:** ~200-300MB (saat play music)
- **CPU:** 20-40% (saat play music)
- **Fungsi:** Music player + Voice guard

### Bot #2-5 (Satpam Only)
- **RAM:** ~100-150MB per bot
- **CPU:** 1-5% (idle)
- **Fungsi:** Voice guard only

### Total Resource
- **RAM:** ~600-800MB (semua bot aktif)
- **CPU:** 25-50% (jika music aktif)
- **Status:** ✅ **AMAN untuk 1GB RAM**

## 🎵 Usage Examples

### Scenario 1: User mau play music
```
User: /play never gonna give you up
Bot #1: ✅ Music dimulai!
Bot #2-5: ❌ "Hanya Bot #1 yang bisa play music"
```

### Scenario 2: User mau jaga voice
```
User: /panggil
Bot #1: ✅ Bisa (jika tidak sedang play music)
Bot #2: ✅ Bisa
Bot #3: ✅ Bisa
Bot #4: ✅ Bisa
Bot #5: ✅ Bisa
```

### Scenario 3: Bot #1 sedang play music + jaga voice
```
Bot #1: 
  - Sedang play music di Channel A
  - Bisa jaga voice di Channel B (pindah dari Channel A)
  - Music tetap play di Channel A (voice client berbeda)
```

## ⚠️ Important Notes

1. **Bot #1 bisa multi-task:**
   - Play music di 1 channel
   - Jaga voice di channel lain (akan disconnect dari music channel)

2. **Bot #2-5 hanya jaga voice:**
   - Tidak bisa play music
   - Tetap bisa semua fitur satpam lainnya

3. **Global Lock tetap aktif:**
   - Hanya 1 music stream aktif (Bot #1)
   - Bot #2-5 tidak bisa bypass dengan play music

## 🔧 Change Music Bot

Untuk ganti bot yang bisa music, edit `config.json`:
```json
{
  "music_enabled_bot": 2  // Ganti ke Bot #2
}
```

Atau set environment variable:
```bash
MUSIC_ENABLED_BOT=2
```

## 📝 Commands Summary

### Bot #1 (Music Enabled)
- `/play` ✅
- `/stop` ✅
- `/pause` ✅
- `/resume` ✅
- `/radio_status` ✅
- `/panggil` ✅
- `/pulang` ✅
- Semua commands satpam ✅

### Bot #2-5 (Music Disabled)
- `/play` ❌ (Error message)
- `/stop` ❌ (Error message)
- `/pause` ❌ (Error message)
- `/resume` ❌ (Error message)
- `/radio_status` ✅ (Show info)
- `/panggil` ✅
- `/pulang` ✅
- Semua commands satpam ✅

---

**Setup selesai!** 🚀

