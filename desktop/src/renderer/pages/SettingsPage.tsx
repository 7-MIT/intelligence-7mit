import { CheckCircle2, KeyRound, Loader2, Plus, Save, TestTube2, Trash2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ProviderConfig } from '@shared/types';
import { Dropdown, Switch } from '@/components/ui';
import { api } from '@/lib/api';
import { guard, refreshAll, store, syncHistory, toast, updateSettings } from '@/lib/state';
import { AuthGate } from '@/components/AuthGate';

function ProviderCard({ p }: { p: ProviderConfig }) {
  const [form, setForm] = useState({ name: p.name, baseUrl: p.baseUrl, model: p.model, supportsTools: p.supportsTools, supportsVision: p.supportsVision });
  const [key, setKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState('');
  const builtin = p.kind === 'intelligence7mit';
  const save = async () => { if (await guard(api.provider.save({ ...form, id: p.id, kind: 'openai' }))) { toast('success', 'Penyedia disimpan'); await refreshAll(); } };
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row"><h3 style={{ flex: 1 }}>{p.name}</h3>{builtin && <span className="chip blue">Bawaan</span>}<span className={`chip ${p.hasKey ? 'ok' : 'warn'}`}><KeyRound size={12} />{p.hasKey ? 'Key tersimpan' : 'Belum ada key'}</span></div>
      {builtin ? (
        <p className="sub" style={{ margin: 0 }}>Backend intelligence.7mit yang sudah ada (Supabase Edge Function). Mendukung <b>chat teks saja</b>. Mode Code/Web/Control membutuhkan penyedia kompatibel OpenAI dengan tool calling — aplikasi tidak akan berpura-pura bekerja bila tidak tersedia.</p>
      ) : (
        <>
          <div className="grid2">
            <div className="field"><label>Nama</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Base URL (OpenAI-compatible)</label><input className="input" placeholder="https://api.openai.com/v1" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></div>
            <div className="field"><label>Model</label>
              <div className="row"><input className="input" list={`m-${p.id}`} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /><datalist id={`m-${p.id}`}>{models.map((m) => <option key={m} value={m} />)}</datalist>
                <button className="btn sm" title="Ambil daftar model" onClick={async () => { setBusy('m'); const r = await guard(api.provider.models({ id: p.id })); setBusy(''); if (r) { setModels(r); toast('info', `${r.length} model ditemukan`); } }}>{busy === 'm' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}</button></div></div>
            <div className="field"><label>API key (disimpan terenkripsi di OS, tidak pernah dikirim ke UI)</label>
              <div className="row"><input className="input" type="password" autoComplete="off" placeholder={p.hasKey ? '•••••••• (tersimpan)' : 'sk-…'} value={key} onChange={(e) => setKey(e.target.value)} />
                <button className="btn sm" disabled={!key} onClick={async () => { const r = await guard(api.provider.setKey({ id: p.id, key })); if (r) { setKey(''); toast(r.persisted ? 'success' : 'info', r.persisted ? 'Key tersimpan terenkripsi' : 'Enkripsi OS tidak tersedia: key hanya disimpan di memori sesi ini'); await refreshAll(); } }}><Save size={14} />Simpan</button></div></div>
          </div>
          <div className="row wrap"><label className="row"><Switch label="Tool calling" checked={form.supportsTools} onChange={(v) => setForm({ ...form, supportsTools: v })} />Mendukung tool calling</label><label className="row"><Switch label="Vision" checked={form.supportsVision} onChange={(v) => setForm({ ...form, supportsVision: v })} />Mendukung vision (gambar)</label></div>
        </>
      )}
      <div className="row wrap">
        {!builtin && <button className="btn primary sm" onClick={save}><Save size={14} />Simpan konfigurasi</button>}
        <button className="btn sm" onClick={async () => { setBusy('t'); setResult(null); const r = await guard(api.provider.test({ id: p.id })); setBusy(''); if (r) setResult(r); }}>{busy === 't' ? <Loader2 size={14} className="spin" /> : <TestTube2 size={14} />}Uji koneksi</button>
        {!builtin && <button className="btn danger sm" onClick={async () => { if (confirm(`Hapus penyedia "${p.name}" dan key-nya?`)) { await guard(api.provider.remove({ id: p.id })); await refreshAll(); } }}><Trash2 size={14} />Hapus</button>}
      </div>
      {result && <div className="stack" style={{ gap: 4, fontSize: '.84rem' }}>{Object.entries(result).map(([k, v]) => <div key={k}><b style={{ textTransform: 'capitalize' }}>{k}:</b> <span style={{ color: v.startsWith('GAGAL') || v.startsWith('Tidak') ? 'var(--amber)' : 'var(--green)' }}>{v}</span></div>)}</div>}
    </div>
  );
}

