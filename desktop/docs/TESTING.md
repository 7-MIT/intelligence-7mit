# Pengujian & keterbatasan

## Otomatis
| Perintah | Cakupan |
| --- | --- |
| `npm test` | 130+ tes vitest: shell-guard, PathGuard, PermissionManager (grant/readonly/ask/auto/tainted/abort), validasi IPC (zod), tool berkas & terminal nyata, tool Control (driver palsu: pemetaan koordinat, DPI, clipboard, verifikasi), **agent loop** (tool calling, approval, stop, pause/resume, pemulihan galat, batas langkah, mismatch penyedia), parser SSE OpenAI, store & enkripsi key, dan **Chromium nyata** (snapshot, isi form, klik, tab, unduhan, log konsol, blokir klik "Kirim"). |
| `npm run e2e` | Aplikasi Electron **sungguhan** di Xvfb: isolasi renderer, IPC, chat streaming dari mock OpenAI, agen Code menulis berkas setelah persetujuan, Monaco, penolakan, audit tanpa bocor key; **Control nyata**: screenshot → klik → ketik → Enter pada jendela xterm (diverifikasi lewat berkas yang ditulis xterm & posisi pointer X server), `list/focus/close` jendela lewat window manager, persetujuan tiap aksi, pratinjau live. Dapat dijalankan pada build terpasang: `IT7_APP_EXE=dist/linux-unpacked/intelligence-7mit-desktop npm run e2e`. |
| CI | `desktop-ci.yml`: typecheck + tes + build di Ubuntu, **Windows, macOS**; E2E Linux. |

## Yang BELUM / tidak dapat diuji di lingkungan pengembangan ini
Lingkungan pengembangan hanya Linux. Karena itu **belum diuji secara nyata pada Windows dan macOS**:
- Kontrol mouse/keyboard, tangkapan layar, daftar/fokus/minimize/maximize/tutup jendela, pembuka aplikasi (`platform.ts`: PowerShell/osascript), alur izin Accessibility/Screen Recording macOS, kalibrasi DPI Windows, dan batasan UIPI/elevasi.
- Pemasangan installer `.exe`/`.dmg`, shortcut/Start Menu/uninstaller, dan auto-update (installer hanya dapat dibangun di runner Windows/macOS; workflow `desktop-build.yml` disediakan).
- Windows ARM64: tidak dibangun (`libnut` hanya x64).
- Wayland (Linux) tidak didukung.
Logika yang tak bergantung OS (izin, agent loop, tool, parser, kebijakan shell/path) diuji pada ketiga OS lewat CI. **Lakukan uji manual pada Windows & macOS sebelum rilis** (daftar periksa: buka app → set penyedia → beri izin → jalankan contoh "buka Notepad/TextEdit, ketik teks, simpan" → Stop saat berjalan → periksa audit log).

## Keterbatasan produk
- Backend 7mit bawaan hanya chat teks; Code/Web/Control butuh penyedia OpenAI-compatible dengan tool calling (+ vision untuk Control).
- Terminal bawaan menggunakan pipa (bukan PTY): program TTY penuh (vim, htop) tidak didukung.
- Hanya layar utama untuk screenshot/klik.
- Font DM Sans/Manrope dipakai bila terpasang; selain itu font sistem (aplikasi sepenuhnya offline-capable).
