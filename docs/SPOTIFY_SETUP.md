# Spotify API Setup Guide 🎵

Panduan setup Spotify API untuk bot satpam.

## 📋 Prerequisites

### 1. Install Dependencies

```bash
pip install spotipy
```

Atau uncomment di `requirements.txt`:
```txt
spotipy>=2.23.0
```

## 🔑 Setup Spotify API Credentials

### Step 1: Buat Spotify App

1. Pergi ke https://developer.spotify.com/dashboard
2. Login dengan Spotify account
3. Klik **"Create App"**
4. Isi form:
   - **App Name:** Satpam Bot (atau nama lain)
   - **App Description:** Discord bot music player
   - **Website:** (optional) URL website kamu
   - **Redirect URI:** `http://localhost:8888/callback` (untuk testing)
   - **What are you building?:** Desktop app
5. Klik **"Save"**

### Step 2: Get Client ID & Secret

1. Setelah app dibuat, klik pada app
2. Copy **Client ID**
3. Klik **"Show Client Secret"** dan copy **Client Secret**

### Step 3: Configure Bot

#### Option 1: config.json (Recommended)

Edit `config.json`:
```json
{
  "bot_tokens": [...],
  "spotify": {
    "client_id": "your_client_id_here",
    "client_secret": "your_client_secret_here"
  }
}
```

#### Option 2: Environment Variables

```bash
# Windows PowerShell
$env:SPOTIFY_CLIENT_ID="your_client_id_here"
$env:SPOTIFY_CLIENT_SECRET="your_client_secret_here"

# Windows CMD
set SPOTIFY_CLIENT_ID=your_client_id_here
set SPOTIFY_CLIENT_SECRET=your_client_secret_secret

# Linux/Mac
export SPOTIFY_CLIENT_ID="your_client_id_here"
export SPOTIFY_CLIENT_SECRET="your_client_secret_here"
```

## 🎯 Supported Spotify URLs

Bot mendukung berbagai jenis Spotify URLs:

### Track
```
https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
```

### Album
```
https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX
```
Bot akan play track pertama dari album.

### Playlist
```
https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
```
Bot akan play track pertama dari playlist.

### Artist
```
https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb
```
Bot akan play top track dari artist.

## 🎵 How It Works

1. User memberikan Spotify URL
2. Bot menggunakan Spotify API untuk get track info
3. Bot search YouTube dengan format: "Artist - Title"
4. Bot play dari YouTube (karena Discord tidak support Spotify streaming langsung)

## ⚠️ Important Notes

1. **Spotify API tidak bisa stream langsung ke Discord**
   - Bot akan convert Spotify track ke YouTube
   - Playback tetap dari YouTube

2. **Rate Limits**
   - Spotify API punya rate limits
   - Jika terlalu banyak request, mungkin akan error
   - Bot akan fallback ke YouTube search jika API error

3. **Credentials Security**
   - Jangan commit `config.json` dengan credentials ke Git
   - Gunakan `.gitignore` untuk protect credentials
   - Consider menggunakan environment variables untuk production

## 🛠️ Troubleshooting

### Error: "Spotify API not available"
- Pastikan `spotipy` sudah di-install: `pip install spotipy`
- Restart bot setelah install

### Error: "Invalid Spotify URL"
- Pastikan URL format benar
- Format: `https://open.spotify.com/track/TRACK_ID`

### Error: "Could not get Spotify track info"
- Cek apakah Client ID dan Secret benar
- Pastikan credentials sudah di-set di config.json atau environment variables
- Cek apakah Spotify app masih aktif di dashboard

### Error: "Rate limit exceeded"
- Terlalu banyak request ke Spotify API
- Tunggu beberapa saat dan coba lagi
- Consider upgrade Spotify API plan jika perlu

## 📊 Features

### Current Features
- ✅ Track playback (convert to YouTube)
- ✅ Album support (play first track)
- ✅ Playlist support (play first track)
- ✅ Artist support (play top track)
- ✅ Search Spotify tracks

### Future Enhancements
- 🔄 Queue all tracks from album/playlist
- 🔄 Better error handling
- 🔄 Caching Spotify metadata

## 🎯 Usage Examples

### Play Spotify Track
```
/play https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
satpam!play https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC
```

### Play from Album
```
/play https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX
```

### Play from Playlist
```
/play https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
```

---

**Setup selesai!** 🚀

