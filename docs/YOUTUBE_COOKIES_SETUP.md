# YouTube Cookies Setup Guide 🍪

Panduan untuk setup YouTube cookies untuk menghindari bot detection.

## 📋 Kenapa Butuh Cookies?

YouTube menggunakan sistem deteksi bot yang ketat. Dengan menggunakan cookies dari akun YouTube yang sudah login, bot akan terlihat seperti user yang sedang browsing YouTube, sehingga menghindari error "Sign in to confirm you're not a bot".

## 🔧 Cara Mendapatkan Cookies YouTube

### Method 1: Menggunakan Browser Extension (Termudah)

1. **Install Extension "Get cookies.txt LOCALLY"** (Chrome/Edge)
   - Chrome: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   - Edge: https://microsoftedge.microsoft.com/addons/detail/get-cookiestxt-locally/fkakdljbcgnhhojkjdkfnjhggalhkdcl

2. **Login ke YouTube** di browser dengan akun Google/YouTube Anda

3. **Export Cookies:**
   - Klik icon extension di toolbar
   - Pastikan "youtube.com" terpilih
   - Klik "Export" atau "Download"
   - Simpan file sebagai `cookies.txt` di folder project bot

### Method 2: Menggunakan yt-dlp (Command Line)

1. **Install yt-dlp:**
   ```bash
   pip install yt-dlp
   ```

2. **Login dan export cookies:**
   ```bash
   yt-dlp --cookies-from-browser chrome -o cookies.txt --skip-download "https://www.youtube.com"
   ```
   
   Atau untuk Firefox:
   ```bash
   yt-dlp --cookies-from-browser firefox -o cookies.txt --skip-download "https://www.youtube.com"
   ```

3. **File `cookies.txt` akan dibuat** di current directory

### Method 3: Manual Export dari Browser

1. **Chrome/Edge:**
   - Login ke YouTube
   - Tekan `F12` untuk buka DevTools
   - Pergi ke tab **Application** > **Cookies** > `https://www.youtube.com`
   - Export cookies (gunakan extension atau manual copy)

2. **Firefox:**
   - Install extension "cookies.txt" (https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
   - Login ke YouTube
   - Klik icon extension > Export untuk youtube.com
   - Simpan sebagai `cookies.txt`

## ⚙️ Setup di Bot

1. **Tambahkan cookies.txt ke project root:**
   ```
   satpam/
   ├── cookies.txt  ← Letakkan di sini
   ├── config.json
   ├── index.js
   └── ...
   ```

2. **Update config.json:**
   ```json
   {
     "youtube_cookies_path": "cookies.txt"
   }
   ```
   
   Atau jika cookies ada di lokasi lain:
   ```json
   {
     "youtube_cookies_path": "/path/to/your/cookies.txt"
   }
   ```

3. **Restart bot:**
   ```bash
   node index.js
   ```

4. **Cek log:**
   - Jika berhasil, akan muncul: `✅ YouTube cookies file ditemukan: cookies.txt`
   - Jika tidak ada, akan muncul: `⚠️  YouTube cookies file tidak ditemukan.`

## 🔒 Security Notes

⚠️ **PENTING:**
- File `cookies.txt` berisi session cookies yang bisa digunakan untuk akses akun YouTube Anda
- **JANGAN** commit file `cookies.txt` ke Git
- File `cookies.txt` sudah otomatis di-ignore di `.gitignore`
- Jangan share cookies.txt dengan siapa pun
- Jika cookies bocor, segera logout dan ganti password akun Google/YouTube

## 🔄 Update Cookies

Cookies YouTube memiliki expiration time. Jika bot mulai error lagi dengan "Sign in to confirm", kemungkinan cookies sudah expired:

1. **Re-export cookies** menggunakan salah satu method di atas
2. **Replace file cookies.txt** dengan yang baru
3. **Restart bot**

## 🛠️ Troubleshooting

### Error: "Cookies file not found"
- Pastikan path di `config.json` benar
- Pastikan file `cookies.txt` ada di lokasi yang dimaksud
- Check permissions file (harus bisa dibaca)
- Cek apakah file benar-benar bernama `cookies.txt` (case-sensitive di Linux)

### Error: "Invalid cookies format"
- Pastikan cookies dalam format Netscape (standard cookies.txt format)
- Pastikan cookies masih valid (belum expired)
- Re-export cookies jika perlu

### Masih Error "Sign in to confirm"

**Penyebab umum dan solusi:**

1. **Cookies sudah expired atau invalid**
   - Cookies YouTube biasanya expire setelah beberapa hari
   - **Solusi:** Re-export cookies dari browser yang baru saja login ke YouTube
   - Pastikan saat export, Anda benar-benar login (lihat profile di pojok kanan atas YouTube)

2. **Cookies tidak lengkap**
   - Pastikan cookies file berisi minimal: `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `LOGIN_INFO`, `__Secure-3PSID`
   - **Solusi:** Export ulang cookies dan pastikan extension mengexport semua cookies YouTube

3. **Cookies dari browser yang tidak login**
   - Jika Anda export cookies tanpa login, cookies tidak akan berfungsi
   - **Solusi:** Pastikan login ke YouTube dulu sebelum export cookies

4. **IP address terdeteksi sebagai bot**
   - YouTube mungkin memblokir IP server Anda
   - **Solusi:** 
     - Tunggu beberapa jam dan coba lagi
     - Gunakan VPN atau proxy (jika memungkinkan)
     - Restart router untuk mendapatkan IP baru (jika dynamic IP)

5. **yt-dlp perlu update**
   - yt-dlp perlu update secara berkala untuk mengatasi perubahan YouTube
   - **Solusi:** Update yt-dlp di server:
     ```bash
     pip install --upgrade yt-dlp
     ```

6. **Cookies dari akun yang sudah diblokir**
   - Jika akun YouTube Anda sering melakukan scraping, mungkin sudah diblokir
   - **Solusi:** Gunakan akun YouTube berbeda (tidak disarankan untuk production)

### Tips Tambahan:

- **Gunakan akun YouTube yang "bersih"** (tidak pernah digunakan untuk bot/scraping sebelumnya)
- **Export cookies saat browsing normal** YouTube (buka beberapa video, scroll, dll) untuk membuat cookies lebih "natural"
- **Update cookies secara berkala** (setiap 1-2 minggu) untuk menghindari expiration
- **Jangan share cookies** antara multiple bots/instances di IP yang sama (akan terdeteksi sebagai spam)

## 📝 Format Cookies File

File `cookies.txt` harus dalam format Netscape:

```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	FALSE	1735689600	SID	your_session_id_here
.youtube.com	TRUE	/	FALSE	1735689600	SSID	your_ssid_here
.youtube.com	TRUE	/	FALSE	1735689600	APISID	your_apisid_here
...
```

## ✅ Verifikasi Setup

Setelah setup, test dengan:

```bash
# Test play music
satpam!play laufey - from the start
```

Jika berhasil tanpa error "Sign in to confirm", berarti cookies sudah bekerja dengan baik!

