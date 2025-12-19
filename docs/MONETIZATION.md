# Monetization Guide 💰

Panduan lengkap untuk sistem monetisasi bot satpam.

## Subscription Tiers

### Free Tier (Gratis)
- **Durasi Stay:** 12 jam setelah user keluar
- **Harga:** GRATIS
- **Cocok untuk:** Penggunaan casual, testing, atau gaming session singkat

### Basic Tier
- **Durasi Stay:** 24 jam (1 hari) setelah user keluar
- **Harga:** Rp 50.000
- **Cocok untuk:** Pengguna reguler yang butuh jaga channel sehari penuh

### Premium Tier
- **Durasi Stay:** 48 jam (2 hari) setelah user keluar
- **Harga:** Rp 100.000
- **Cocok untuk:** Pengguna aktif yang butuh jaga channel untuk event 2 hari

### VIP Tier
- **Durasi Stay:** 168 jam (1 minggu) setelah user keluar
- **Harga:** Rp 200.000
- **Cocok untuk:** Power users, streamers, atau event organizer yang butuh jaga channel seminggu penuh

## Cara Kerja Timer System

1. User memanggil bot dengan `/panggil`
2. Bot join ke voice channel
3. Bot akan stay selama durasi sesuai tier user
4. **Saat user keluar dari voice:**
   - Bot tetap stay di channel
   - Timer mulai berjalan
   - Bot akan otomatis disconnect setelah waktu habis
5. **Jika ada user lain join:**
   - Timer dibatalkan
   - Bot tetap stay (tidak akan disconnect otomatis)

## Durasi Stay

Durasi stay yang sudah dikonfigurasi:

- **12 jam (Free):** Cukup untuk gaming session atau penggunaan casual sehari
- **24 jam (Basic):** Ideal untuk jaga channel sehari penuh
- **48 jam (Premium):** Cocok untuk event 2 hari atau streaming marathon
- **168 jam (VIP):** Perfect untuk event seminggu atau 24/7 presence

**Value Proposition:** Free tier sudah cukup generous dengan 12 jam, membuat user tertarik untuk upgrade ke tier berbayar untuk durasi lebih lama.

## Setup Payment System

### Opsi 1: Manual Payment (Sederhana)
1. User transfer via bank/ewallet
2. Admin set subscription via `/set_subscription` command
3. Pro: Mudah, tidak perlu integrasi payment
4. Con: Perlu manual verification

### Opsi 2: Payment Gateway (Recommended)
Integrasikan dengan:
- **Midtrans** (Indonesia)
- **Stripe** (International)
- **PayPal** (International)

Contoh flow:
1. User pilih tier via command
2. Bot generate payment link
3. User bayar
4. Webhook update subscription otomatis

### Opsi 3: Discord Payment (Future)
Discord sedang develop native payment system. Bisa diintegrasikan nanti.

## Admin Commands

### Set Subscription
```
/set_subscription user:@username tier:premium duration_days:30
```

### Remove Subscription (downgrade ke free)
Edit file `subscriptions.json` atau buat command khusus.

## Database Structure

File `subscriptions.json` format:
```json
{
  "123456789": {
    "tier": "premium",
    "expires_at": "2024-02-01T00:00:00",
    "purchased_at": "2024-01-01T00:00:00",
    "duration_days": 30
  }
}
```

## Upgrade ke Database

Untuk production, disarankan upgrade ke database:
- **SQLite** (mudah, file-based)
- **PostgreSQL** (scalable, production-ready)
- **MongoDB** (NoSQL, fleksibel)

## Pricing Strategy

### Harga (Bulanan):
- **Free:** Rp 0 (selamanya) - 12 jam stay
- **Basic:** Rp 50.000/bulan - 24 jam (1 hari) stay
- **Premium:** Rp 100.000/bulan - 48 jam (2 hari) stay
- **VIP:** Rp 200.000/bulan - 168 jam (1 minggu) stay

### Alternatif Pricing:
- **Pay per use:** Rp 10.000 per 1 jam stay
- **Credit system:** Beli credit, pakai sesuai kebutuhan
- **Lifetime:** Rp 500.000 untuk lifetime VIP

## Marketing Tips

1. **Free tier** untuk menarik user baru
2. **Trial period** 7 hari untuk premium tier
3. **Referral program:** User dapat diskon jika invite teman
4. **Bulk discount:** Server besar dapat harga khusus
5. **Event pricing:** Diskon saat event tertentu

## Monitoring & Analytics

Track metrics:
- Jumlah user per tier
- Revenue per bulan
- Average usage time
- Churn rate
- Popular tier

Bisa buat dashboard atau report command untuk admin.

## Legal & Terms

Pastikan:
- Terms of Service jelas
- Privacy Policy
- Refund policy
- Payment terms

## Support

Setup support channel untuk:
- Payment issues
- Subscription questions
- Technical support

---

**Tips:** Mulai dengan manual payment dulu, lalu upgrade ke payment gateway setelah ada traction!

