import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, ArrowUp, Brain, Check, CheckCircle2, Circle, ClipboardList, Cog, Paperclip, ShieldAlert, Square, Wrench, X, XCircle, Loader2
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApprovalRequest, PlanStep, TaskSummary, TimelineEvent } from '@shared/types';
import { store, send, stopTask, respondApproval, toast, type Attachment } from '@/lib/state';
import { Markdown } from './Markdown';
import { Modal, Typing, Logo, Tip } from './ui';
import type { AgentMode } from '@shared/types';

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('id-ID', { hour12: false });

export function StatusPill({ task }: { task?: TaskSummary }) {
  if (!task) return <span className="chip"><span className="dot" />Siaga</span>;
  const map: Record<string, [string, string, string]> = {
    running: ['Berjalan', 'blue', 'live'], paused: ['Dijeda', 'warn', 'warn'], waiting_approval: ['Menunggu persetujuan', 'warn', 'warn'],
    stopped: ['Dihentikan', '', ''], done: ['Selesai', 'ok', 'live'], error: ['Error', 'bad', 'bad'], idle: ['Siaga', '', '']
  };
  const [label, cls, dot] = map[task.status] ?? map.idle;
  return <span className={`chip ${cls}`} role="status"><span className={`dot ${dot}`} />{label}{task.steps > 0 && ` • langkah ${task.steps}`}</span>;
}

const KIND_ICON: Record<TimelineEvent['kind'], ReactNode> = {
  status: <Cog size={15} />, plan: <ClipboardList size={15} />, tool_call: <Wrench size={15} color="var(--blue)" />, tool_result: <CheckCircle2 size={15} color="var(--green)" />,
  approval: <ShieldAlert size={15} color="var(--blue)" />, permission: <ShieldAlert size={15} />, warning: <AlertTriangle size={15} color="var(--amber)" />, error: <XCircle size={15} color="var(--red)" />, assistant: <Brain size={15} />
};

export function Timeline({ events, filter }: { events: TimelineEvent[]; filter?: (e: TimelineEvent) => boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const list = filter ? events.filter(filter) : events;
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }); }, [list.length]);
  if (!list.length) return <div className="tl"><span style={{ color: 'var(--faint)' }}>Belum ada aktivitas.</span></div>;
  return (
    <div className="tl" ref={ref} aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((e) => (
          <motion.div key={e.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`tl-item ${e.kind} ${e.ok === false ? 'error' : ''}`}>
            <span style={{ paddingTop: 2 }}>{e.kind === 'tool_result' && e.ok === false ? <XCircle size={15} color="var(--red)" /> : KIND_ICON[e.kind]}</span>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 6 }}><span className="t" style={{ flex: 1 }}>{e.title}</span>{e.risk && <span className={`risk ${e.risk}`}>{e.risk}</span>}<span className="tl-time">{fmtTime(e.at)}</span></div>
              {e.detail && <pre>{e.detail}</pre>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PlanList({ steps }: { steps?: PlanStep[] }) {
  if (!steps?.length) return <div className="plan"><span style={{ color: 'var(--faint)' }}>Agen belum menyusun rencana.</span></div>;
  const done = steps.filter((s) => s.status === 'done').length;
  return (
    <div className="plan">
      <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemax={steps.length}><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <small style={{ color: 'var(--muted)' }}>{done}/{steps.length} langkah selesai</small>
      {steps.map((s) => (
        <motion.div key={s.id} layout className={`plan-step ${s.status}`}>
          {s.status === 'done' ? <Check size={16} color="var(--green)" /> : s.status === 'active' ? <Loader2 size={16} className="spin" color="var(--blue)" /> : s.status === 'failed' ? <X size={16} color="var(--red)" /> : <Circle size={16} color="var(--faint)" />}
          <span>{s.title}</span>
        </motion.div>
      ))}
    </div>
  );
}

export function DiffView({ text }: { text: string }) {
  return (
    <div className="diff">
      {text.split('\n').map((l, i) => <span key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'a' : l.startsWith('-') && !l.startsWith('---') ? 'd' : 'h'}>{l || ' '}</span>)}
    </div>
  );
}

export function ApprovalBody({ a }: { a: ApprovalRequest }) {
  const isDiff = a.detail && /^--- /m.test(a.detail);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row"><ShieldAlert color={a.risk === 'low' || a.risk === 'medium' ? 'var(--amber)' : 'var(--red)'} /><h3 className="display" style={{ fontSize: '1.1rem' }}>Persetujuan diperlukan</h3><span className={`risk ${a.risk}`}>{a.risk}</span></div>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{a.summary}</div>
      <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Tool <span className="kbd">{a.tool}</span> • izin <span className="kbd">{a.kind}</span></div>
      {a.detail && (isDiff ? <DiffView text={a.detail} /> : <pre className="diff">{a.detail}</pre>)}
    </div>
  );
}

export function ApprovalActions({ a, compact }: { a: ApprovalRequest; compact?: boolean }) {
  const canRemember = (a.risk === 'low' || a.risk === 'medium') && !!a.taskId;
  return (
    <div className="row wrap" style={{ justifyContent: compact ? 'flex-start' : 'flex-end' }}>
      <button className="btn danger" onClick={() => respondApproval(a.id, false)}><X size={16} />Tolak</button>
      {canRemember && <button className="btn" onClick={() => respondApproval(a.id, true, true)}><Check size={16} />Setujui untuk task ini</button>}
      <button className="btn primary" onClick={() => respondApproval(a.id, true)}><Check size={16} />Setujui sekali</button>
    </div>
  );
}

