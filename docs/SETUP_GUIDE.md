# Setup Guide - Multiple Bot Accounts 🛡️

Panduan lengkap untuk setup 5 bot satpam terpisah yang bisa jaga 5 channel bersamaan.

## Step 1: Buat 5 Bot di Discord Developer Portal

1. Pergi ke https://discord.com/developers/applications
2. Untuk setiap bot (Bot #1 sampai Bot #5):
   - Klik **"New Application"**
   - Beri nama (contoh: "Satpam Bot 1", "Satpam Bot 2", dst)
   - Pergi ke tab **"Bot"**
   - Klik **"Add Bot"** dan konfirmasi
   - **Copy bot token** (simpan dengan aman!)
   - Enable **Privileged Gateway Intents**:
     - ✅ Presence Intent
     - ✅ Server Members Intent
     - ✅ Message Content Intent
   - Pergi ke tab **"OAuth2"** > **"URL Generator"**
   - Pilih scopes: `bot` dan `applications.commands`
   - Pilih bot permissions:
     - ✅ Connect
     - ✅ Speak
     - ✅ Use Voice Activity
     - ✅ View Channels
     - ✅ Send Messages
   - **Copy URL** dan buka di browser untuk invite bot ke server
   - **Ulangi untuk semua 5 bot!**

## Step 2: Setup Config File

1. Copy `config.json.example` ke `config.json`:
```bash
cp config.json.example config.json
```

2. Edit `config.json` dan masukkan bot tokens (bisa 1-5 bot):
```json
{
  "bot_tokens": [
    "token_bot_1_disini",
    "token_bot_2_disini",
    "token_bot_3_disini"
  ]
}
```

**Note:** 
- Bisa isi 1-5 bot tokens sesuai kebutuhan
- Token yang kosong atau masih placeholder akan diabaikan
- Bot akan berjalan sesuai jumlah token yang valid
- Contoh: Jika hanya isi 3 token, maka hanya 3 bot yang aktif

**⚠️ PENTING:** Jangan share file `config.json` ke public! File ini sudah di-ignore di `.gitignore`.

## Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 4: Run Multiple Bots

```bash
python run_multi.py
```

Atau:

```bash
python bot_multi.py
```

Kamu akan melihat output seperti ini:
```
==================================================
🛡️  SATPAM BOT - MULTIPLE INSTANCES
==================================================

🚀 Starting 5 Satpam Bot(s)...
--------------------------------------------------
🛡️  Satpam Bot #1 (BotName#1234) telah online!
   Synced 3 command(s)
🛡️  Satpam Bot #2 (BotName#5678) telah online!
   Synced 3 command(s)
...
```

## Step 5: Test Bot

1. Join ke voice channel di Discord
2. Ketik `/panggil` (tanpa parameter channel, bot akan join ke channel kamu)
3. Bot akan join dan menjaga channel kamu
4. Coba di channel lain dengan bot yang berbeda!

## Troubleshooting

### Bot tidak muncul di server
- Pastikan semua 5 bot sudah di-invite ke server
- Cek apakah URL invite sudah benar (harus include `applications.commands` scope)

### Command tidak muncul
- Tunggu beberapa menit untuk command sync
- Pastikan semua bot sudah online
- Coba restart bot

### Bot tidak bisa join voice channel
- Pastikan bot punya permission "Connect" dan "Speak"
- Pastikan channel tidak full
- Cek apakah bot sudah di-invite dengan permission yang benar

### Error "Tidak ada bot token yang ditemukan"
- Pastikan file `config.json` ada dan formatnya benar
- Atau set environment variables `DISCORD_BOT_TOKEN_1` sampai `DISCORD_BOT_TOKEN_5`

## Tips

- **Naming:** Beri nama yang jelas untuk setiap bot di Developer Portal (contoh: "Satpam #1", "Satpam #2")
- **Avatar:** Bisa set avatar berbeda untuk setiap bot agar mudah dibedakan
- **Monitoring:** Gunakan `screen` atau `tmux` (Linux) atau PowerShell background job (Windows) untuk run bot di background

## Perbedaan dengan Single Bot Mode

| Fitur | Single Bot (`bot.py`) | Multiple Bots (`bot_multi.py`) |
|-------|----------------------|-------------------------------|
| Bot Accounts | 1 | 5 |
| Bisa jaga 5 channel bersamaan? | ❌ Tidak | ✅ Ya |
| Setup | Mudah (1 token) | Lebih kompleks (5 tokens) |
| Resource Usage | Rendah | Lebih tinggi |
| Recommended untuk | Testing, penggunaan ringan | Production, butuh multiple channel |