export function SettingsPage() {
  const s = store.use((x) => x.settings);
  const providers = store.use((x) => x.providers);
  const info = store.use((x) => x.info);
  const system = store.use((x) => x.system);
  const auth = store.use((x) => x.auth);
  const [login, setLogin] = useState(false);
  const [upd, setUpd] = useState('');
  const [shortcut, setShortcut] = useState(s.globalShortcut);
  useEffect(() => setShortcut(s.globalShortcut), [s.globalShortcut]);
  return (
    <>
      <div className="topbar"><h2 className="display">Pengaturan</h2></div>
      <div className="page"><div className="pad stack">
        <div className="card stack">
          <h3>Akun</h3>
          {auth?.status === 'user' ? (
            <>
              <div><b>{auth.profile?.display_name}</b>{auth.email && <span style={{ color: 'var(--muted)' }}> · {auth.email}</span>}<br /><span className="chip blue">{auth.profile?.provider === 'akun7mit' ? 'akun.7mit' : 'Email'}</span>{auth.profile?.role && <span className="chip" style={{ marginLeft: 6 }}>{auth.profile.role}</span>}</div>
              {auth.persisted === false && <div className="status-banner warn">Enkripsi OS tidak tersedia: sesi login hanya di memori dan hilang saat aplikasi ditutup.</div>}
              <p className="sub" style={{ margin: 0 }}>Riwayat <b>Chat</b> tersinkron dengan akun web (tabel yang sama). Percakapan <b>Code</b> tetap lokal di komputer ini.</p>
              <div className="row"><button className="btn" onClick={() => syncHistory()}>Sinkronkan sekarang</button><button className="btn danger" onClick={async () => { if (confirm('Keluar dari akun? Riwayat Chat di komputer ini akan dihapus (tetap tersimpan di akun Anda). Percakapan Code tidak terpengaruh.')) { const st = await guard(api.auth.signOut()); if (st) store.set({ auth: st }); } }}>Keluar</button></div>
            </>
          ) : (
            <>
              <p className="sub" style={{ margin: 0 }}>Anda memakai <b>mode tamu</b>: riwayat hanya di komputer ini. Masuk untuk menyinkronkan riwayat Chat dengan akun intelligence.7mit.</p>
              <div><button className="btn primary" onClick={() => setLogin(true)}>Masuk / daftar</button></div>
            </>
          )}
        </div>
        {login && <AuthGate onClose={() => setLogin(false)} />}

        <div className="card stack">
          <h3>Tampilan & perilaku</h3>
          <div className="grid2">
            <div className="field"><label>Tema</label><Dropdown label="Tema" value={s.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: 'dark', label: 'Gelap' }, { value: 'light', label: 'Terang' }, { value: 'system', label: 'Ikuti sistem' }]} /></div>
            <div className="field"><label>Batas langkah per task</label><input className="input" type="number" min={1} max={200} value={s.maxSteps} onChange={(e) => updateSettings({ maxSteps: Math.max(1, Math.min(200, Number(e.target.value) || 40)) })} /></div>
            <div className="field"><label>Shortcut global (tampilkan/sembunyikan)</label><div className="row"><input className="input" value={shortcut} onChange={(e) => setShortcut(e.target.value)} /><button className="btn sm" onClick={() => updateSettings({ globalShortcut: shortcut })}>Terapkan</button></div></div>
            <div className="field"><label>Frame pratinjau Control (per detik)</label><input className="input" type="number" min={0.2} max={4} step={0.2} value={s.controlPreviewFps} onChange={(e) => updateSettings({ controlPreviewFps: Number(e.target.value) || 1 })} /></div>
          </div>
          <label className="row"><Switch label="Notifikasi desktop" checked={s.notifications} onChange={(v) => updateSettings({ notifications: v })} />Notifikasi desktop saat task selesai</label>
          <label className="row"><Switch label="Pembaruan otomatis" checked={s.autoUpdate} onChange={(v) => updateSettings({ autoUpdate: v })} />Periksa pembaruan otomatis saat dibuka</label>
        </div>

        <div className="row"><h3 className="display" style={{ flex: 1 }}>Penyedia AI</h3>
          <button className="btn primary sm" onClick={async () => { const r = await guard(api.provider.save({ name: 'Penyedia baru', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', supportsTools: true, supportsVision: true })); if (r) await refreshAll(); }}><Plus size={14} />Tambah penyedia OpenAI-compatible</button></div>
        {providers.map((p) => <div key={p.id} style={{ display: 'grid', gap: 6 }}><ProviderCard p={p} />{s.activeProviderId !== p.id ? <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => updateSettings({ activeProviderId: p.id })}>Jadikan aktif</button> : <span className="chip ok" style={{ justifySelf: 'start' }}><CheckCircle2 size={12} />Aktif</span>}</div>)}

        <div className="card stack">
          <h3>Tentang</h3>
          <div style={{ color: 'var(--muted)' }}>intelligence.7mit 6 Desktop v{info?.version} • {info?.platform}/{info?.arch} • {info?.packaged ? 'build terpasang' : 'mode pengembangan'}</div>
          <div style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>Data: {info?.userData}</div>
          {system?.encryptionNote && <div className="status-banner warn">{system.encryptionNote}</div>}
          <div className="row"><button className="btn" onClick={async () => setUpd((await guard(api.system.checkUpdate())) ?? '')}>Periksa pembaruan</button>{upd && <span>{upd}</span>}<button className="btn" onClick={() => api.system.openExternal('https://intelligence.7mit.org')}>Situs web</button></div>
        </div>
      </div></div>
    </>
  );
}
