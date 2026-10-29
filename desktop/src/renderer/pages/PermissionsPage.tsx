import { AppWindow, Eye, FolderOpen, FolderPlus, Globe, MousePointerClick, ShieldAlert, ShieldCheck, TerminalSquare, Trash2, Zap, FileText, Unplug } from 'lucide-react';
import type { ExecutionMode, PermissionKind } from '@shared/types';
import { Switch } from '@/components/ui';
import { api } from '@/lib/api';
import { guard, stopAll, store, toast, updatePermissions } from '@/lib/state';

const ROWS: { kind: PermissionKind; icon: JSX.Element; title: string; desc: string }[] = [
  { kind: 'screen', icon: <Eye size={20} />, title: 'Screen observation', desc: 'Mengambil screenshot layar utama untuk dipahami AI. Pengiriman ke penyedia AI diatur terpisah di bawah.' },
  { kind: 'input', icon: <MousePointerClick size={20} />, title: 'Mouse and keyboard', desc: 'Klik, drag, scroll, mengetik, dan shortcut di komputer Anda. Setiap tindakan klik/ketik meminta persetujuan kecuali Anda pilih "setujui untuk task ini".' },
  { kind: 'terminal', icon: <TerminalSquare size={20} />, title: 'Terminal', desc: 'Menjalankan perintah shell di folder yang diizinkan. Perintah berbahaya (rm -rf /, sudo, curl|sh, akses kunci SSH, dll.) selalu diblokir.' },
  { kind: 'filesystem', icon: <FileText size={20} />, title: 'File system', desc: 'Membaca/menulis/menyalin/memindahkan berkas hanya di dalam folder yang diizinkan. Hapus = ke Trash dan selalu konfirmasi. Kredensial & kunci privat dilindungi.' },
  { kind: 'browser', icon: <Globe size={20} />, title: 'Browser', desc: 'Browser Playwright terisolasi (tanpa cookie/login Anda). Kirim/beli/hapus/terbitkan selalu meminta konfirmasi.' },
  { kind: 'apps', icon: <AppWindow size={20} />, title: 'Application management', desc: 'Membuka aplikasi, memindah fokus, minimize/maximize/tutup jendela. Menutup jendela memakai permintaan tutup normal sehingga aplikasi dapat menanyakan penyimpanan.' }
];

const MODES: { value: ExecutionMode; title: string; desc: string; icon: JSX.Element }[] = [
  { value: 'readonly', title: 'Read Only', desc: 'AI hanya mengamati; semua tindakan yang mengubah sesuatu ditolak.', icon: <Eye size={18} /> },
  { value: 'ask', title: 'Ask Before Action', desc: 'AI meminta persetujuan sebelum setiap tindakan yang mengubah sesuatu. (Disarankan)', icon: <ShieldCheck size={18} /> },
  { value: 'auto', title: 'Auto Execute', desc: 'Tindakan BERISIKO RENDAH di workspace yang Anda setujui berjalan otomatis. Risiko menengah/tinggi tetap bertanya.', icon: <Zap size={18} /> }
];

