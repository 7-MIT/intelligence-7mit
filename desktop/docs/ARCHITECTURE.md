# Arsitektur

```
Renderer (React, sandbox) ──contextBridge──▶ Preload ──ipcRenderer.invoke──▶ Main (ipc.ts: cek pengirim + zod)
                                                                                   │
                         ┌─────────────────────────────────────────────────────────┤
                         ▼                                                         ▼
                AgentTaskManager ──▶ LLM provider (OpenAI-compat / intelligence.7mit)   Store (JSON, safeStorage)
                         │  tool_calls
                         ▼
                   ToolExecutor ──validateArgs──▶ tool.plan() (risiko, diff) ──▶ PermissionManager.authorize()
                                                                                   │  ApprovalBroker (UI) / AuditLogger
                         ▼ (hanya bila diizinkan)
   ScreenshotService · MouseController · KeyboardController · NutDriver · WindowManager/AppLauncher (platform.ts)
   FileSystemAgent(PathGuard) · TerminalExecutor(shell-guard) · BrowserController(Playwright)
```

## Agent loop (`agent/manager.ts`)
1. Cek kecocokan penyedia (tools / vision / izin screenshot) → gagal jelas bila tidak cocok.
2. Susun system prompt (mode, workspace, memori, platform) + riwayat + lampiran.
3. Loop (maks. langkah dapat diatur): kompaksi konteks (gambar lama dibuang, output lama dipangkas, grup tertua dibuang bila perlu) → panggil LLM (streaming) → untuk tiap `tool_call`: parse JSON → `ToolExecutor.execute` → hasil (teks + gambar) kembali ke model.
4. Pemulihan galat: galat tool dikembalikan ke model; 4 kegagalan beruntun menghentikan task; galat LLM transien diulang dengan backoff.
5. **Pause** (menahan sebelum langkah berikutnya), **Resume**, **Stop** (AbortController → LLM, terminal, persetujuan), **Human approval** (ApprovalBroker).
6. Status `waiting_approval` ditampilkan real-time; semua kejadian masuk Activity Timeline.

## Kontrol komputer
- Screenshot: `desktopCapturer` → diperkecil (≤1280px) → JPEG. Koordinat model = piksel gambar; dipetakan ke piksel logis layar utama lalu dikali skala driver (rasio ukuran layar driver/Electron; menangani DPI Windows).
- Input: `@nut-tree-fork/nut-js` (dimuat malas; bila gagal, status jelas). Teks non-ASCII/panjang diketik via clipboard lalu clipboard dipulihkan.
- Jendela/aplikasi: nut.js (+ `wmctrl` di Linux); maximize/close lewat PowerShell/osascript/wmctrl dengan argumen via environment (anti-injeksi); close = permintaan tutup normal.
- Verifikasi: setiap aksi input mengambil screenshot baru dan membandingkan hash dengan sebelumnya.
- Pratinjau live: layanan screenshot terpisah (tidak mengubah peta koordinat agen), hanya ke renderer lokal.

## Keterbatasan desain
Hanya layar utama; terminal bawaan tanpa PTY; klasifikasi shell berbasis pola; backend 7mit bawaan hanya teks.
