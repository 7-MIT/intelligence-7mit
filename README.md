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

- Cuaca OpenWeather lewat proxy `functions/api/weather.js` (Cloudflare Pages Functions). Set secret `OPENWEATHER_API_KEY` di dashboard hosting, jangan di repo. Tanpa itu, cuaca memakai Open-Meteo.
- Layanan AI, login, sinkronisasi akun, dan cuaca membutuhkan backend aktif (tidak disertakan).
- Untuk domain baru, sesuaikan redirect/origin pada layanan akun.
- Mode tamu menyimpan data di browser.
- Unggah seluruh isi repo ke root hosting statis; `404.html` dipakai sebagai halaman error.

Kontak: halo@7mit.org
