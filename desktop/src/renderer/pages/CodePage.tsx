import { Pause, PanelRight, Play, Square } from 'lucide-react';
import { Composer, StatusPill, isLive } from '@/components/agent';
import { CapPills, CompatBanner, ExecModePicker, ModelPicker, SubmodePicker, WorkspacePicker, useCurrentTask } from '@/components/common';
import { BrowserPanel, ChangesPanel, FilesPanel, PANEL_TABS, ScreenPanel, TerminalPanel } from '@/components/panels';
import { Thread } from '@/components/thread';
import { Empty, Tip } from '@/components/ui';
import { pauseTask, resumeTask, send, stopTask, store } from '@/lib/state';

const SUGGESTIONS = [
  { t: 'Buat website', d: 'Buat website portofolio sederhana (HTML/CSS/JS) lalu jalankan' },
  { t: 'Pahami proyek', d: 'Jelaskan struktur proyek ini dan komponen utamanya' },
  { t: 'Perbaiki error', d: 'Jalankan test, cari error, lalu perbaiki' },
  { t: 'Tulis test', d: 'Tambahkan unit test untuk modul yang belum teruji' }
];

function TaskBar({ task }: { task: NonNullable<ReturnType<typeof useCurrentTask>> }) {
  return (
    <div className="taskbar" role="status">
      <StatusPill task={task} /><span style={{ color: 'var(--muted)' }}>{task.title}</span><span className="spacer" />
      {task.status === 'paused'
        ? <button className="btn sm" onClick={() => resumeTask(task.id)}><Play size={13} />Lanjut</button>
        : <button className="btn sm" disabled={task.status === 'waiting_approval'} onClick={() => pauseTask(task.id)}><Pause size={13} />Jeda</button>}
      <button className="btn sm danger" onClick={() => stopTask(task.id)}><Square size={12} fill="currentColor" />Hentikan</button>
    </div>
  );
}

export function CodePage() {
  const conv = store.use((s) => s.conv);
  const panelOpen = store.use((s) => s.panelOpen);
  const panelTab = store.use((s) => s.panelTab);
  const task = useCurrentTask();
  const has = !!conv && conv.mode !== 'chat' && conv.messages.length > 0;
  const composer = (
    <Composer mode="code" task={task} placeholder="Minta AI membangun, memperbaiki, atau menjalankan sesuatu…"
      leftExtra={<CapPills />} rightExtra={<><SubmodePicker /><ModelPicker /></>}
      below={<><WorkspacePicker /><ExecModePicker /></>} />
  );
  return (
    <>
      <div className="topbar drag">
        <span className="title no-drag">{has ? conv!.title : 'Task baru'}</span>
        <span className="no-drag"><StatusPill task={task} /></span>
        <span className="spacer" />
        <Tip text={panelOpen ? 'Tutup panel' : 'Buka panel (berkas, perubahan, terminal, peramban, layar)'}>
          <button className={`icon-btn no-drag ${panelOpen ? 'on' : ''}`} aria-label="Panel samping" aria-pressed={panelOpen} onClick={() => store.set({ panelOpen: !panelOpen })}><PanelRight size={18} /></button>
        </Tip>
      </div>
      <div className="code-split">
        <div className="code-main">
          <CompatBanner mode="code" />
          {has ? (<><Thread code /><div>{isLive(task) && <div style={{ padding: '0 24px' }}><TaskBar task={task!} /></div>}{composer}</div></>) : (
            <div className="empty"><div className="empty-in">
              <Empty title="Apa yang ingin Anda bangun?"><p className="sub">AI membaca proyek, mengusulkan perubahan dengan diff, menjalankan build/test — selalu atas persetujuan Anda.</p></Empty>
              <div style={{ marginTop: -8 }}>{composer}</div>
              <div className="sugs">{SUGGESTIONS.map((s) => <button key={s.t} className="sug" onClick={() => send('code', s.d)}><b>{s.t}</b>{s.d}</button>)}</div>
            </div></div>
          )}
        </div>
        {panelOpen && (
          <aside className="rpanel" aria-label="Panel samping">
            <div className="tabs" role="tablist">{PANEL_TABS.map((t) => <button key={t.id} role="tab" aria-selected={panelTab === t.id} className={panelTab === t.id ? 'on' : ''} onClick={() => store.set({ panelTab: t.id })}>{t.icon}{t.label}</button>)}</div>
            <div className="pane">
              {panelTab === 'files' && <FilesPanel />}
              {panelTab === 'changes' && <ChangesPanel />}
              {panelTab === 'terminal' && <TerminalPanel />}
              {panelTab === 'browser' && <BrowserPanel />}
              {panelTab === 'screen' && <ScreenPanel />}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
