import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Check, ChevronDown, ChevronRight, Copy, FilePen, FileText, Globe, Loader2, MousePointer2, Search, ShieldAlert, Terminal, Trash2, X, AppWindow, AlertTriangle, Circle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatMessage, PlanStep, TimelineEvent } from '@shared/types';
import { store, toast } from '@/lib/state';
import { ApprovalCard, DiffView, isLive } from './agent';
import { Markdown } from './Markdown';
import { Logo, Typing } from './ui';

type RowStatus = 'running' | 'waiting' | 'ok' | 'fail' | 'denied';
interface Row { id: string; at: number; tool?: string; title: string; detail?: string; result?: string; risk?: string; status: RowStatus; kind: 'tool' | 'warn' | 'error' }
type Entry = { at: number; seq: number } & ({ t: 'msg'; msg: ChatMessage } | { t: 'row'; row: Row } | { t: 'plan'; taskId: string });

const ICONS: Record<string, ReactNode> = {
  run_command: <Terminal size={15} />, write_file: <FilePen size={15} />, edit_file: <FilePen size={15} />, make_dir: <FilePen size={15} />, copy_path: <FilePen size={15} />, move_path: <FilePen size={15} />,
  delete_path: <Trash2 size={15} />, read_file: <FileText size={15} />, list_dir: <FileText size={15} />, search_files: <Search size={15} />, open_path: <FileText size={15} />,
  memory_read: <Brain size={15} />, memory_write: <Brain size={15} />, list_windows: <AppWindow size={15} />, focus_window: <AppWindow size={15} />, window_action: <AppWindow size={15} />, open_app: <AppWindow size={15} />, list_apps: <AppWindow size={15} />
};
const iconFor = (tool?: string) => (tool && (ICONS[tool] ?? (tool.startsWith('browser_') ? <Globe size={15} /> : <MousePointer2 size={15} />))) || <Circle size={15} />;

/** Ubah event timeline mentah menjadi baris aktivitas (tool_call + approval + tool_result digabung). */
export function buildRows(events: TimelineEvent[]): (Row | { plan: true; at: number })[] {
  const out: (Row | { plan: true; at: number })[] = [];
  let planPlaced = false;
  for (const e of events) {
    if (e.kind === 'plan') { if (!planPlaced) { out.push({ plan: true, at: e.at }); planPlaced = true; } continue; }
    if (e.kind === 'tool_call') {
      if (e.tool === 'update_plan') continue;
      out.push({ id: e.id, at: e.at, tool: e.tool, title: e.title, detail: e.detail, risk: e.risk, status: 'running', kind: 'tool' });
    } else if (e.kind === 'approval') {
      const last = [...out].reverse().find((r): r is Row => 'id' in r && r.kind === 'tool' && (r.status === 'running' || r.status === 'waiting'));
      if (last) last.status = /menunggu/i.test(e.title) ? 'waiting' : /disetujui/i.test(e.title) ? 'running' : last.status;
    } else if (e.kind === 'tool_result') {
      if (e.tool === 'update_plan') continue;
      const row = [...out].reverse().find((r): r is Row => 'id' in r && r.kind === 'tool' && r.tool === e.tool && (r.status === 'running' || r.status === 'waiting'));
      const denied = /^Ditolak/.test(e.title);
      if (row) { row.status = e.ok ? 'ok' : denied ? 'denied' : 'fail'; row.result = e.detail; }
      else out.push({ id: e.id, at: e.at, tool: e.tool, title: e.title, detail: e.detail, status: e.ok ? 'ok' : denied ? 'denied' : 'fail', kind: 'tool' });
    } else if (e.kind === 'warning') out.push({ id: e.id, at: e.at, title: e.title, detail: e.detail, status: 'fail', kind: 'warn' });
    else if (e.kind === 'error') out.push({ id: e.id, at: e.at, title: e.title, detail: e.detail, status: 'fail', kind: 'error' });
  }
  return out;
}

