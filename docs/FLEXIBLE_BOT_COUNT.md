# Flexible Bot Count Support 🎯

Bot satpam mendukung jumlah bot yang fleksibel (1-5 bot), tidak harus 5 bot.

## 📋 Cara Kerja

### Jumlah Bot Fleksibel

Bot akan berjalan sesuai jumlah token yang valid di `config.json`:

- **1 token** → 1 bot aktif (Bot #1)
- **2 tokens** → 2 bot aktif (Bot #1, #2)
- **3 tokens** → 3 bot aktif (Bot #1, #2, #3)
- **4 tokens** → 4 bot aktif (Bot #1, #2, #3, #4)
- **5 tokens** → 5 bot aktif (Bot #1, #2, #3, #4, #5)

### Token Placeholder

Token yang kosong atau masih placeholder akan **diabaikan**:

```json
{
  "bot_tokens": [
    "token_bot_1_nyata",
    "token_bot_2_nyata",
    "token_bot_3_nyata",
    "token_bot_4_disini",  // Placeholder, akan diabaikan
    "token_bot_5_disini"    // Placeholder, akan diabaikan
  ]
}
```

Hasil: Hanya 3 bot yang akan aktif (Bot #1, #2, #3)

## ⚙️ Configuration Examples

### Example 1: Hanya 1 Bot

```json
{
  "bot_tokens": [
    "token_bot_1_nyata"
  ],
  "music_enabled_bot": 1
}
```

**Hasil:**
- 1 bot aktif (Bot #1)
- Bot #1 bisa play music
- Bisa jaga 1 voice channel

### Example 2: 3 Bot

```json
{
  "bot_tokens": [
    "token_bot_1_nyata",
    "token_bot_2_nyata",
    "token_bot_3_nyata"
  ],
  "music_enabled_bot": 1
}
```

**Hasil:**
- 3 bot aktif (Bot #1, #2, #3)
- Bot #1 bisa play music
- Bot #2, #3 hanya jaga voice
- Bisa jaga 3 voice channel bersamaan

### Example 3: 5 Bot (Full)

```json
{
  "bot_tokens": [
    "token_bot_1_nyata",
    "token_bot_2_nyata",
    "token_bot_3_nyata",
    "token_bot_4_nyata",
    "token_bot_5_nyata"
  ],
  "music_enabled_bot": 1
}
```

**Hasil:**
- 5 bot aktif (Bot #1, #2, #3, #4, #5)
- Bot #1 bisa play music
- Bot #2-5 hanya jaga voice
- Bisa jaga 5 voice channel bersamaan

## ⚠️ Important Notes

### Music Enabled Bot

Jika `music_enabled_bot` di-set ke nomor yang melebihi jumlah bot yang ada:

```json
{
  "bot_tokens": ["token1", "token2"],
  "music_enabled_bot": 3  // ❌ Error: Hanya ada 2 bot
}
```

**Hasil:** Music akan di-disable untuk semua bot (karena bot #3 tidak ada)

**Solusi:** Set `music_enabled_bot` sesuai jumlah bot yang ada:
```json
{
  "bot_tokens": ["token1", "token2"],
  "music_enabled_bot": 1  // ✅ OK: Bot #1 ada
}
```

### Validation

Startup checks akan memvalidasi:
- ✅ Minimal 1 token valid diperlukan
- ⚠️ Warning jika ada placeholder tokens
- ⚠️ Warning jika `music_enabled_bot` > jumlah bot

## 🎯 Use Cases

### Use Case 1: Testing dengan 1 Bot

Perfect untuk testing sebelum deploy full:
```json
{
  "bot_tokens": ["test_token_1"]
}
```

### Use Case 2: Budget Limited (3 Bot)

Jika budget terbatas, cukup 3 bot:
```json
{
  "bot_tokens": ["token1", "token2", "token3"]
}
```

### Use Case 3: Full Production (5 Bot)

Untuk production dengan traffic tinggi:
```json
{
  "bot_tokens": ["token1", "token2", "token3", "token4", "token5"]
}
```

## 📊 Resource Usage

### 1 Bot
- RAM: ~100-150MB
- CPU: 1-5% (idle)

### 3 Bot
- RAM: ~300-450MB
- CPU: 3-15% (idle)

### 5 Bot
- RAM: ~500-750MB
- CPU: 5-25% (idle)

## ✅ Benefits

1. **Fleksibel** - Sesuaikan dengan kebutuhan
2. **Scalable** - Bisa tambah bot kapan saja
3. **Cost Effective** - Tidak perlu 5 bot jika tidak perlu
4. **Easy Testing** - Test dengan 1 bot dulu

---

**Bot akan otomatis detect dan berjalan sesuai jumlah token yang valid!** 🚀

