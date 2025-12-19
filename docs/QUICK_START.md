# Quick Start Guide 🚀

Panduan cepat untuk mulai menggunakan bot satpam.

## ⚡ 5 Menit Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
pip install yt-dlp PyNaCl spotipy  # Untuk music features
```

### 2. Setup Config

```bash
cp config.json.example config.json
# Edit config.json dengan bot tokens kamu
```

### 3. Run Checks

```bash
python startup_check.py
```

Pastikan semua **PASS** ✅

### 4. Run Bot

```bash
python run_multi.py
```

## 📋 Checklist

- [ ] Python 3.8+ terinstall
- [ ] Dependencies terinstall (`pip install -r requirements.txt`)
- [ ] FFmpeg terinstall (untuk music)
- [ ] Config.json sudah di-set dengan bot tokens
- [ ] Bot sudah di-invite ke server dengan permissions:
  - ✅ Connect
  - ✅ Speak
  - ✅ Use Slash Commands
- [ ] Startup checks semua PASS

## 🎯 First Commands

Setelah bot online, coba:

```
/panggil          # Panggil bot jaga voice channel
/status           # Lihat status bot
/tier             # Lihat tier kamu
```

## 🎵 Music (Optional)

Jika mau pakai music features:

1. Install: `pip install yt-dlp PyNaCl`
2. Setup Spotify (optional): Lihat `SPOTIFY_SETUP.md`
3. Test: `/play never gonna give you up`

## 🚀 Deploy ke VPS

Lihat `DEPLOYMENT_GUIDE.md` untuk panduan lengkap.

---

**Ready to go!** 🎉

