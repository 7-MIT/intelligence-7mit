# intelligence.7mit 6 Desktop

Aplikasi desktop (Electron + React + TypeScript) untuk **agen AI yang benar-benar bertindak** di komputer Anda — dengan izin dan kendali penuh pengguna. Pengembangan dari [intelligence.7mit](https://intelligence.7mit.org) versi web (repositori induk: kode web di root repo tidak diubah).

| Mode | Kemampuan nyata |
| --- | --- |
| **Chat** | Percakapan, riwayat, pencarian, Markdown + syntax highlighting, lampiran & drag-drop. |
| **Code** (Plan / Edit / Agent) | Membaca struktur proyek, `edit_file`/`write_file` **dengan diff sebelum diterapkan**, terminal, build/test, perbaikan error, Git (status/diff/commit atas persetujuan), editor Monaco, file explorer, terminal bawaan, live preview localhost, memori workspace. |
| **Web** | Playwright dengan sesi **terisolasi** (tanpa login/cookie Anda): buka, klik, isi form, scroll, tab, screenshot, unduhan, `expect_text` untuk pengujian, log konsol/jaringan untuk debugging. Tampilan live real-time. Kirim/beli/hapus/terbitkan **selalu** minta konfirmasi. |
| **Control** | Siklus *Observe → Plan → Request Permission → Act → Verify → Continue*: screenshot desktop, klik kiri/kanan/ganda, drag, scroll, ketik, shortcut, buka aplikasi, daftar/fokus/minimize/maximize/tutup jendela, berkas & terminal. Setiap aksi input diverifikasi otomatis dengan screenshot baru (dan memberi peringatan bila layar tidak berubah). |

Semua tindakan terlihat di **Activity Timeline**, bisa di-**Pause / Resume / Stop**, dan melewati **Permission Center** + **audit log**.

## Mulai cepat (pengembangan)

```bash
cd desktop
npm install
npm run dev          # Electron + Vite (HMR)
npm run typecheck
npm test             # 130+ unit/integrasi (agent loop, IPC, izin, tool desktop, Chromium nyata)
npm run e2e          # E2E Linux/X11 di Xvfb: UI, agen Code, Control nyata (lihat docs/TESTING.md)
npm run pack         # build + paket tak-terpasang (dist/<os>-unpacked)
npm run dist:win     # installer NSIS x64 (jalankan di Windows)
npm run dist:mac     # .dmg x64 + arm64 (jalankan di macOS)
```

Instal untuk pengguna akhir: **[docs/INSTALL.md](docs/INSTALL.md)**. Keamanan: **[docs/SECURITY.md](docs/SECURITY.md)**. Arsitektur: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Pengujian & keterbatasan: **[docs/TESTING.md](docs/TESTING.md)**.

## Penyedia AI

- **intelligence.7mit (bawaan)** — memakai backend Supabase Edge Function yang sudah dipakai versi web (kunci *publishable* publik yang sama dengan frontend web). **Hanya chat teks**: tidak mendukung tool calling maupun vision.
- **OpenAI-compatible** — tambahkan Base URL, model, dan API key di *Pengaturan → Penyedia AI*. Mode Code/Web membutuhkan **tool calling**; Control membutuhkan tool calling **dan vision**.

Bila penyedia tidak cocok, aplikasi menampilkan status ketidakcocokan dan **menolak memulai** task — tidak berpura-pura mengontrol komputer. API key disimpan terenkripsi oleh OS (`safeStorage`: Keychain/DPAPI/libsecret) di proses utama, tidak pernah dikirim ke renderer, tidak di-hardcode, dan disamarkan dari log.

## Struktur proyek

```
desktop/
├─ src/
│  ├─ shared/          tipe + skema IPC (zod) + nama channel
│  ├─ main/            proses utama Electron
│  │  ├─ security/     PermissionManager, ApprovalBroker, AuditLogger, shell-guard, PathGuard, deteksi injection
│  │  ├─ control/      ScreenshotService, MouseController, KeyboardController, driver nut.js,
│  │  │                WindowManager/ApplicationLauncher (platform.ts), FileSystemAgent, TerminalExecutor, diff
│  │  ├─ tools/        definisi tool, validasi argumen, ToolExecutor (satu-satunya jalur eksekusi)
│  │  ├─ agent/        klien LLM (OpenAI-compatible, streaming, tool calls), AgentTaskManager, prompt, context
│  │  ├─ browser/      BrowserController (Playwright)
│  │  ├─ code/         Git
│  │  ├─ ipc.ts        handler IPC (validasi pengirim + zod)
│  │  └─ index.ts      jendela, tray, shortcut global, notifikasi, auto-update, pratinjau layar
│  ├─ preload/         jembatan contextBridge (tanpa akses Node)
│  └─ renderer/        React UI (Chat, Code, Web, Control Session, Permission Center, Riwayat, Pengaturan)
├─ tests/              vitest
├─ e2e/                skrip E2E Electron + Playwright + mock LLM
├─ electron-builder.yml
└─ docs/
```
