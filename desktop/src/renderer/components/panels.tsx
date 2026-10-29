import { motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, File, FileCode2, Folder, GitCommit, Globe, MonitorOff, MonitorSmartphone, Play, Power, RefreshCw, Save, TerminalSquare, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { FileEntry, GitStatus } from '@shared/types';
import { api, errMsg } from '@/lib/api';
import { guard, setPage, store, stopTask, toast, type PanelTab } from '@/lib/state';
import { DiffView, isLive } from './agent';
import { capsOf, useActiveProvider, useCurrentTask } from './common';
import { Tip } from './ui';

const CodeEditor = lazy(() => import('./CodeEditor'));
const LANG: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', md: 'markdown', py: 'python', css: 'css', html: 'html', yml: 'yaml', yaml: 'yaml', rs: 'rust', go: 'go', java: 'java', sh: 'shell', sql: 'sql', xml: 'xml', c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', rb: 'ruby', php: 'php' };
const langOf = (p: string) => LANG[p.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';

function Tree({ entry, depth, onOpen, refreshKey }: { entry: FileEntry; depth: number; onOpen: (p: string) => void; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState<FileEntry[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { try { setKids((await api.fs.list({ path: entry.path })) ?? []); setErr(''); } catch (e) { setErr(errMsg(e)); } }, [entry.path]);
  useEffect(() => { if (open) void load(); }, [open, refreshKey, load]);
  if (!entry.isDir) return <div className="tree-row" style={{ paddingLeft: 10 + depth * 14 }} onClick={() => onOpen(entry.path)} title={entry.path}><File size={14} color="var(--faint)" />{entry.name}</div>;
  return (
    <>
      <div className="tree-row" style={{ paddingLeft: 4 + depth * 14 }} onClick={() => setOpen(!open)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<Folder size={14} color="var(--blue)" />{entry.name}</div>
      {open && err && <div style={{ paddingLeft: 24, color: 'var(--red)', fontSize: '.76rem' }}>{err}</div>}
      {open && kids?.map((k) => <Tree key={k.path} entry={k} depth={depth + 1} onOpen={onOpen} refreshKey={refreshKey} />)}
    </>
  );
}

interface Tab { path: string; content: string; saved: string }

export function FilesPanel() {
  const workspaces = store.use((s) => s.workspaces);
  const wsId = store.use((s) => s.workspaceId);
  const task = useCurrentTask();
  const ws = workspaces.find((w) => w.id === wsId);
  const [root, setRoot] = useState<FileEntry[] | null>(null);
  const [rootErr, setRootErr] = useState('');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const loadRoot = useCallback(async () => {
    if (!ws) { setRoot(null); return; }
    try { setRoot(await api.fs.list({ path: ws.path })); setRootErr(''); } catch (e) { setRoot(null); setRootErr(errMsg(e)); }
    setRefreshKey((k) => k + 1);
  }, [ws]);
  useEffect(() => { void loadRoot(); }, [loadRoot]);
  useEffect(() => {
    if (task && !isLive(task)) {
      void loadRoot();
      tabs.filter((t) => t.content === t.saved).forEach(async (t) => { const r = await api.fs.read({ path: t.path }).catch(() => null); if (r && r.content !== t.saved) setTabs((x) => x.map((y) => (y.path === t.path ? { path: t.path, content: r.content, saved: r.content } : y))); });
    }
  }, [task?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (p: string) => {
    if (!tabs.find((t) => t.path === p)) { const r = await guard(api.fs.read({ path: p })); if (!r) return; setTabs((t) => [...t, { path: p, content: r.content, saved: r.content }]); }
    setActive(p);
  };
  const cur = tabs.find((t) => t.path === active);
  const save = async () => { if (!cur) return; try { await api.fs.write({ path: cur.path, content: cur.content }); setTabs((t) => t.map((x) => (x.path === cur.path ? { ...x, saved: x.content } : x))); toast('success', 'Tersimpan'); } catch (e) { toast('error', errMsg(e)); } };
  const dark = document.documentElement.dataset.theme !== 'light';
  return (
    <div className="files">
      <div className="explorer" aria-label="File explorer">
        <div className="row" style={{ padding: '8px 10px', fontWeight: 700, fontSize: '.8rem', color: 'var(--muted)' }}><Folder size={14} />{ws?.name ?? 'Berkas'}<span className="spacer" /><button className="icon-btn" style={{ width: 24, height: 24 }} aria-label="Segarkan" onClick={loadRoot}><RefreshCw size={13} /></button></div>
        {!ws && <div style={{ padding: 12, color: 'var(--muted)' }}>Pilih proyek di composer.</div>}
        {rootErr && <div style={{ padding: 12, color: 'var(--red)', fontSize: '.8rem' }}>{rootErr}<br /><button className="btn sm" style={{ marginTop: 8 }} onClick={() => setPage('permissions')}>Permission Center</button></div>}
        {root?.map((e) => <Tree key={e.path} entry={e} depth={0} onOpen={open} refreshKey={refreshKey} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div className="etabs" role="tablist">
          {tabs.map((t) => <div key={t.path} role="tab" aria-selected={t.path === active} className={`etab ${t.path === active ? 'on' : ''}`} onClick={() => setActive(t.path)}>{t.path.split(/[\\/]/).pop()}{t.content !== t.saved && ' ●'}<button className="icon-btn" style={{ width: 20, height: 20 }} aria-label="Tutup tab" onClick={(e) => { e.stopPropagation(); if (t.content !== t.saved && !confirm('Perubahan belum disimpan. Tutup?')) return; setTabs((x) => x.filter((y) => y.path !== t.path)); if (active === t.path) setActive(''); }}><X size={12} /></button></div>)}
          <span className="spacer" />{cur && <button className="btn sm" style={{ margin: 4 }} onClick={save} disabled={cur.content === cur.saved}><Save size={13} />Simpan</button>}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {cur ? <Suspense fallback={<div className="empty"><div style={{ color: 'var(--muted)' }}>Memuat editor…</div></div>}><CodeEditor path={cur.path} language={langOf(cur.path)} value={cur.content} theme={dark ? 'it7-dark' : 'vs'} onChange={(v) => setTabs((t) => t.map((x) => (x.path === cur.path ? { ...x, content: v ?? '' } : x)))}
            onMount={(ed, m) => { ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => document.getElementById('save-hidden')?.click()); }}
            options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, fontFamily: 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace' }} /></Suspense>
            : <div className="empty"><div style={{ textAlign: 'center', color: 'var(--muted)' }}><FileCode2 size={34} /><p>Pilih berkas dari daftar.</p></div></div>}
          <button id="save-hidden" hidden onClick={save} />
        </div>
      </div>
    </div>
  );
}

export function ChangesPanel() {
  const wsId = store.use((s) => s.workspaceId);
  const task = useCurrentTask();
  const [git, setGit] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState('');
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => { if (!wsId) return; const g = await guard(api.git.status({ workspaceId: wsId })); if (g) { setGit(g); setDiff((await guard(api.git.diff({ workspaceId: wsId }))) ?? ''); } }, [wsId]);
  useEffect(() => { void load(); }, [load, task?.status]);
  return (
    <div className="stack" style={{ padding: 14, overflow: 'auto', alignContent: 'start' }}>
      <div className="row"><b>{git?.isRepo ? `Cabang: ${git.branch}` : 'Bukan repositori Git'}</b><span className="spacer" /><button className="icon-btn" aria-label="Segarkan" onClick={load}><RefreshCw size={15} /></button></div>
      {git?.files.map((f) => <div key={f.path} className="row" style={{ fontSize: '.84rem' }}><span className="chip">{f.status}</span>{f.path}</div>)}
      {git?.isRepo && !git.files.length && <span style={{ color: 'var(--muted)' }}>Tidak ada perubahan.</span>}
      {diff && <DiffView text={diff} />}
      {git?.isRepo && git.files.length > 0 && (
        <div className="row"><input className="input" placeholder="Pesan commit" aria-label="Pesan commit" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className="btn primary" disabled={!msg.trim()} onClick={async () => { if (!confirm(`Commit semua perubahan (${git.files.length} berkas)?\n\n${msg}`)) return; const r = await guard(api.git.commit({ workspaceId: wsId!, message: msg })); if (r) { toast('success', 'Commit dibuat'); setMsg(''); void load(); } }}><GitCommit size={15} />Commit</button></div>
      )}
    </div>
  );
}

export function TerminalPanel() {
  const wsId = store.use((s) => s.workspaceId);
  const [id, setId] = useState<string | null>(null);
  const [out, setOut] = useState('');
  const [line, setLine] = useState('');
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => api.term.onData((p) => { setOut((o) => (o + p.data).slice(-60000)); }), []);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [out]);
  useEffect(() => () => { if (id) void api.term.kill({ id }); }, [id]);
  const start = async () => { if (!wsId) return toast('error', 'Pilih proyek dulu'); const tid = await guard(api.term.start({ workspaceId: wsId })); if (tid) { setId(tid); setOut(''); } };
  return (
    <div className="term">
      <div className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}><TerminalSquare size={15} /><b style={{ fontSize: '.85rem' }}>Terminal</b><span className="chip">tanpa PTY</span><span className="spacer" />
        {id ? <button className="btn sm" onClick={() => { void api.term.kill({ id }); setId(null); }}>Tutup</button> : <button className="btn sm primary" onClick={start}>Mulai shell</button>}</div>
      <pre ref={ref} aria-label="Output terminal">{out || (id ? '' : 'Terminal belum dimulai. Perlu izin Terminal dan folder proyek yang diizinkan.')}</pre>
      <input disabled={!id} placeholder={id ? '$ ketik perintah lalu Enter' : ''} value={line} aria-label="Input terminal" onChange={(e) => setLine(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && id) { void api.term.write({ id, data: line + '\n' }); setOut((o) => o + `$ ${line}\n`); setLine(''); } }} />
    </div>
  );
}

export function BrowserPanel() {
  const frame = store.use((s) => s.browserFrame);
  const task = useCurrentTask();
  const perms = store.use((s) => s.permissions);
  const [url, setUrl] = useState('');
  const [state, setState] = useState<{ open: boolean; tabs: { index: number; url: string; active: boolean }[] }>({ open: false, tabs: [] });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const refresh = async () => setState((await api.browser.state()) ?? { open: false, tabs: [] });
  useEffect(() => { void refresh(); const t = setInterval(refresh, 2500); return () => clearInterval(t); }, []);
  const go = async () => {
    if (!url.trim()) return;
    if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim())) { setPreview(/^https?:/i.test(url.trim()) ? url.trim() : `http://${url.trim()}`); return; }
    setPreview(''); setBusy(true); await guard(api.browser.navigate({ url })); setBusy(false); void refresh();
  };
  return (
    <div className="pane" style={{ padding: 12, gap: 10 }}>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <Globe size={16} color="var(--blue)" />
        <input className="input" placeholder="Alamat — localhost tampil langsung; situs lain lewat browser terisolasi" aria-label="Alamat URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn" disabled={busy}><RefreshCw size={14} className={busy ? 'spin' : ''} />Buka</button>
        <Tip text="Tutup browser terisolasi"><button type="button" className="icon-btn" aria-label="Tutup browser" onClick={async () => { await api.browser.close(); store.set({ browserFrame: null }); setPreview(''); void refresh(); }}><Power size={16} /></button></Tip>
      </form>
      <div className="row wrap">
        <span className={`chip ${state.open ? 'ok' : ''}`}><span className={`dot ${state.open ? 'live' : ''}`} />{state.open ? 'Browser aktif (sesi terisolasi)' : 'Browser belum dibuka'}</span>
        {!perms.grants.browser && <button className="chip warn" onClick={() => setPage('permissions')}>Izin Browser belum diberikan</button>}
        {state.tabs.map((t) => <span key={t.index} className={`chip ${t.active ? 'blue' : ''}`} title={t.url}>Tab {t.index}: {t.url.replace(/^https?:\/\//, '').slice(0, 26)}</span>)}
      </div>
      {preview ? <iframe title="Live preview" src={preview} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" style={{ flex: 1, width: '100%', border: '1px solid var(--line2)', borderRadius: 12, background: '#fff' }} /> : (
        <div className="screen">
          {frame && state.open ? <div className="screen-inner"><img src={frame} alt="Tampilan browser agen" />{isLive(task) && <div className="scan" />}</div>
            : <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}><Globe size={36} /><p>Aktivitas browser tampil real-time di sini.<br />Sesi terisolasi: tidak memakai cookie atau login Chrome/Edge Anda.</p></div>}
        </div>
      )}
    </div>
  );
}

/** Kursor AI: panah hitam bergaya (garis abu + cincin putih). Titik tunjuk = ujung kiri-atas. */
function AgentCursor({ x, y, action }: { x: number; y: number; action: string }) {
  const d = 'M683 303 L930 385 Q945 392 938 412 Q934 424 925 428 L825 477 L778 583 Q765 600 748 592 Q740 588 738 580 L662 330 Q658 312 683 303 Z';
  return (
    <motion.div className="agent-cursor" aria-label={`Kursor AI (${action})`} title={`Kursor AI: ${action}`}
      initial={false} animate={{ left: `${x}%`, top: `${y}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 0.9 }}>
      <svg viewBox="620 260 360 380" width="34" height="36" style={{ overflow: 'visible', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.45))' }}>
        <path d={d} fill="#fff" stroke="#fff" strokeWidth="44" strokeLinejoin="round" />
        <path d={d} fill="#ccc" stroke="#ccc" strokeWidth="24" strokeLinejoin="round" />
        <path d={d} fill="#080808" />
      </svg>
    </motion.div>
  );
}

export function ScreenPanel() {
  const frame = store.use((s) => s.frame);
  const target = store.use((s) => s.target);
  const capture = store.use((s) => s.capture);
  const perms = store.use((s) => s.permissions);
  const system = store.use((s) => s.system);
  const caps = store.use((s) => s.caps);
  const p = useActiveProvider();
  const c = capsOf(p);
  const task = useCurrentTask();
  const live = isLive(task) && !!task?.caps?.computer;
  const [ripple, setRipple] = useState(0);
  useEffect(() => { if (target?.action === 'click' || target?.action === 'drag') setRipple(target.at); }, [target]);
  const px = target ? (target.x / target.width) * 100 : 0;
  const py = target ? (target.y / target.height) * 100 : 0;
  const blockers: string[] = [];
  if (!caps.computer) blockers.push('Kemampuan "Komputer" belum diaktifkan di composer.');
  if (!c.tools || !c.vision) blockers.push('Penyedia/model aktif harus mendukung tool calling dan vision.');
  if (!perms.grants.screen) blockers.push('Izin Screen observation belum diberikan.');
  if (!perms.grants.input) blockers.push('Izin Mouse & keyboard belum diberikan (AI hanya bisa melihat).');
  if (!perms.allowScreenshotUpload) blockers.push('Pengiriman screenshot ke penyedia AI belum diizinkan.');
  if (system && !system.input.available) blockers.push(`Otomasi input OS tidak tersedia: ${system.input.reason}`);
  return (
    <div className="pane" style={{ padding: 12, gap: 10 }}>
      <div className="row wrap">
        <span className={`chip ${capture.active ? 'ok' : ''}`}><span className={`dot ${capture.active ? 'live' : ''}`} />{capture.active ? 'Menangkap layar' : 'Tidak menangkap layar'}</span>
        {capture.reason && <span className="chip bad" title={capture.reason}><AlertTriangle size={12} />{capture.reason.slice(0, 60)}</span>}
        <span className="chip">Pratinjau lokal — tidak dikirim ke AI</span>
      </div>
      {blockers.length > 0 && !live && (
        <div className="stack" style={{ gap: 6 }}>
          {blockers.map((b) => <div key={b} className="status-banner warn"><AlertTriangle size={15} />{b}</div>)}
          <div className="row"><button className="btn sm" onClick={() => setPage('permissions')}>Permission Center</button><button className="btn sm" onClick={() => setPage('settings')}>Penyedia AI</button></div>
        </div>
      )}
      <div className="screen" aria-label="Pratinjau layar langsung">
        {frame ? (
          <div className="screen-inner">
            <img src={frame.dataUrl} alt="Layar komputer saat ini" draggable={false} />
            {capture.active && <div className="scan" />}
            {live && <div className="control-pill" role="status"><span className="dot live" />intelligence.7mit sedang mengontrol<button onClick={() => task && stopTask(task.id)}>Berhenti</button></div>}
            {target && ripple > 0 && <div key={ripple} className="ripple" style={{ left: `${px}%`, top: `${py}%` }} />}
            {target && <AgentCursor x={px} y={py} action={target.action} />}
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}><MonitorOff size={36} /><p>Belum ada tangkapan layar.<br />Aktifkan <b>Komputer</b> di composer lalu beri perintah.</p></div>
        )}
      </div>
    </div>
  );
}

export const PANEL_TABS: { id: PanelTab; label: string; icon: JSX.Element }[] = [
  { id: 'files', label: 'Berkas', icon: <FileCode2 size={14} /> },
  { id: 'changes', label: 'Perubahan', icon: <GitCommit size={14} /> },
  { id: 'terminal', label: 'Terminal', icon: <TerminalSquare size={14} /> },
  { id: 'browser', label: 'Peramban', icon: <Globe size={14} /> },
  { id: 'screen', label: 'Layar', icon: <MonitorSmartphone size={14} /> }
];
export { ExternalLink, Play };