function StatusIcon({ s }: { s: RowStatus }) {
  if (s === 'running') return <Loader2 size={15} className="spin" color="var(--blue)" />;
  if (s === 'waiting') return <ShieldAlert size={15} color="var(--amber)" />;
  if (s === 'ok') return <Check size={15} color="var(--green)" />;
  if (s === 'denied') return <X size={15} color="var(--amber)" />;
  return <X size={15} color="var(--red)" />;
}

function ActRow({ r }: { r: Row }) {
  const [open, setOpen] = useState(false);
  const isDiff = !!r.detail && /^--- /m.test(r.detail);
  const hasMore = !!(r.detail || r.result);
  if (r.kind !== 'tool') return <div className="act-row"><span style={{ paddingTop: 2 }}><AlertTriangle size={15} color={r.kind === 'error' ? 'var(--red)' : 'var(--amber)'} /></span><div className="ttl"><b>{r.title}</b>{r.detail && <div style={{ color: 'var(--muted)' }}>{r.detail}</div>}</div><span /></div>;
  return (
    <>
      <div className="act-row">
        <span style={{ paddingTop: 2, color: 'var(--muted)' }}>{iconFor(r.tool)}</span>
        <div className="ttl" style={{ color: r.status === 'ok' ? 'var(--muted)' : 'var(--text)' }}>
          {r.title.replace(/^(Selesai|Gagal|Ditolak|Error): /, '')}
          {r.risk === 'high' || r.risk === 'critical' ? <span className={`risk ${r.risk}`} style={{ marginLeft: 8 }}>{r.risk}</span> : null}
          {hasMore && <button className="more" onClick={() => setOpen(!open)}>{open ? 'sembunyikan' : 'detail'}</button>}
        </div>
        <StatusIcon s={r.status} />
        {open && (isDiff ? <DiffView text={r.detail!} /> : r.detail ? <pre>{r.detail}</pre> : null)}
        {open && r.result && <pre>{r.result}</pre>}
      </div>
    </>
  );
}

function ActivityGroup({ rows, live }: { rows: Row[]; live: boolean }) {
  const [open, setOpen] = useState(live);
  const touched = useRef(false);
  useEffect(() => { if (live && !touched.current) setOpen(true); }, [live]);
  const failed = rows.filter((r) => r.status === 'fail').length;
  const working = rows.some((r) => r.status === 'running' || r.status === 'waiting');
  return (
    <div className="act">
      <button className="act-head" aria-expanded={open} onClick={() => { touched.current = true; setOpen(!open); }}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {working ? <Loader2 size={15} className="spin" color="var(--blue)" /> : <Check size={15} color="var(--green)" />}
        <span>{working ? 'Sedang bekerja' : 'Selesai'} · {rows.length} langkah{failed ? ` · ${failed} gagal` : ''}</span>
      </button>
      {open && <div className="act-rows">{rows.map((r) => <ActRow key={r.id} r={r} />)}</div>}
    </div>
  );
}

export function PlanCard({ steps }: { steps?: PlanStep[] }) {
  if (!steps?.length) return null;
  const done = steps.filter((s) => s.status === 'done').length;
  return (
    <div className="plan-card" aria-label="Rencana">
      <div className="row"><b style={{ fontSize: '.86rem' }}>Rencana</b><span className="spacer" /><small style={{ color: 'var(--muted)' }}>{done}/{steps.length}</small></div>
      <div className="progress"><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      {steps.map((s) => (
        <div key={s.id} className={`plan-step ${s.status}`}>
          {s.status === 'done' ? <Check size={15} color="var(--green)" /> : s.status === 'active' ? <Loader2 size={15} className="spin" color="var(--blue)" /> : s.status === 'failed' ? <X size={15} color="var(--red)" /> : <Circle size={15} color="var(--faint)" />}
          <span>{s.title}</span>
        </div>
      ))}
    </div>
  );
}

