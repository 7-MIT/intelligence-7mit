import { AlertTriangle, Eye, FolderGit2, Globe, Lock, MonitorSmartphone, Pencil, Plus, ShieldCheck, Sparkles, Zap, Cpu, Map, Bot } from 'lucide-react';
import { useMemo } from 'react';
import type { CodeSubmode, ExecutionMode, ProviderConfig, TaskSummary } from '@shared/types';
import { api } from '@/lib/api';
import { activeTaskFor, guard, refreshAll, setPage, store, updatePermissions, updateSettings } from '@/lib/state';
import { Dropdown, Tip } from './ui';

export const capsOf = (p?: ProviderConfig) => ({
  tools: !!p && p.kind === 'openai' && p.supportsTools,
  vision: !!p && p.kind === 'openai' && p.supportsVision
});

export function useActiveProvider() {
  const providers = store.use((s) => s.providers);
  const settings = store.use((s) => s.settings);
  return providers.find((x) => x.id === settings.activeProviderId) ?? providers[0];
}

/** Task terbaru milik percakapan aktif (yang berjalan diprioritaskan). */
export function useCurrentTask(): TaskSummary | undefined {
  const conv = store.use((s) => s.conv);
  const tasks = store.use((s) => s.tasks);
  const taskConv = store.use((s) => s.taskConv);
  return useMemo(() => {
    if (!conv) return undefined;
    const live = activeTaskFor(conv.id);
    if (live) return live;
    return Object.values(tasks).filter((t) => taskConv[t.id] === conv.id).sort((a, b) => b.startedAt - a.startedAt)[0];
  }, [conv, tasks, taskConv]);
}

export function ModelPicker() {
  const providers = store.use((s) => s.providers);
  const p = useActiveProvider();
  return (
    <Dropdown label="Pilih model" placement="up" alignRight value={p?.id ?? ''} onChange={(id) => (id === '__settings' ? setPage('settings') : updateSettings({ activeProviderId: id }))}
      prefix={<Cpu size={14} />}
      options={[
        ...providers.map((x) => ({ value: x.id, label: x.kind === 'openai' ? x.model : 'intelligence.7mit', hint: x.kind === 'openai' ? x.name : 'Backend bawaan · chat teks', icon: <Cpu size={15} /> })),
        { value: '__settings', label: 'Kelola penyedia…', icon: <Plus size={15} />, separatorBefore: true }
      ]} />
  );
}

const SUBS: { value: CodeSubmode; label: string; hint: string; icon: JSX.Element }[] = [
  { value: 'plan', label: 'Plan', hint: 'Hanya analisis & rencana, tanpa mengubah apa pun', icon: <Map size={15} /> },
  { value: 'edit', label: 'Edit', hint: 'Boleh membaca & mengedit berkas, tanpa terminal', icon: <Pencil size={15} /> },
  { value: 'agent', label: 'Agent', hint: 'Mandiri: edit, jalankan perintah, web, komputer', icon: <Bot size={15} /> }
];
export function SubmodePicker() {
  const sub = store.use((s) => s.submode);
  return <Dropdown label="Sub-mode Code" placement="up" value={sub} onChange={(v) => store.set({ submode: v })} options={SUBS} />;
}

export function ExecModePicker() {
  const perms = store.use((s) => s.permissions);
  const opts: { value: ExecutionMode; label: string; hint: string; icon: JSX.Element }[] = [
    { value: 'readonly', label: 'Hanya baca', hint: 'AI hanya mengamati', icon: <Eye size={15} /> },
    { value: 'ask', label: 'Tanya dulu', hint: 'Persetujuan sebelum setiap tindakan yang mengubah sesuatu', icon: <ShieldCheck size={15} /> },
    { value: 'auto', label: 'Otomatis (risiko rendah)', hint: 'Hanya di workspace yang disetujui; risiko menengah/tinggi tetap bertanya', icon: <Zap size={15} /> }
  ];
  return <Dropdown label="Mode izin" placement="up" value={perms.mode} onChange={(m) => updatePermissions({ mode: m })} options={opts} />;
}

