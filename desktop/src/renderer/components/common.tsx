import { AlertTriangle, Eye, FolderGit2, Lock, ShieldCheck, Zap, Cpu, Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { AgentMode, ExecutionMode, ProviderConfig, TaskSummary } from '@shared/types';
import { api } from '@/lib/api';
import { activeTaskFor, guard, setPage, store, updatePermissions, updateSettings, refreshAll } from '@/lib/state';
import { Dropdown, Tip } from './ui';

export const capsOf = (p?: ProviderConfig) => ({
  tools: !!p && p.kind === 'openai' && p.supportsTools,
  vision: !!p && p.kind === 'openai' && p.supportsVision
});

export function useCurrentTask(mode: AgentMode): TaskSummary | undefined {
  const conv = store.use((s) => s.conv);
  const tasks = store.use((s) => s.tasks);
  const taskConv = store.use((s) => s.taskConv);
  return useMemo(() => {
    void tasks; void taskConv;
    if (mode === 'control') {
      return Object.values(tasks).filter((t) => t.mode === 'control').sort((a, b) => b.startedAt - a.startedAt)[0];
    }
    const id = conv?.mode === mode ? conv.id : undefined;
    if (!id) return undefined;
    const live = activeTaskFor(id);
    if (live) return live;
    return Object.values(tasks).filter((t) => taskConv[t.id] === id).sort((a, b) => b.startedAt - a.startedAt)[0];
  }, [conv, tasks, taskConv, mode]);
}

export function ModelBar({ mode }: { mode: AgentMode }) {
  const providers = store.use((s) => s.providers);
  const settings = store.use((s) => s.settings);
  const perms = store.use((s) => s.permissions);
  const p = providers.find((x) => x.id === settings.activeProviderId) ?? providers[0];
  const c = capsOf(p);
  const modeOpts: { value: ExecutionMode; label: string; hint: string; icon: JSX.Element }[] = [
    { value: 'readonly', label: 'Read Only', hint: 'AI hanya mengamati', icon: <Eye size={15} /> },
    { value: 'ask', label: 'Ask Before Action', hint: 'Tanya sebelum bertindak', icon: <ShieldCheck size={15} /> },
    { value: 'auto', label: 'Auto Execute', hint: 'Otomatis hanya untuk risiko rendah di workspace disetujui', icon: <Zap size={15} /> }
  ];
  const needs = mode === 'control' ? !(c.tools && c.vision) : mode !== 'chat' ? !c.tools : false;
  return (
    <>
      <Dropdown label="Pilih model" width={210} value={p?.id ?? ''} onChange={(id) => updateSettings({ activeProviderId: id })}
        options={providers.map((x) => ({ value: x.id, label: `${x.name}${x.kind === 'openai' ? ' · ' + x.model : ''}`, icon: <Cpu size={15} /> }))} />
      <Tip text={c.tools ? 'Penyedia mendukung tool calling' : 'Penyedia ini tidak mendukung tool calling'}><span className={`chip ${c.tools ? 'ok' : 'warn'}`}>Tools {c.tools ? '✓' : '✗'}</span></Tip>
      <Tip text={c.vision ? 'Model dapat membaca gambar/screenshot' : 'Model tidak ditandai mendukung vision'}><span className={`chip ${c.vision ? 'ok' : 'warn'}`}>Vision {c.vision ? '✓' : '✗'}</span></Tip>
      {needs && <Tip text={`Mode ${mode} tidak dapat berjalan dengan penyedia ini. Ganti penyedia di Pengaturan.`}><button className="chip bad" onClick={() => setPage('settings')}><AlertTriangle size={13} />Tidak kompatibel</button></Tip>}
      <span className="spacer" />
      <Dropdown label="Mode eksekusi" width={190} value={perms.mode} onChange={(m) => updatePermissions({ mode: m })} options={modeOpts} />
    </>
  );
}

export function WorkspaceSelect() {
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
  const allowed = w && perms.allowedFolders.includes(w.path);
  return (
    <div className="row" style={{ gap: 6 }}>
      <Dropdown label="Pilih workspace" width={170} value={id ?? ''} onChange={(v) => store.set({ workspaceId: v })}
        options={workspaces.length ? workspaces.map((x) => ({ value: x.id, label: x.name, hint: x.path, icon: <FolderGit2 size={15} /> })) : [{ value: '', label: 'Belum ada workspace', disabled: true }]} />
      <Tip text="Tambah workspace (folder yang boleh diakses AI)"><button className="icon-btn" aria-label="Tambah workspace" onClick={add}><Plus size={17} /></button></Tip>
      {w && !allowed && <Tip text="Folder ini belum diizinkan. Buka Permission Center."><button className="chip warn" onClick={() => setPage('permissions')}><Lock size={12} />Belum diizinkan</button></Tip>}
    </div>
  );
}
