# Discord Bot Satpam 🛡️

Bot Discord untuk menjaga voice channel. Ada 2 mode: **Single Bot** (virtual tracking) atau **Multiple Bot Accounts** (5 bot fisik terpisah).

## ⚠️ PENTING: Pilih Mode yang Sesuai

### Mode 1: Single Bot (`bot.py`) - Virtual Tracking
- ✅ **1 bot account** saja yang dibutuhkan
- ✅ Sistem virtual tracking (Bot #1-#5) tapi **hanya bisa jaga 1 channel pada 1 waktu**
- ✅ Lebih mudah setup (hanya perlu 1 token)
- ❌ **TIDAK BISA** join ke 5 channel berbeda bersamaan

### Mode 2: Multiple Bots (`bot_multi.py`) - Multiple Bot Accounts
- ✅ **5 bot accounts** terpisah (benar-benar 5 bot berbeda)
- ✅ **BISA** join ke 5 channel berbeda **bersamaan**
- ✅ Setiap bot punya identity sendiri (Satpam Bot #1, #2, #3, #4, #5)
- ❌ Perlu setup 5 bot di Discord Developer Portal

**Rekomendasi:** Jika kamu mau benar-benar bisa jaga 5 channel bersamaan, pakai **Mode 2** (`bot_multi.py`).

## Fitur

- ✅ **1 Bot per Voice Channel**: Sistem memastikan maksimal 1 bot per voice channel
- ✅ **Easy Commands**: Command sederhana untuk memanggil dan memulangkan bot
- ✅ **Timer System**: Bot stay beberapa jam setelah user keluar (sesuai tier)
- ✅ **Role-Based Tiers**: 4 tier categories (Free, Booster, Donatur, Loyalist) dengan durasi stay berbeda
- ✅ **Auto Detection**: Otomatis detect tier berdasarkan server boost dan role
- ✅ **Idle Channel**: Bot otomatis stay di idle channel ketika tidak digunakan
- ✅ **Status Tracking**: Lihat status semua bot satpam
- ✅ **Music Player**: Play music dari YouTube/Spotify dengan global lock (hanya 1 stream aktif)

## Setup

### 0. Run Startup Checks (Recommended)

Sebelum menjalankan bot, jalankan startup checks untuk memastikan semua siap:

```bash
python startup_check.py
```

Ini akan check:
- ✅ Dependencies terinstall
- ✅ Config file valid
- ✅ Directories ready
- ✅ Permissions OK

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Setup Bot Token

1. Buat file `.env` dari `.env.example`:
```bash
cp .env.example .env
```

2. Edit file `.env` dan masukkan bot token kamu:
```
DISCORD_BOT_TOKEN=your_actual_bot_token_here
```

Atau set environment variable:
```bash
# Windows PowerShell
$env:DISCORD_BOT_TOKEN="your_bot_token_here"

# Windows CMD
set DISCORD_BOT_TOKEN=your_bot_token_here

# Linux/Mac
export DISCORD_BOT_TOKEN=your_bot_token_here
```

### 3. Buat Bot di Discord Developer Portal

1. Pergi ke https://discord.com/developers/applications
2. Klik "New Application" dan beri nama
3. Pergi ke tab "Bot"
4. Klik "Add Bot" dan konfirmasi
5. Copy bot token dan paste ke `.env` atau environment variable
6. Enable **Privileged Gateway Intents**:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
7. Pergi ke tab "OAuth2" > "URL Generator"
8. Pilih scopes: `bot` dan `applications.commands`
9. Pilih bot permissions:
   - ✅ Connect
   - ✅ Speak
   - ✅ Use Voice Activity
   - ✅ View Channels
   - ✅ Send Messages
10. Copy URL dan buka di browser untuk invite bot ke server

### 5. Run Bot

**Pilih salah satu:**

#### Mode 1: Single Bot (Virtual Tracking)
```bash
python bot.py
```

#### Mode 2: Multiple Bot Accounts (5 Bot Terpisah)
1. Buat file `config.json` dari `config.json.example`:
```bash
cp config.json.example config.json
```

2. Edit `config.json` dan masukkan 5 bot tokens:
```json
{
  "bot_tokens": [
    "token_bot_1_kamu",
    "token_bot_2_kamu",
    "token_bot_3_kamu",
    "token_bot_4_kamu",
    "token_bot_5_kamu"
  ]
}
```

3. Atau set environment variables:
```bash
# Windows PowerShell
$env:DISCORD_BOT_TOKEN_1="token1"
$env:DISCORD_BOT_TOKEN_2="token2"
$env:DISCORD_BOT_TOKEN_3="token3"
$env:DISCORD_BOT_TOKEN_4="token4"
$env:DISCORD_BOT_TOKEN_5="token5"
```

4. Run multiple bots:
```bash
python run_multi.py
# atau
python bot_multi.py
```

**Catatan:** Untuk Mode 2, kamu perlu:
- Buat 5 aplikasi berbeda di Discord Developer Portal
- Setiap aplikasi punya bot token sendiri
- Invite semua 5 bot ke server kamu

### 5. Setup Idle Channel (Opsional)

Bot akan otomatis stay di idle channel ketika tidak digunakan. Tambahkan di `config.json`:

```json
{
  "bot_tokens": [...],
  "idle_voice_channel_id": 1451645891600453652
}
```

Atau set environment variable:
```bash
IDLE_VOICE_CHANNEL_ID=1451645891600453652
```

**Cara Kerja:**
- Bot otomatis join ke idle channel saat start
- Ketika bot selesai menjaga channel (disconnect), bot akan kembali ke idle channel
- Bot tetap stay di idle channel sampai dipanggil lagi

## Commands

### `/panggil [channel]`
Memanggil bot satpam untuk menjaga voice channel. Jika channel tidak disebutkan, bot akan join ke channel kamu sekarang.

**Contoh:**
- `/panggil` - Panggil bot ke channel kamu sekarang
- `/panggil #general-voice` - Panggil bot ke channel tertentu

### `/pulang [channel]`
Menyuruh bot satpam pulang dari voice channel.

**Contoh:**
- `/pulang` - Suruh bot pulang dari channel kamu
- `/pulang #general-voice` - Suruh bot pulang dari channel tertentu

### `/status`
Melihat status semua bot satpam (yang aktif dan tersedia).

### `/pulang_semua`
Menyuruh semua bot satpam pulang. **Hanya untuk Admin!**

## Cara Kerja

### Mode 1: Single Bot (Virtual Tracking)
1. Bot menggunakan sistem virtual "satpam bot" (Bot #1 sampai Bot #5)
2. Ketika member memanggil bot dengan `/panggil`, sistem akan:
   - Cek apakah channel sudah dijaga
   - Cari bot satpam yang tersedia
   - Assign bot ke channel tersebut
   - Bot join ke voice channel
3. **LIMITASI:** Bot hanya bisa join 1 channel pada 1 waktu
4. Sistem memastikan hanya 1 bot per voice channel
5. Bot otomatis pulang jika channel kosong (hanya bot yang tersisa)

### Mode 2: Multiple Bot Accounts
1. Setiap bot account (Bot #1 sampai Bot #5) adalah bot fisik terpisah
2. Ketika member memanggil bot dengan `/panggil`, bot yang dipanggil akan:
   - Cek apakah channel sudah dijaga bot lain
   - Jika channel kosong, bot join ke channel tersebut
   - Jika bot sedang di channel lain, bot akan pindah
3. **KEUNTUNGAN:** 5 bot bisa join ke 5 channel berbeda **bersamaan**
4. Sistem memastikan hanya 1 bot per voice channel
5. Bot otomatis pulang jika channel kosong (hanya bot yang tersisa)

## Konfigurasi

Edit `MAX_SATPAM_BOTS` di `bot.py` untuk mengubah jumlah maksimal bot:

```python
MAX_SATPAM_BOTS = 5  # Ubah angka ini
```

## Troubleshooting

### Bot tidak bisa join voice channel
- Pastikan bot punya permission "Connect" dan "Speak" di channel
- Pastikan bot tidak sedang di voice channel lain

### Command tidak muncul
- Pastikan bot sudah di-invite dengan scope `applications.commands`
- Tunggu beberapa menit untuk command sync
- Coba restart bot

### Bot tidak auto disconnect
- Bot akan stay sesuai durasi subscription tier setelah user keluar
- Timer akan dibatalkan jika ada user lain join channel
- Bot akan otomatis disconnect setelah waktu stay habis

## Tier System 🎭

Bot menggunakan sistem tier berbasis role dan server boost (tidak perlu monetisasi):

- **🆓 Free User:** 12 jam stay (Default untuk semua user)
- **🚀 Server Booster:** 36 jam stay (Discord Server Boost)
- **💝 Donatur:** 48 jam (2 hari) stay (Role Donatur)
- **👑 Server Loyalist:** 24 jam (1 hari) stay (Role Server Loyalist)

Lihat [ROLE_SYSTEM.md](ROLE_SYSTEM.md) untuk panduan lengkap tentang sistem tier.

### Commands Tier

**Slash Commands:**
- `/tier` - Lihat tier kamu saat ini
- `/tiers` - Lihat semua tier categories yang tersedia

**Prefix Commands:**
- `satpam!tier` - Lihat tier kamu
- `satpam!tiers` - Lihat semua tier

## Music Feature 🎵

Bot dilengkapi dengan fitur music player dengan **global lock system** (hanya 1 music stream aktif pada satu waktu).

### Fitur Music

- ✅ **Global Lock**: Hanya 1 bot yang bisa play music pada satu waktu
- ✅ **YouTube Support**: Direct URL atau search
- ✅ **Spotify Support**: Via Spotify API (convert to YouTube)
- ✅ **Auto-Disconnect**: Auto disconnect setelah 30 detik idle
- ✅ **Lightweight**: 64kbps audio untuk hemat resource

### Commands Music

**Slash Commands:**
- `/play <url/query>` - Play music dari YouTube atau search
- `/stop` - Stop music (hanya yang request atau admin)
- `/pause` - Pause music
- `/resume` - Resume music
- `/radio_status` - Lihat status radio
- `/autoplay` - Enable/disable autoplay (otomatis play lagu terkait)

**Prefix Commands:**
- `satpam!play <url/query>` - Play music
- `satpam!stop` - Stop music
- `satpam!pause` - Pause music
- `satpam!resume` - Resume music
- `satpam!radio` - Lihat radio status
- `satpam!autoplay` - Enable/disable autoplay

### Global Lock Behavior

Jika **Bot #1** sedang play music:
- User coba `/play` di Bot #2 → ❌ "Hanya Bot #1 yang bisa play music"
- User coba `/play` di Bot #3 → ❌ "Hanya Bot #1 yang bisa play music"
- Bot #1 stop → ✅ Radio tersedia lagi

### Bot Distribution

**Konfigurasi Default:**
- **Bot #1:** Music + Jaga Voice (bisa play music dan jaga voice)
- **Bot #2-5:** Jaga Voice Only (hanya jaga voice, tidak bisa music)

**Setup di `config.json`:**
```json
{
  "music_enabled_bot": 1
}
```

Lihat [MUSIC_SETUP.md](MUSIC_SETUP.md) dan [MUSIC_CONFIG_GUIDE.md](MUSIC_CONFIG_GUIDE.md) untuk setup lengkap.

## Prefix Commands 💬

Semua bot mendukung prefix commands dengan prefix **`satpam!`**:

### Prefix yang Didukung
- `satpam!` - Universal prefix untuk semua bot
- `satpam#1!` - Prefix khusus untuk Bot #1
- `satpam#2!` - Prefix khusus untuk Bot #2
- `!` - Short prefix (default)

### Contoh Penggunaan
```
satpam!panggil          # Panggil bot jaga voice
satpam!pulang           # Suruh bot pulang
satpam!status           # Lihat status bot
satpam!tier             # Lihat tier kamu
satpam!play never gonna give you up  # Play music
satpam!help             # Lihat semua commands
```

### Semua Commands
Gunakan `satpam!help` untuk melihat semua commands yang tersedia!

## License

Free to use! 🎉