/** Dialog persetujuan global (di halaman Control, persetujuan tampil inline). */
export function ApprovalHost() {
  const approvals = store.use((s) => s.approvals);
  const page = store.use((s) => s.page);
  const a = approvals[0];
  if (page === 'control' || !a) return null;
  return (
    <Modal label="Persetujuan tindakan AI">
      <ApprovalBody a={a} />
      <div style={{ marginTop: 16 }}><ApprovalActions a={a} /></div>
      {approvals.length > 1 && <small style={{ color: 'var(--faint)' }}>{approvals.length - 1} permintaan lain menunggu</small>}
    </Modal>
  );
}

const fileToAttachment = (f: File): Promise<Attachment> => new Promise((res, rej) => {
  if (f.size > 8_000_000) return rej(new Error(`${f.name} terlalu besar (maks 8 MB)`));
  const r = new FileReader();
  r.onerror = () => rej(new Error(`Gagal membaca ${f.name}`));
  r.onload = () => res({ name: f.name, mime: f.type || 'text/plain', size: f.size, data: String(r.result) });
  if (f.type.startsWith('image/')) r.readAsDataURL(f); else r.readAsText(f);
});

export function Composer({ mode, placeholder, disabled, task, extra }: { mode: AgentMode; placeholder: string; disabled?: string; task?: TaskSummary; extra?: ReactNode }) {
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [drop, setDrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = !!task && ['running', 'paused', 'waiting_approval'].includes(task.status);
  const add = async (files: FileList | File[]) => {
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        if (!f.type.startsWith('image/') && !(f.type.startsWith('text/') || /\.(md|json|ts|tsx|js|jsx|py|css|html|csv|txt|yml|yaml|toml|rs|go|java|c|cpp|h|sh|sql|xml)$/i.test(f.name))) throw new Error(`${f.name}: hanya gambar dan berkas teks/kode yang didukung`);
        const a = await fileToAttachment(f);
        setAtts((x) => [...x, a].slice(0, 8));
      } catch (e) { toast('error', (e as Error).message); }
    }
  };
  const submit = () => { if (busy || disabled || (!text.trim() && !atts.length)) return; void send(mode, text, atts); setText(''); setAtts([]); };
  return (
    <div className="composer">
      <div className={`composer-in ${drop ? 'drop' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrop(true); }} onDragLeave={() => setDrop(false)}
        onDrop={(e) => { e.preventDefault(); setDrop(false); void add(e.dataTransfer.files); }}>
        {atts.length > 0 && <div className="atts">{atts.map((a, i) => <span className="chip blue" key={i}><Paperclip size={12} />{a.name}<button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Hapus ${a.name}`} onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}><X size={12} /></button></span>)}</div>}
        <textarea rows={2} value={text} placeholder={disabled ?? placeholder} disabled={!!disabled} aria-label="Pesan"
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(220, e.target.scrollHeight) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <div className="composer-bar">
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ''; }} />
          <Tip text="Lampirkan gambar atau berkas teks (atau seret ke sini)"><button className="icon-btn" aria-label="Lampirkan berkas" onClick={() => fileRef.current?.click()}><Paperclip size={17} /></button></Tip>
          {extra}
          <span className="spacer" />
          <small style={{ color: 'var(--faint)' }}>Enter kirim • Shift+Enter baris baru</small>
          {busy
            ? <button className="btn danger" onClick={() => task && stopTask(task.id)} aria-label="Hentikan AI"><Square size={14} fill="currentColor" />Stop</button>
            : <button className="btn primary" disabled={!!disabled || (!text.trim() && !atts.length)} onClick={submit} aria-label="Kirim"><ArrowUp size={16} />Kirim</button>}
        </div>
      </div>
    </div>
  );
}

export function Messages({ mode, task }: { mode: AgentMode; task?: TaskSummary }) {
  const conv = store.use((s) => s.conv);
  const streams = store.use((s) => s.streams);
  const taskConv = store.use((s) => s.taskConv);
  const ref = useRef<HTMLDivElement>(null);
  const mine = useMemo(() => Object.entries(streams).filter(([, v]) => conv && taskConv[v.taskId] === conv.id), [streams, taskConv, conv]);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [conv?.messages.length, mine.map(([, v]) => v.content.length).join()]);
  const msgs = conv && conv.mode === mode ? conv.messages : [];
  const busy = !!task && ['running', 'paused', 'waiting_approval'].includes(task.status);
  return (
    <div className="msgs" ref={ref}>
      <div className="msgs-in">
        {msgs.map((m) => (
          <motion.div key={m.id} className={`msg ${m.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
            <div className={`avatar ${m.role === 'assistant' ? 'ai' : ''}`}>{m.role === 'assistant' ? <Logo size={34} /> : 'Anda'}</div>
            <div className="bubble">
              {m.role === 'assistant' ? <Markdown text={m.content} /> : <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.content}</div>}
              {m.attachments?.length ? <div className="atts" style={{ marginTop: 6 }}>{m.attachments.map((a, i) => <span key={i} className="chip"><Paperclip size={11} />{a.name}</span>)}</div> : null}
            </div>
          </motion.div>
        ))}
        {mine.map(([id, v]) => (
          <div key={id} className="msg"><div className="avatar ai"><Logo size={34} /></div><div className="bubble"><Markdown text={v.content} /></div></div>
        ))}
        {busy && !mine.length && <div className="msg"><div className="avatar ai"><Logo size={34} /></div><div className="bubble"><Typing /></div></div>}
      </div>
    </div>
  );
}
