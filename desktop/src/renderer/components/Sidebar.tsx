import { motion } from 'framer-motion';
import { Bot, Code2, Globe, History, MonitorSmartphone, Moon, Pencil, Plus, Search, Settings, ShieldCheck, Square, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AgentMode } from '@shared/types';
import { api } from '@/lib/api';
import { deleteConversation, newConversation, openConversation, renameConversation, setPage, stopAll, store, updateSettings, type Page } from '@/lib/state';
import { ContextMenu, Logo, Modal, Tip } from './ui';

const NAV: { page: Page; label: string; icon: JSX.Element; tag?: string }[] = [
  { page: 'chat', label: 'Chat', icon: <Bot size={18} /> },
  { page: 'code', label: 'Code', icon: <Code2 size={18} /> },
  { page: 'web', label: 'Web', icon: <Globe size={18} /> },
  { page: 'control', label: 'Control', icon: <MonitorSmartphone size={18} />, tag: 'PC' }
];

export function Sidebar() {
  const page = store.use((s) => s.page);
  const convList = store.use((s) => s.convList);
  const conv = store.use((s) => s.conv);
  const tasks = store.use((s) => s.tasks);
  const settings = store.use((s) => s.settings);
  const approvals = store.use((s) => s.approvals);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: string; title: string; snippet: string }[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; title: string } | null>(null);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const running = Object.values(tasks).some((t) => ['running', 'paused', 'waiting_approval'].includes(t.status));

  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    const t = setTimeout(async () => setHits((await api.conv.search({ query: q })) ?? []), 200);
    return () => clearTimeout(t);
  }, [q]);

  const list = hits ? hits.map((h) => ({ id: h.id, title: h.title, mode: convList.find((c) => c.id === h.id)?.mode ?? 'chat', snippet: h.snippet })) : convList.map((c) => ({ id: c.id, title: c.title, mode: c.mode, snippet: '' }));
  const dark = document.documentElement.dataset.theme !== 'light';

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <div className="brand drag">
        <Logo />
        <div><strong>intelligence<span>.7mit</span></strong><small>6 DESKTOP</small></div>
      </div>
      <nav className="nav no-drag">
        {NAV.map((n) => (
          <button key={n.page} className={page === n.page ? 'active' : ''} onClick={() => { setPage(n.page); if (conv && conv.mode !== (n.page as AgentMode)) store.set({ conv: null }); }}>
            {n.icon}{n.label}{n.tag && <span className="tag">{n.tag}</span>}
          </button>
        ))}
      </nav>
      <div className="side-section"><span>Percakapan</span>
        <Tip text="Percakapan baru"><button className="icon-btn" aria-label="Percakapan baru" onClick={() => newConversation((['chat', 'code', 'web', 'control'].includes(page) ? page : 'chat') as AgentMode)}><Plus size={16} /></button></Tip>
      </div>
      <div className="search"><Search size={15} /><input aria-label="Cari percakapan" placeholder="Cari percakapan…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="convs">
        {list.length === 0 && <div style={{ padding: '10px 12px', color: 'var(--faint)', fontSize: '.84rem' }}>{hits ? 'Tidak ada hasil.' : 'Belum ada percakapan.'}</div>}
        {list.map((c) => (
          <motion.button layout key={c.id} className={`conv ${conv?.id === c.id ? 'active' : ''}`} onClick={() => openConversation(c.id)} title={c.snippet || c.title}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, id: c.id, title: c.title }); }}>
            <span className="t">{c.title}</span><span className="m">{c.mode}</span>
          </motion.button>
        ))}
      </div>
      <div className="side-foot">
        <button className={`stop-all ${running ? 'live' : ''}`} onClick={stopAll} aria-label="Stop AI sekarang"><Square size={14} fill="currentColor" />Stop AI{approvals.length ? ` (${approvals.length} menunggu)` : ''}</button>
        <nav className="nav" style={{ padding: 0 }}>
          <button className={page === 'permissions' ? 'active' : ''} onClick={() => setPage('permissions')}><ShieldCheck size={18} />Permission Center</button>
          <button className={page === 'history' ? 'active' : ''} onClick={() => setPage('history')}><History size={18} />Riwayat & Audit</button>
          <div className="row" style={{ gap: 4 }}>
            <button style={{ flex: 1 }} className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Settings size={18} />Pengaturan</button>
            <Tip text={dark ? 'Mode terang' : 'Mode gelap'}><button className="icon-btn" aria-label="Ganti tema" onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></Tip>
          </div>
        </nav>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
        { label: 'Ganti nama', icon: <Pencil size={15} />, onClick: () => setRename({ id: menu.id, title: menu.title }) },
        { label: 'Hapus', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteConversation(menu.id) }
      ]} />}
      {rename && (
        <Modal label="Ganti nama percakapan" onClose={() => setRename(null)}>
          <h3 className="display">Ganti nama percakapan</h3>
          <form className="stack" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); void renameConversation(rename.id, rename.title); setRename(null); }}>
            <input className="input" autoFocus value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} aria-label="Judul" />
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setRename(null)}>Batal</button><button className="btn primary">Simpan</button></div>
          </form>
        </Modal>
      )}
    </aside>
  );
}
