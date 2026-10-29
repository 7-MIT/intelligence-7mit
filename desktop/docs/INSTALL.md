# Panduan instalasi

Unduh installer dari **GitHub Actions → Desktop Build → Artifacts** atau dari **Releases** (tag `desktop-v*`).

> **Status tanda tangan.** Installer hanya bertanda tangan bila pemilik repo menyediakan sertifikat resmi (lihat `docs/SECURITY.md`). Build tanpa sertifikat **tidak bertanda tangan** dan akan memunculkan peringatan OS. Berkas `SIGNING-STATUS.txt` di artifact menyatakan statusnya.

## Windows (10/11 x64)

1. Jalankan `intelligence-7mit-6-desktop-<versi>-win-x64.exe`.
2. Bila SmartScreen muncul pada build tak bertanda tangan: **More info → Run anyway** (hanya jika Anda memercayai sumbernya).
3. Pilih folder instalasi. Installer membuat shortcut Desktop dan Start Menu; uninstaller tersedia di *Settings → Apps*.
4. **Windows ARM64**: tidak ada build native karena modul otomasi input (`libnut`) hanya tersedia untuk x64. Windows 11 ARM64 menjalankan build x64 lewat emulasi; Control belum diuji pada ARM64.
5. Batasan izin Windows: aplikasi tidak dapat mengontrol jendela yang berjalan **sebagai Administrator** (UIPI) kecuali intelligence.7mit juga dijalankan sebagai Administrator — aplikasi **tidak** melakukan eskalasi otomatis. Dialog UAC/layar aman tidak dapat dikontrol (dan memang seharusnya tidak).

## macOS (Apple Silicon & Intel)

1. Buka `.dmg` yang sesuai (`-mac-arm64` untuk M1/M2/M3/M4, `-mac-x64` untuk Intel), seret aplikasi ke **Applications**.
2. Build tak bertanda tangan/ternotarisasi: klik kanan aplikasi → **Open**, atau `xattr -dr com.apple.quarantine "/Applications/intelligence.7mit 6 Desktop.app"`.
3. Untuk **Control**, berikan izin di **System Settings → Privacy & Security**:
   - **Screen Recording** (screenshot) dan **Accessibility** (mouse/keyboard, daftar jendela).
   - Gunakan tombol *Permission Center → Minta izin Accessibility & Screen Recording*, lalu **mulai ulang** aplikasi.
   Aplikasi tidak dapat memberikan izin ini sendiri dan tidak mencoba mem-bypass-nya.

## Linux (eksperimental)

AppImage x64. Control membutuhkan sesi **X11**; Wayland tidak didukung penuh. Untuk daftar/fokus jendela pasang `wmctrl`.

## Konfigurasi pertama kali

1. **Pengaturan → Penyedia AI**: tambahkan penyedia OpenAI-compatible (Base URL, model, API key) lalu **Uji koneksi**. (Backend bawaan hanya chat teks.)
2. **Permission Center**: pilih mode eksekusi, tambahkan folder yang boleh diakses, aktifkan izin yang Anda perlukan. Untuk Control aktifkan *Screen observation*, *Mouse and keyboard*, dan *Izinkan kirim screenshot ke penyedia AI*.
3. Mode **Web** butuh Chrome, Edge, atau Chromium Playwright (`npx playwright-core install chromium`). Jalur kustom: variabel `IT7_BROWSER_PATH`.

## Build dari sumber

```bash
cd desktop
npm ci
npm run dist:win   # di Windows
npm run dist:mac   # di macOS
```
Hasil di `desktop/dist/`. CI: `.github/workflows/desktop-build.yml`.

## Pembaruan otomatis

Build terpasang memeriksa GitHub Releases (`electron-updater`) saat dibuka bila *Pengaturan → Pembaruan otomatis* aktif; juga tersedia tombol *Periksa pembaruan*. Pembaruan macOS memerlukan build bertanda tangan. Repo privat membutuhkan token (lihat dokumentasi electron-updater).