/** Toggle kemampuan agen di dalam Code. */
export function CapPills() {
  const caps = store.use((s) => s.caps);
  const sub = store.use((s) => s.submode);
  const p = useActiveProvider();
  const c = capsOf(p);
  const toggle = (k: 'web' | 'computer') => store.set((s) => ({ caps: { ...s.caps, [k]: !s.caps[k] } }));
  const computerOk = c.tools && c.vision && sub === 'agent';
  const computerTip = !c.tools ? 'Penyedia tidak mendukung tool calling' : !c.vision ? 'Model tidak ditandai mendukung vision (dibutuhkan untuk membaca layar)' : sub !== 'agent' ? 'Hanya pada sub-mode Agent' : 'Izinkan AI melihat layar & mengontrol mouse/keyboard (atas izin Anda)';
  return (
    <>
      <Tip text={c.tools ? 'Izinkan AI memakai browser terisolasi' : 'Penyedia tidak mendukung tool calling'}>
        <button className={`pill ${caps.web ? 'on' : ''}`} aria-pressed={caps.web} disabled={!c.tools} onClick={() => toggle('web')}><Globe size={14} /><span className="pt">Web</span></button>
      </Tip>
      <Tip text={computerTip}>
        <button className={`pill ${caps.computer && computerOk ? 'on' : ''}`} aria-pressed={caps.computer} disabled={!computerOk} onClick={() => toggle('computer')}><MonitorSmartphone size={14} /><span className="pt">Komputer</span></button>
      </Tip>
    </>
  );
}

export function WorkspacePicker({ placement = 'up' }: { placement?: 'up' | 'down' }) {
  const workspaces = store.use((s) => s.workspaces);
  const id = store.use((s) => s.workspaceId);
  const perms = store.use((s) => s.permissions);
  const add = async () => {
    const folder = await guard(api.ws.pick());
    if (!folder) return;
    const name = folder.split(/[\\/]/).filter(Boolean).pop() ?? 'workspace';
    const w = await guard(api.ws.add({ name, path: folder }));
    if (!w) return;
    if (!perms.allowedFolders.includes(folder)) await updatePermissions({ allowedFolders: [...perms.allowedFolders, folder] });
    await refreshAll();
    store.set({ workspaceId: w.id });
  };
  const w = workspaces.find((x) => x.id === id);
  const allowed = !!w && perms.allowedFolders.includes(w.path);
  return (
    <div className="row" style={{ gap: 4 }}>
      <Dropdown label="Pilih proyek" placement={placement} value={id ?? '__none'} prefix={<FolderGit2 size={14} />}
        onChange={(v) => { if (v === '__add') void add(); else store.set({ workspaceId: v }); }}
        options={[
          ...(workspaces.length ? workspaces.map((x) => ({ value: x.id, label: x.name, hint: x.path, icon: <FolderGit2 size={15} /> })) : [{ value: '__none', label: 'Belum ada proyek', disabled: true }]),
          { value: '__add', label: 'Tambah proyek (pilih folder)…', icon: <Plus size={15} />, separatorBefore: true }
        ]} />
      {w && !allowed && <Tip text="Folder ini belum diizinkan. Buka Permission Center."><button className="chip warn" onClick={() => setPage('permissions')}><Lock size={12} />Belum diizinkan</button></Tip>}
    </div>
  );
}

export function CompatBanner({ mode }: { mode: 'chat' | 'code' }) {
  const p = useActiveProvider();
  const c = capsOf(p);
  if (mode === 'chat' || c.tools) return null;
  return (
    <div className="composer" style={{ paddingBottom: 0 }}>
      <div className="status-banner warn" style={{ maxWidth: 780, margin: '0 auto' }}>
        <AlertTriangle size={15} />Penyedia aktif ({p?.name ?? '—'}) tidak mendukung tool calling, jadi Code tidak dapat bertindak. Pilih/tambahkan penyedia OpenAI-compatible di Pengaturan.
        <button className="btn sm" onClick={() => setPage('settings')}>Pengaturan</button>
      </div>
    </div>
  );
}
export { Sparkles };