function Assistant({ text }: { text: string }) {
  return (
    <div className="a-msg">
      <Logo size={26} />
      <div style={{ minWidth: 0 }}>
        <Markdown text={text} />
        <div className="acts"><button className="icon-btn" aria-label="Salin jawaban" onClick={() => { void navigator.clipboard.writeText(text); toast('success', 'Disalin'); }}><Copy size={14} /></button></div>
      </div>
    </div>
  );
}

export function Thread({ code }: { code: boolean }) {
  const conv = store.use((s) => s.conv);
  const streams = store.use((s) => s.streams);
  const timelines = store.use((s) => s.timelines);
  const plans = store.use((s) => s.plans);
  const tasks = store.use((s) => s.tasks);
  const taskConv = store.use((s) => s.taskConv);
  const approvals = store.use((s) => s.approvals);
  const ref = useRef<HTMLDivElement>(null);

  const taskIds = useMemo(() => Object.keys(taskConv).filter((t) => conv && taskConv[t] === conv.id), [taskConv, conv]);
  const entries = useMemo(() => {
    const list: Entry[] = [];
    let seq = 0;
    for (const m of conv?.messages ?? []) list.push({ t: 'msg', msg: m, at: m.createdAt, seq: seq++ });
    for (const id of taskIds) {
      for (const r of buildRows(timelines[id] ?? [])) {
        if ('plan' in r) list.push({ t: 'plan', taskId: id, at: r.at, seq: seq++ });
        else list.push({ t: 'row', row: r, at: r.at, seq: seq++ });
      }
    }
    return list.sort((a, b) => a.at - b.at || a.seq - b.seq);
  }, [conv, taskIds, timelines]);

  const mine = Object.entries(streams).filter(([, v]) => conv && taskConv[v.taskId] === conv.id);
  const myApprovals = approvals.filter((a) => !a.taskId || taskIds.includes(a.taskId));
  const liveTask = taskIds.map((id) => tasks[id]).find(isLive);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [entries.length, mine.map(([, v]) => v.content.length).join(), myApprovals.length, timelines]);

  // Kelompokkan entri non-pesan berurutan menjadi satu blok aktivitas.
  const blocks: ({ k: 'msg'; msg: ChatMessage } | { k: 'act'; rows: Row[]; plan?: string; key: string })[] = [];
  for (const e of entries) {
    if (e.t === 'msg') { blocks.push({ k: 'msg', msg: e.msg }); continue; }
    let last = blocks[blocks.length - 1];
    if (!last || last.k !== 'act') { last = { k: 'act', rows: [], key: `a${e.seq}` }; blocks.push(last); }
    if (e.t === 'plan') last.plan = e.taskId; else last.rows.push(e.row);
  }
  const lastActIdx = blocks.map((b) => b.k).lastIndexOf('act');

  return (
    <div className="thread" ref={ref}>
      <div className="thread-in">
        {blocks.map((b, i) => b.k === 'msg'
          ? (b.msg.role === 'assistant'
            ? <Assistant key={b.msg.id} text={b.msg.content} />
            : <motion.div key={b.msg.id} className="u-msg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{b.msg.content}{b.msg.attachments?.length ? <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: '.8rem' }}>📎 {b.msg.attachments.map((a) => a.name).join(', ')}</div> : null}</motion.div>)
          : <div key={b.key} className="stack" style={{ gap: 10 }}>
              {b.plan && <PlanCard steps={plans[b.plan]} />}
              {b.rows.length > 0 && <ActivityGroup rows={b.rows} live={!!liveTask && i === lastActIdx} />}
            </div>)}
        {mine.map(([id, v]) => <Assistant key={id} text={v.content} />)}
        <AnimatePresence>{myApprovals.slice(0, 1).map((a) => <ApprovalCard key={a.id} a={a} count={myApprovals.length} />)}</AnimatePresence>
        {liveTask && !mine.length && !myApprovals.length && <div className="a-msg"><Logo size={26} /><div><Typing /></div></div>}
        {!code && null}
      </div>
    </div>
  );
}
