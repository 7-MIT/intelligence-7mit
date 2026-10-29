import Editor from '@monaco-editor/react';
import { ChevronDown, ChevronRight, File, Folder, GitCommit, RefreshCw, Save, X, ExternalLink, Play, TerminalSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeSubmode, FileEntry, GitStatus } from '@shared/types';
import { Timeline, PlanList, StatusPill } from '@/components/agent';
import { ModelBar, WorkspaceSelect, useCurrentTask } from '@/components/common';
import { Dropdown, Tip } from '@/components/ui';
import { api, errMsg } from '@/lib/api';
import '@/lib/monaco';
import { guard, setPage, store, toast } from '@/lib/state';
import { ChatPane } from './ChatPage';
import { DiffView } from '@/components/agent';

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

function Terminal({ workspaceId }: { workspaceId?: string }) {
  const [id, setId] = useState<string | null>(null);
  const [out, setOut] = useState('');
  const [line, setLine] = useState('');
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => api.term.onData((p) => { setOut((o) => (o + p.data).slice(-60000)); }), []);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [out]);
  useEffect(() => () => { if (id) void api.term.kill({ id }); }, [id]);
  const start = async () => { if (!workspaceId) return toast('error', 'Pilih workspace dulu'); const tid = await guard(api.term.start({ workspaceId })); if (tid) { setId(tid); setOut(''); } };
  return (
    <div className="term">
      <div className="panel-h"><TerminalSquare size={15} />Terminal<span className="chip">tanpa PTY</span><span className="spacer" />
        {id ? <button className="btn sm" onClick={() => { void api.term.kill({ id }); setId(null); }}>Tutup</button> : <button className="btn sm primary" onClick={start}>Mulai shell</button>}
      </div>
      <pre ref={ref} aria-label="Output terminal">{out || (id ? '' : 'Terminal belum dimulai. Perlu izin Terminal dan folder workspace yang diizinkan.')}</pre>
      <input disabled={!id} placeholder={id ? '$ ketik perintah lalu Enter' : ''} value={line} aria-label="Input terminal" onChange={(e) => setLine(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && id) { void api.term.write({ id, data: line + '\n' }); setOut((o) => o + `$ ${line}\n`); setLine(''); } }} />
    </div>
  );
}

function SidePanel({ workspaceId }: { workspaceId?: string }) {
  const [tab, setTab] = useState<'chat' | 'timeline' | 'git' | 'preview'>('chat');
  const task = useCurrentTask('code');
  const timelines = store.use((s) => s.timelines);
  const plans = store.use((s) => s.plans);
  const [git, setGit] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState('');
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState('http://localhost:3000');
  const [frame, setFrame] = useState('');
  const loadGit = useCallback(async () => { if (!workspaceId) return; const g = await guard(api.git.status({ workspaceId })); if (g) { setGit(g); setDiff((await guard(api.git.diff({ workspaceId }))) ?? ''); } }, [workspaceId]);
  useEffect(() => { if (tab === 'git') void loadGit(); }, [tab, loadGit]);
  const submode = store.use((s) => s.submode);
  return (
    <div className="panel" style={{ borderLeft: '1px solid var(--line)' }}>
      <div className="tabs" role="tablist">{(['chat', 'timeline', 'git', 'preview'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ chat: 'Agen', timeline: 'Aktivitas', git: 'Git & Diff', preview: 'Preview' }[t]}</button>)}</div>
      {tab === 'chat' && <div style={{ flex: 1, minHeight: 0 }}>
        <ChatPane mode="code" placeholder={submode === 'plan' ? 'Minta rencana (tanpa mengubah apa pun)…' : 'Contoh: buat website portofolio sederhana, jalankan, dan perbaiki error'} hint="Agen membaca proyek, mengusulkan perubahan dengan diff, menjalankan build/test, dan memperbaiki error — selalu atas persetujuan Anda." />
      </div>}
      {tab === 'timeline' && <>{task && <PlanList steps={plans[task.id]} />}<Timeline events={task ? timelines[task.id] ?? [] : []} /></>}
      {tab === 'git' && (
        <div className="stack" style={{ padding: 12, overflow: 'auto' }}>
          <div className="row"><b>{git?.isRepo ? `Branch: ${git.branch}` : 'Bukan repositori Git'}</b><span className="spacer" /><button className="icon-btn" aria-label="Segarkan" onClick={loadGit}><RefreshCw size={15} /></button></div>
          {git?.files.map((f) => <div key={f.path} className="row" style={{ fontSize: '.84rem' }}><span className="chip">{f.status}</span>{f.path}</div>)}
          {git?.isRepo && !git.files.length && <span style={{ color: 'var(--muted)' }}>Tidak ada perubahan.</span>}
          {diff && <DiffView text={diff} />}
          {git?.isRepo && git.files.length > 0 && (
            <div className="row"><input className="input" placeholder="Pesan commit" aria-label="Pesan commit" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <button className="btn primary" disabled={!msg.trim()} onClick={async () => { if (!confirm(`Commit semua perubahan (${git.files.length} berkas)?\n\n${msg}`)) return; const r = await guard(api.git.commit({ workspaceId: workspaceId!, message: msg })); if (r) { toast('success', 'Commit dibuat'); setMsg(''); void loadGit(); } }}><GitCommit size={15} />Commit</button></div>
          )}
        </div>
      )}
      {tab === 'preview' && (
        <div className="stack" style={{ padding: 12, flex: 1, minHeight: 0, gridTemplateRows: 'auto 1fr' }}>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)) return toast('error', 'Preview hanya untuk localhost / 127.0.0.1'); setFrame(url); }}>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL preview" /><button className="btn"><Play size={14} />Muat</button>
            <Tip text="Buka di browser agen"><button type="button" className="icon-btn" aria-label="Buka di Web" onClick={() => setPage('web')}><ExternalLink size={15} /></button></Tip>
          </form>
          {frame ? <iframe title="Live preview" src={frame} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" style={{ width: '100%', height: '100%', border: '1px solid var(--line2)', borderRadius: 12, background: '#fff' }} /> : <span style={{ color: 'var(--muted)' }}>Jalankan dev server (mis. lewat agen atau terminal) lalu muat URL localhost-nya di sini.</span>}
        </div>
      )}
    </div>
  );
}