export function PermissionsPage() {
  const p = store.use((s) => s.permissions);
  const system = store.use((s) => s.system);
  const workspaces = store.use((s) => s.workspaces);
  const addFolder = async () => {
    const f = await guard(api.ws.pick());
    if (f && !p.allowedFolders.includes(f)) await updatePermissions({ allowedFolders: [...p.allowedFolders, f] });
  };
  return (
    <>
      <div className="topbar"><h2 className="display">Permission Center</h2><span className="spacer" />
        <button className="btn danger" onClick={stopAll}><ShieldAlert size={16} />Stop AI & tolak semua</button></div>
      <div className="page"><div className="pad stack">
        <div className="card">
          <h3>Mode eksekusi</h3><p className="sub">Menentukan seberapa besar kebebasan AI. Tindakan destruktif selalu meminta konfirmasi, apa pun modenya.</p>
          <div className="grid2">
            {MODES.map((m) => (
              <button key={m.value} onClick={() => updatePermissions({ mode: m.value })} aria-pressed={p.mode === m.value} className="card" style={{ textAlign: 'left', borderColor: p.mode === m.value ? 'var(--blue)' : undefined, boxShadow: p.mode === m.value ? 'var(--glow)' : undefined }}>
                <div className="row">{m.icon}<b>{m.title}</b>{p.mode === m.value && <span className="chip blue">Aktif</span>}</div><p className="sub" style={{ margin: '6px 0 0' }}>{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Izin akses</h3><p className="sub">Setiap izin dapat dicabut kapan saja; pencabutan langsung menolak permintaan yang menunggu.</p>
          {ROWS.map((r) => (
            <div className="perm-row" key={r.kind}>
              <span className="perm-ico">{r.icon}</span>
              <div style={{ flex: 1 }}><b>{r.title}</b><div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>{r.desc}</div></div>
              <Switch label={r.title} checked={p.grants[r.kind]} onChange={(v) => updatePermissions({ grants: { [r.kind]: v } })} />
            </div>
          ))}
          <div className="perm-row">
            <span className="perm-ico"><Unplug size={20} /></span>
            <div style={{ flex: 1 }}><b>Izinkan kirim screenshot ke penyedia AI</b><div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>Control mengirim screenshot layar Anda ke endpoint model yang dipilih. Layar dapat memuat data sensitif — aktifkan hanya bila Anda mempercayai penyedia tersebut.</div></div>
            <Switch label="Kirim screenshot" checked={p.allowScreenshotUpload} onChange={(v) => updatePermissions({ allowScreenshotUpload: v })} />
          </div>
        </div>

        <div className="card">
          <div className="row"><h3 style={{ flex: 1 }}>Folder yang boleh diakses</h3><button className="btn primary sm" onClick={addFolder}><FolderPlus size={15} />Tambah folder</button></div>
          <p className="sub">Berkas, terminal, dan git hanya bekerja di dalam folder ini (symlink yang keluar folder ditolak).</p>
          {p.allowedFolders.length === 0 && <div className="status-banner warn">Belum ada folder. AI tidak dapat mengakses berkas atau terminal.</div>}
          <table className="tbl"><tbody>
            {p.allowedFolders.map((f) => (
              <tr key={f}><td><FolderOpen size={14} style={{ verticalAlign: -2 }} /> {f}</td>
                <td style={{ width: 210 }}><label className="row" style={{ gap: 8 }}><Switch label={`Auto Execute di ${f}`} checked={p.autoWorkspaces.includes(f)} onChange={(v) => updatePermissions({ autoWorkspaces: v ? [...p.autoWorkspaces, f] : p.autoWorkspaces.filter((x) => x !== f) })} /><small>Auto Execute</small></label></td>
                <td style={{ width: 40 }}><button className="icon-btn" aria-label={`Hapus ${f}`} onClick={() => updatePermissions({ allowedFolders: p.allowedFolders.filter((x) => x !== f), autoWorkspaces: p.autoWorkspaces.filter((x) => x !== f) })}><Trash2 size={15} /></button></td></tr>
            ))}
          </tbody></table>
          {workspaces.length > 0 && <small style={{ color: 'var(--faint)' }}>Workspace terdaftar: {workspaces.map((w) => w.name).join(', ')}</small>}
        </div>

        <div className="card">
          <h3>Izin sistem operasi</h3>
          <p className="sub">Izin OS tidak dapat diberikan oleh aplikasi; kami hanya meminta dan menjelaskan statusnya. Tidak ada bypass.</p>
          {system?.platform === 'darwin' && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="row"><span className={`chip ${system.screen.macScreenStatus === 'granted' ? 'ok' : 'warn'}`}>Screen Recording: {system.screen.macScreenStatus}</span><span className={`chip ${system.screen.macAccessibility ? 'ok' : 'warn'}`}>Accessibility: {system.screen.macAccessibility ? 'granted' : 'belum'}</span></div>
              <div><button className="btn" onClick={async () => { const r = await guard(api.perm.requestMac()); if (r) toast(r.ok ? 'success' : 'info', r.message); }}>Minta izin Accessibility & Screen Recording</button></div>
              <small style={{ color: 'var(--muted)' }}>Setelah mengaktifkan di System Settings → Privacy & Security, mulai ulang aplikasi.</small>
            </div>
          )}
          {system?.platform === 'win32' && <div className="status-banner warn">Windows: aplikasi ini tidak dapat mengontrol jendela yang berjalan sebagai Administrator (batasan UIPI) kecuali intelligence.7mit juga dijalankan sebagai Administrator — kami tidak melakukan eskalasi otomatis. Dialog UAC/layar aman tidak dapat dikontrol.</div>}
          {system?.platform === 'linux' && <div className="status-banner warn">Linux: kontrol mouse/keyboard & tangkapan layar membutuhkan sesi X11 (Wayland tidak didukung penuh).</div>}
          <div className="row wrap" style={{ marginTop: 10 }}>
            <span className={`chip ${system?.input.available ? 'ok' : 'bad'}`}>Otomasi input: {system?.input.available ? 'siap' : 'tidak tersedia'}</span>
            <span className={`chip ${system?.safeStorage ? 'ok' : 'warn'}`}>Enkripsi API key OS: {system?.safeStorage ? 'aktif' : 'tidak tersedia'}</span>
          </div>
          {system && !system.input.available && <div className="status-banner bad" style={{ marginTop: 8 }}>{system.input.reason}</div>}
        </div>
      </div></div>
    </>
  );
}
