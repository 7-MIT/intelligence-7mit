import { motion } from 'framer-motion';
import { Bot, Code2, FolderGit2, History, Moon, Pencil, Search, Settings, ShieldCheck, SquarePen, Square, Sun, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { activeTaskFor, deleteConversation, isCodeConv, newConversation, openConversation, renameConversation, setPage, stopAll, store, updateSettings } from '@/lib/state';
import { ContextMenu, Logo, Modal, Tip } from './ui';

type Item = { id: string; title: string; mode: string; updatedAt: number; workspaceId?: string; snippet: string };

function dateGroup(t: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = 86400000;
  if (t >= d.getTime()) return 'Hari ini';
  if (t >= d.getTime() - day) return 'Kemarin';
  if (t >= d.getTime() - 7 * day) return '7 hari terakhir';
  return 'Lebih lama';
}

export function Sidebar() {
  const page = store.use((s) => s.page);
  const convList = store.use((s) => s.convList);
  const conv = store.use((s) => s.conv);
  const tasks = store.use((s) => s.tasks);
  const approvals = store.use((s) => s.approvals);
  const workspaces = store.use((s) => s.workspaces);
  const info = store.use((s) => s.info);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: string; title: string; snippet: string }[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; title: string } | null>(null);
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const family = page === 'code' ? 'code' : 'chat';
  const running = Object.values(tasks).some((t) => ['running', 'paused', 'waiting_approval'].includes(t.status));

  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    const t = setTimeout(async () => setHits((await api.conv.search({ query: q })) ?? []), 200);
    return () => clearTimeout(t);
  }, [q]);

  const items: Item[] = useMemo(() => {
    const base = convList.filter((c) => (family === 'code') === isCodeConv(c.mode)).map((c) => ({ id: c.id, title: c.title, mode: c.mode, updatedAt: c.updatedAt, workspaceId: c.workspaceId, snippet: '' }));
    if (!hits) return base;
    const ids = new Set(hits.map((h) => h.id));
    return base.filter((c) => ids.has(c.id)).map((c) => ({ ...c, snippet: hits.find((h) => h.id === c.id)?.snippet ?? '' }));
  }, [convList, hits, family]);

  const groups: { label: string; icon?: boolean; items: Item[] }[] = useMemo(() => {
    if (family === 'code') {
      const out = workspaces.map((w) => ({ label: w.name, icon: true, items: items.filter((i) => i.workspaceId === w.id) })).filter((g) => g.items.length || !hits);
      const orphan = items.filter((i) => !workspaces.some((w) => w.id === i.workspaceId));
      if (orphan.length) out.push({ label: 'Tanpa proyek', icon: false, items: orphan });
      return out;
    }
    const order = ['Hari ini', 'Kemarin', '7 hari terakhir', 'Lebih lama'];
    return order.map((label) => ({ label, items: items.filter((i) => dateGroup(i.updatedAt) === label) })).filter((g) => g.items.length);
  }, [items, family, workspaces, hits]);

  const dark = document.documentElement.dataset.theme !== 'light';
  const pickMode = (m: 'chat' | 'code') => { if (page !== m) { setPage(m); if (conv && isCodeConv(conv.mode) !== (m === 'code')) store.set({ conv: null }); } };

  return (
    <aside className={`sidebar ${info?.platform === 'darwin' ? 'mac-pad' : ''}`} aria-label="Navigasi utama">
      <div className="sb-head drag"><Logo size={28} /><strong>intelligence<span>.7mit</span></strong></div>
      <div className="modeseg no-drag" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected={family === 'chat' && (page === 'chat')} className={page === 'chat' ? 'on' : ''} onClick={() => pickMode('chat')}><Bot size={16} />Chat</button>
        <button role="tab" aria-selected={page === 'code'} className={page === 'code' ? 'on' : ''} onClick={() => pickMode('code')}><Code2 size={16} />Code</button>
      </div>
      <button className="sb-new" onClick={() => newConversation(family)}><SquarePen size={16} />{family === 'code' ? 'Task baru' : 'Chat baru'}</button>
      <div className="sb-search"><Search size={15} /><input aria-label="Cari percakapan" placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="sb-list">
        {groups.length === 0 && <div style={{ padding: '10px 10px', color: 'var(--faint)', fontSize: '.84rem' }}>{hits ? 'Tidak ada hasil.' : family === 'code' ? 'Belum ada task.' : 'Belum ada percakapan.'}</div>}
        {groups.map((g) => (
          <div key={g.label}>
            <div className="sb-group">{g.icon !== undefined && <FolderGit2 size={13} />}{g.label}</div>
            {g.items.length === 0 && <div style={{ padding: '2px 10px 4px', color: 'var(--faint)', fontSize: '.8rem' }}>Belum ada task</div>}
            {g.items.map((c) => (
              <motion.button layout key={c.id} className={`sb-item ${conv?.id === c.id && (page === 'chat' || page === 'code') ? 'on' : ''}`} onClick={() => openConversation(c.id)} title={c.snippet || c.title}
                onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, id: c.id, title: c.title }); }}>
                <span className="t">{c.title}</span>{activeTaskFor(c.id) && <span className="live" aria-label="Sedang berjalan" />}
              </motion.button>
            ))}
          </div>
        ))}
      </div>
      <div className="sb-foot">
        <button className={`stop-all ${running ? 'live' : ''}`} onClick={stopAll} aria-label="Stop AI sekarang"><Square size={13} fill="currentColor" />Stop AI{approvals.length ? ` (${approvals.length} menunggu)` : ''}</button>
        <button className={`sb-item ${page === 'permissions' ? 'on' : ''}`} onClick={() => setPage('permissions')}><ShieldCheck size={16} />Permission Center</button>
        <button className={`sb-item ${page === 'history' ? 'on' : ''}`} onClick={() => setPage('history')}><History size={16} />Riwayat & Audit</button>
        <div className="row" style={{ gap: 2 }}>
          <button className={`sb-item ${page === 'settings' ? 'on' : ''}`} style={{ flex: 1 }} onClick={() => setPage('settings')}><Settings size={16} />Pengaturan</button>
          <Tip text={dark ? 'Mode terang' : 'Mode gelap'}><button className="icon-btn" aria-label="Ganti tema" onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></Tip>
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
        { label: 'Ganti nama', icon: <Pencil size={15} />, onClick: () => setRename({ id: menu.id, title: menu.title }) },
        { label: 'Hapus', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteConversation(menu.id) }
      ]} />}
      {rename && (
        <Modal label="Ganti nama" onClose={() => setRename(null)}>
          <h3>Ganti nama</h3>
          <form className="stack" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); void renameConversation(rename.id, rename.title); setRename(null); }}>
            <input className="input" autoFocus value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} aria-label="Judul" />
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn" onClick={() => setRename(null)}>Batal</button><button className="btn primary">Simpan</button></div>
          </form>
        </Modal>
      )}
    </aside>
  );
}