export function CodePage() {
  const workspaces = store.use((s) => s.workspaces);
  const wsId = store.use((s) => s.workspaceId);
  const submode = store.use((s) => s.submode);
  const task = useCurrentTask('code');
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
  // Segarkan explorer & tab yang tidak diubah saat agen selesai bekerja.
  useEffect(() => {
    if (task && !['running', 'paused', 'waiting_approval'].includes(task.status)) {
      void loadRoot();
      tabs.filter((t) => t.content === t.saved).forEach(async (t) => { const r = await api.fs.read({ path: t.path }).catch(() => null); if (r && r.content !== t.saved) setTabs((x) => x.map((y) => (y.path === t.path ? { path: t.path, content: r.content, saved: r.content } : y))); });
    }
  }, [task?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (p: string) => {
    if (!tabs.find((t) => t.path === p)) {
      const r = await guard(api.fs.read({ path: p }));
      if (!r) return;
      setTabs((t) => [...t, { path: p, content: r.content, saved: r.content }]);
    }
    setActive(p);
  };
  const cur = tabs.find((t) => t.path === active);
  const save = async () => { if (!cur) return; if (await guard(api.fs.write({ path: cur.path, content: cur.content })).then(() => true).catch(() => false)) { setTabs((t) => t.map((x) => (x.path === cur.path ? { ...x, saved: x.content } : x))); toast('success', 'Tersimpan'); } };
  const dark = document.documentElement.dataset.theme !== 'light';

  return (
    <>
      <div className="topbar"><h2 className="display">Code</h2><WorkspaceSelect />
        <div className="seg" role="group" aria-label="Sub-mode">{(['plan', 'edit', 'agent'] as CodeSubmode[]).map((m) => <Tip key={m} text={{ plan: 'Hanya analisis & rencana — tanpa perubahan', edit: 'Boleh mengedit berkas, tanpa terminal', agent: 'Mandiri: edit + jalankan perintah' }[m]}><button className={submode === m ? 'on' : ''} onClick={() => store.set({ submode: m })}>{m[0].toUpperCase() + m.slice(1)}</button></Tip>)}</div>
        <ModelBar mode="code" /><StatusPill task={task} /></div>
      <div className="page" style={{ overflow: 'hidden' }}>
        <div className="code">
          <div className="explorer" aria-label="File explorer">
            <div className="panel-h"><Folder size={15} />{ws?.name ?? 'Explorer'}<span className="spacer" /><button className="icon-btn" aria-label="Segarkan" onClick={loadRoot}><RefreshCw size={14} /></button></div>
            {!ws && <div style={{ padding: 14, color: 'var(--muted)' }}>Tambahkan workspace (ikon + di atas) untuk mulai.</div>}
            {rootErr && <div style={{ padding: 14, color: 'var(--red)', fontSize: '.82rem' }}>{rootErr}<br /><button className="btn sm" style={{ marginTop: 8 }} onClick={() => setPage('permissions')}>Buka Permission Center</button></div>}
            {root?.map((e) => <Tree key={e.path} entry={e} depth={0} onOpen={open} refreshKey={refreshKey} />)}
          </div>
          <div className="code-mid">
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="etabs" role="tablist">
                {tabs.map((t) => <div key={t.path} role="tab" aria-selected={t.path === active} className={`etab ${t.path === active ? 'on' : ''}`} onClick={() => setActive(t.path)}>{t.path.split(/[\\/]/).pop()}{t.content !== t.saved && ' ●'}<button className="icon-btn" style={{ width: 20, height: 20 }} aria-label="Tutup tab" onClick={(e) => { e.stopPropagation(); if (t.content !== t.saved && !confirm('Perubahan belum disimpan. Tutup?')) return; setTabs((x) => x.filter((y) => y.path !== t.path)); if (active === t.path) setActive(''); }}><X size={12} /></button></div>)}
                <span className="spacer" />{cur && <button className="btn sm" style={{ margin: 4 }} onClick={save} disabled={cur.content === cur.saved}><Save size={14} />Simpan</button>}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {cur ? <Editor path={cur.path} language={langOf(cur.path)} value={cur.content} theme={dark ? 'it7-dark' : 'vs'} onChange={(v) => setTabs((t) => t.map((x) => (x.path === cur.path ? { ...x, content: v ?? '' } : x)))}
                  onMount={(ed, m) => { ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => document.getElementById('save-hidden')?.click()); }}
                  options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, fontFamily: 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace' }} />
                  : <div className="empty"><div><File size={36} color="var(--faint)" /><p>Pilih berkas dari explorer.</p></div></div>}
                <button id="save-hidden" hidden onClick={save} />
              </div>
            </div>
            <Terminal workspaceId={wsId} />
          </div>
          <SidePanel workspaceId={wsId} />
        </div>
      </div>
    </>
  );
}
