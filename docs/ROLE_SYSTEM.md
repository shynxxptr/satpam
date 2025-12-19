# Role-Based Tier System 🎭

Sistem tier untuk bot satpam berdasarkan role dan server boost. Tidak perlu monetisasi, semua otomatis!

## Tier Categories

### 🆓 Free User (Default)
- **Durasi Stay:** 12 jam setelah user keluar
- **Cara Dapatkan:** Default untuk semua user
- **Tidak perlu:** Role atau boost apapun

### 🚀 Server Booster
- **Durasi Stay:** 36 jam setelah user keluar
- **Cara Dapatkan:** Boost server dengan Discord Nitro
- **Priority:** Tertinggi (jika boost, otomatis dapat tier ini)

### 💝 Donatur
- **Durasi Stay:** 48 jam (2 hari) setelah user keluar
- **Cara Dapatkan:** Memiliki role "Donatur" (atau nama role yang dikonfigurasi)
- **Priority:** Kedua (setelah booster)

### 👑 Server Loyalist
- **Durasi Stay:** 24 jam (1 hari) setelah user keluar
- **Cara Dapatkan:** Memiliki role "Server Loyalist" (atau nama role yang dikonfigurasi)
- **Priority:** Ketiga (setelah booster dan donatur)

## Priority System

Tier ditentukan berdasarkan priority (yang tertinggi akan dipilih):

1. **Server Booster** (highest) - Jika user boost server → 36 jam
2. **Donatur** - Jika user punya role donatur → 48 jam
3. **Server Loyalist** - Jika user punya role loyalist → 24 jam
4. **Free** (default) - Jika tidak ada yang di atas → 12 jam

**Contoh:**
- User boost server + punya role donatur → Dapat tier **Booster** (36 jam)
- User punya role donatur + role loyalist → Dapat tier **Donatur** (48 jam)
- User hanya punya role loyalist → Dapat tier **Loyalist** (24 jam)

## Setup Role Names & IDs

Bot mendeteksi role berdasarkan **Role ID** (prioritas) atau **Role Name** (fallback).

### Default Role IDs (Sudah di-set):
- **Donatur:** `1450281880233447467`
- **Server Loyalist:** `1451645134700544262`

### Konfigurasi (Opsional)

Edit file `config.json` untuk mengatur role names atau IDs tambahan:

```json
{
  "bot_tokens": [...],
  "role_names": {
    "donatur": [
      "Donatur",
      "donatur",
      "DONATUR",
      "Donator",
      "donator"
    ],
    "loyalist": [
      "Server Loyalist",
      "Loyalist",
      "loyalist",
      "LOYALIST",
      "Server Loyal",
      "Loyal"
    ]
  },
  "role_ids": {
    "donatur": [1450281880233447467],
    "loyalist": [1451645134700544262]
  }
}
```

**Tips:**
- **Role ID** lebih reliable karena tidak berubah meskipun nama role diubah
- **Role Name** sebagai fallback jika role ID tidak match
- Bot akan cek role ID dulu, baru cek role name
- Bisa tambahkan multiple role IDs atau names untuk fleksibilitas

## Cara Kerja

1. User memanggil bot dengan `/panggil`
2. Bot cek tier user berdasarkan:
   - Apakah user boost server? → Booster
   - Apakah user punya role loyalist? → Loyalist
   - Apakah user punya role donatur? → Donatur
   - Default → Free
3. Bot join dengan durasi stay sesuai tier
4. Bot stay selama durasi tersebut setelah user keluar

## Commands

### `/tier`
Lihat tier kamu saat ini dan bagaimana cara mendapatkannya.

### `/tiers`
Lihat semua tier categories yang tersedia beserta requirement-nya.

## Setup Role di Discord

### Untuk Donatur:
1. Buat role baru di Discord Server Settings > Roles
2. Beri nama "Donatur" (atau nama lain yang sesuai)
3. Beri role ini ke user yang donasi
4. Tambahkan nama role ke `config.json` jika berbeda

### Untuk Server Loyalist:
1. Buat role baru di Discord Server Settings > Roles
2. Beri nama "Server Loyalist" (atau nama lain yang sesuai)
3. Beri role ini ke member loyal/aktif
4. Tambahkan nama role ke `config.json` jika berbeda

## Tips

- **Server Booster:** Otomatis terdeteksi oleh Discord, tidak perlu setup role
- **Role Matching:** Bot cek nama role (case-sensitive), pastikan nama role sesuai dengan config
- **Multiple Roles:** Jika user punya beberapa role yang qualify, priority tertinggi yang dipilih
- **Testing:** Gunakan `/tier` untuk cek tier user sebelum memanggil bot

## FAQ

**Q: User boost server tapi tidak dapat tier booster?**
A: Pastikan user benar-benar boost server (cek di Server Settings > Server Boost). Bot otomatis detect `premium_since`.

**Q: User punya role tapi tidak terdeteksi?**
A: 
- Bot cek role ID dulu (default sudah di-set)
- Jika role ID tidak match, bot cek role name
- Pastikan role ID atau role name ada di config.json
- Role ID lebih reliable karena tidak berubah meskipun nama role diubah

**Q: Bisa ubah durasi stay?**
A: Ya, edit `TIER_CATEGORIES` di `subscription_manager.py`.

**Q: Bisa tambah tier baru?**
A: Ya, tambahkan di `TIER_CATEGORIES` dan update logic di `get_user_tier()`.

