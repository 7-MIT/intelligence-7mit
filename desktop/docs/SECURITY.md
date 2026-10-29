# Panduan keamanan

Prinsip: **pengguna mengendalikan semuanya, terlihat, dan dapat dihentikan.** Tidak ada kontrol tersembunyi, pengawasan tanpa sepengetahuan pengguna, atau bypass izin OS.

## Lapisan pertahanan

| Lapisan | Implementasi |
| --- | --- |
| Isolasi renderer | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webviewTag: false`; preload hanya mengekspos fungsi IPC. CSP ketat pada build produksi (`script-src 'self'`, tanpa `eval`, tanpa koneksi jaringan dari renderer). Semua permintaan izin web (kamera, lokasi, dll.) ditolak; navigasi & `window.open` ke luar aplikasi diblokir. |
| IPC | Setiap handler memverifikasi URL pengirim (hanya halaman aplikasi) dan memvalidasi payload dengan **zod strict** (properti asing, enum/tipe salah ditolak). Tersedia tes. |
| Satu gerbang eksekusi | Semua efek samping OS lewat `ToolExecutor → PermissionManager.authorize()`. Layanan desktop (mouse, keyboard, terminal, fs, apps) tidak diekspos ke IPC/renderer. Model hanya dapat memanggil tool yang ditawarkan untuk mode/sub-mode task itu (Plan tidak punya tool penulisan). |
| Izin | Enam izin (screen, input, terminal, filesystem, browser, apps), masing-masing dapat dicabut; pencabutan langsung menolak persetujuan yang menunggu. Perubahan yang meningkatkan hak (input, terminal, Auto Execute, kirim screenshot, tambah folder) **dikonfirmasi lewat dialog native OS**, bukan hanya UI. |
| Mode | **Read Only** (menolak semua tindakan mengubah), **Ask Before Action** (default), **Auto Execute** (hanya risiko *rendah* di workspace yang disetujui; risiko menengah/tinggi tetap bertanya). Risiko tinggi/destruktif **selalu** dikonfirmasi. "Setujui untuk task ini" hanya untuk risiko ≤ menengah dan tidak berlaku bila konten tercemar. |
| Stop | Tombol **Stop AI** (sidebar, tray, Permission Center, bar Control) membatalkan panggilan LLM, membunuh proses terminal, menolak semua persetujuan yang menunggu. |
| Audit | Setiap keputusan izin & hasil tool dicatat ke `audit.jsonl` (mode 0600) dengan **redaksi** API key/token/kunci privat; dapat diekspor. |

## Perintah shell

`shell-guard` mengklasifikasikan setiap perintah (per segmen `&& || ; |`):
- **Diblokir** (tak bisa disetujui): `rm -rf /|~`, `sudo/su/runas`, `mkfs/dd of=/dev/…`, fork bomb, `curl|sh`, `iex`, shutdown/reboot, akses `~/.ssh`/`.aws/credentials`/Keychain, dump environment, reverse shell, dll.
- **Tinggi** (selalu konfirmasi): hapus, `git push/reset --hard/clean`, `npm publish`, kill, chmod/chown, command substitution, request jaringan yang mengirim data.
- **Menengah**: instal dependency, git commit, build/run kode, buat/ubah berkas, redirect.
- **Rendah**: perintah baca-saja (ls, cat, git status/diff/log, …).

Proses anak mendapat environment yang **disaring** (variabel bernama *key/token/secret/password/credential…* dihapus). Perintah dibatasi timeout dan diputus saat Stop. *Catatan jujur:* klasifikasi berbasis pola adalah pertahanan berlapis, bukan sandbox — program yang disetujui pengguna (mis. `npm test`) berjalan dengan hak pengguna.

## Berkas & kredensial

`PathGuard`: hanya folder yang diizinkan (symlink yang keluar folder ditolak; `realpath` diperiksa, termasuk berkas baru). Kunci privat, `.env*` (kecuali `.example`), `.ssh`, `.aws`, `.npmrc`, `*.pem/*.key/…` **tidak dapat dibaca/ditulis agen**. Penulisan ke `.git/` diblokir. Hapus = pindah ke Trash/Recycle Bin. Berkas executable/skrip tidak dibuka otomatis.

## Prompt injection

Konten dari web, berkas, output terminal, judul jendela, dan memori **dibungkus** `<untrusted_content>` dan dipindai pola injection (EN/ID). Bila terdeteksi: peringatan di timeline, dan task menjadi **tainted** → semua tindakan berikutnya (bahkan baca-saja) wajib disetujui, dan "setujui untuk task ini" dinonaktifkan. System prompt menegaskan bahwa konten tersebut adalah data. Markdown tidak merender HTML mentah dan **memblokir gambar eksternal** (cegah eksfiltrasi lewat URL gambar). *Catatan:* tidak ada pertahanan injection yang sempurna; konfirmasi manusia untuk tindakan berisiko adalah pengaman utama.

## Data sensitif

- Login: kata sandi hanya melewati IPC sekali ke proses utama lalu dikirim ke Supabase; tidak disimpan. Token sesi terenkripsi OS, di-refresh otomatis, dan dihapus saat keluar. Backend bawaan memakai token akun bila login (kunci publishable web bila tamu).

- API key: `safeStorage` (Keychain/DPAPI/libsecret); bila enkripsi OS tidak tersedia, key hanya di **memori** sesi dan UI memberi tahu. Tidak pernah ke renderer/log/berkas teks biasa (diuji E2E).
- **Screenshot hanya dikirim ke penyedia AI bila Anda mengaktifkan "Izinkan kirim screenshot"**, dan Control menolak mulai tanpanya. Pratinjau layar di UI bersifat lokal. Pengguna menentukan penyedia mana yang menerima data.
- Browser Web: konteks Playwright baru, tidak persisten, tanpa cookie/login Anda; hanya `http(s)`; alamat metadata cloud diblokir.

## Browser, Windows, macOS

- macOS: aplikasi meminta Accessibility (`isTrustedAccessibilityClient`) dan membuka panel Screen Recording; tidak ada bypass TCC.
- Windows: tidak mengeskalasi privilege; jendela Administrator/UAC tidak dapat dikontrol (UIPI) — verifikasi screenshot memberi peringatan bila layar tidak berubah.

## Code signing & notarization

Tersedia di CI **bila** secrets resmi diisi: `CSC_LINK` + `CSC_KEY_PASSWORD` (Windows/macOS Developer ID), `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` (notarisasi; tambahkan `-c.mac.notarize=true`). Tanpa itu build diberi label **UNSIGNED**. Tanda tangan tidak pernah dipalsukan.

## Melaporkan kerentanan

Email: halo@7mit.org.
