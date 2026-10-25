# intelligence.7mit

Frontend statis untuk asisten AI **intelligence.7mit** (HTML, CSS, JavaScript, Three.js).

| Halaman | Rute |
| --- | --- |
| Beranda | `/` |
| Aplikasi chat | `/chat/` |
| Pengaturan | `/chat/pengaturan/` |
| Login | `/auth/` |

## Menjalankan lokal

```bash
python3 -m http.server 8000
# buka http://localhost:8000/
```

Jalankan dari root repo agar path absolut (`/home.css`, `/vendor/...`) bekerja.

## Catatan

- Hosting: Cloudflare Workers (`wrangler.jsonc`, `src/worker.js`). Cuaca lewat `/api/weather`; set secret `OPENWEATHER_API_KEY` (Settings → Variables and Secrets), jangan di repo. Tanpa itu cuaca memakai Open-Meteo.
- Layanan AI, login, sinkronisasi akun, dan cuaca membutuhkan backend aktif (tidak disertakan).
- Untuk domain baru, sesuaikan redirect/origin pada layanan akun.
- Mode tamu menyimpan data di browser.
- Aplikasi Android: lihat bagian "APK Android" di bawah.
- Unggah seluruh isi repo ke root hosting statis; `404.html` dipakai sebagai halaman error.

Kontak: halo@7mit.org

## APK Android (HP & Chromebook)

APK dibangun otomatis lewat GitHub Actions (`.github/workflows/android-apk.yml`, Capacitor):

1. Buka tab **Actions → Build Android APK → Run workflow**.
2. Setelah selesai, unduh `intelligence-7mit.apk` dari **Artifacts** pada run tersebut.
3. Pasang di HP Android. Di Chromebook, aktifkan Google Play / mode pengembang Android lalu pasang APK, atau pasang situs sebagai PWA dari Chrome (menu ⋮ → *Instal intelligence.7mit*).

APK ini bertanda debug (cukup untuk pemasangan manual). Untuk Play Store perlu keystore rilis.
Lokal: `npm install && npm run prepare:www && npx cap add android && npx cap sync android`.

## IPA iOS (tanpa tanda tangan)

Workflow `ios-ipa.yml` membangun `.ipa` **tanpa code signing** (artifact di tab Actions). File ini tidak bisa dipasang langsung di iPhone; tanda tangani ulang dengan Apple ID memakai AltStore/Sideloadly, atau pakai akun Apple Developer untuk TestFlight/App Store.

## Sinkronisasi Sites

Frontend diselaraskan dengan intelligence.7mit di Sites pada 25 Oktober 2026. Ilustrasi Siswa interaktif dan perbaikan kolom pesan tetap tersedia. Nilai API key dari ZIP digunakan sebagai secret `OPENWEATHER_API_KEY` pada runtime Sites, tanpa memasukkannya ke kode frontend. Untuk deployment Cloudflare dari repositori ini, atur secret bernama sama pada Worker menggunakan nilai dari ZIP. Secret runtime Sites dan Cloudflare dikelola terpisah.
