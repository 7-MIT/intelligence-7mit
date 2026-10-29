import { motion } from 'framer-motion';
import { ArrowUp, Check, Paperclip, ShieldAlert, Square, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import type { AgentMode, ApprovalRequest, TaskSummary } from '@shared/types';
import { respondApproval, send, stopTask, toast, store, type Attachment } from '@/lib/state';
import { Logo, Tip } from './ui';

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('id-ID', { hour12: false });
export const isLive = (t?: TaskSummary) => !!t && ['running', 'paused', 'waiting_approval'].includes(t.status);

export function StatusPill({ task }: { task?: TaskSummary }) {
  if (!task) return null;
  const map: Record<string, [string, string, string]> = {
    running: ['Bekerja', 'blue', 'live'], paused: ['Dijeda', 'warn', 'warn'], waiting_approval: ['Menunggu persetujuan', 'warn', 'warn'],
    stopped: ['Dihentikan', '', ''], done: ['Selesai', 'ok', ''], error: ['Error', 'bad', 'bad'], idle: ['Siaga', '', '']
  };
  const [label, cls, dot] = map[task.status] ?? map.idle;
  return <span className={`chip ${cls}`} role="status"><span className={`dot ${dot}`} />{label}{isLive(task) && task.steps > 0 && ` · langkah ${task.steps}`}</span>;
}

export function DiffView({ text }: { text: string }) {
  return (
    <div className="diff">
      {text.split('\n').map((l, i) => <span key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'a' : l.startsWith('-') && !l.startsWith('---') ? 'd' : 'h'}>{l || ' '}</span>)}
    </div>
  );
}

/** Kartu persetujuan inline di dalam thread (gaya Codex), bukan dialog yang menutupi layar. */
export function ApprovalCard({ a, count }: { a: ApprovalRequest; count?: number }) {
  const isDiff = a.detail && /^--- /m.test(a.detail);
  const canRemember = (a.risk === 'low' || a.risk === 'medium') && !!a.taskId;
  return (
    <motion.div className="appr" role="alertdialog" aria-label="Persetujuan tindakan AI" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="row"><ShieldAlert size={18} color={a.risk === 'low' || a.risk === 'medium' ? 'var(--amber)' : 'var(--red)'} /><b>AI meminta izin</b><span className={`risk ${a.risk}`}>{a.risk}</span><span className="spacer" />{!!count && count > 1 && <small style={{ color: 'var(--faint)' }}>+{count - 1} menunggu</small>}</div>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{a.summary}</div>
      <small style={{ color: 'var(--muted)' }}>Tool <span className="kbd">{a.tool}</span> · izin <span className="kbd">{a.kind}</span></small>
      {a.detail && (isDiff ? <DiffView text={a.detail} /> : <pre className="diff">{a.detail}</pre>)}
      <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
        <button className="btn danger" onClick={() => respondApproval(a.id, false)}><X size={16} />Tolak</button>
        {canRemember && <button className="btn" onClick={() => respondApproval(a.id, true, true)}><Check size={16} />Setujui untuk task ini</button>}
        <button className="btn primary" onClick={() => respondApproval(a.id, true)}><Check size={16} />Setujui</button>
      </div>
    </motion.div>
  );
}

const fileToAttachment = (f: File): Promise<Attachment> => new Promise((res, rej) => {
  if (f.size > 8_000_000) return rej(new Error(`${f.name} terlalu besar (maks 8 MB)`));
  const r = new FileReader();
  r.onerror = () => rej(new Error(`Gagal membaca ${f.name}`));
  r.onload = () => res({ name: f.name, mime: f.type || 'text/plain', size: f.size, data: String(r.result) });
  if (f.type.startsWith('image/')) r.readAsDataURL(f); else r.readAsText(f);
});

export function Composer({ mode, placeholder, disabled, task, leftExtra, rightExtra, below }: {
  mode: AgentMode; placeholder: string; disabled?: string; task?: TaskSummary; leftExtra?: ReactNode; rightExtra?: ReactNode; below?: ReactNode;
}) {
  const [text, setText] = useState('');
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [drop, setDrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = isLive(task);
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
      <div className={`composer-box ${drop ? 'drop' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrop(true); }} onDragLeave={() => setDrop(false)}
        onDrop={(e) => { e.preventDefault(); setDrop(false); void add(e.dataTransfer.files); }}>
        {atts.length > 0 && <div className="atts">{atts.map((a, i) => <span className="chip blue" key={i}><Paperclip size={12} />{a.name}<button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Hapus ${a.name}`} onClick={() => setAtts((x) => x.filter((_, j) => j !== i))}><X size={12} /></button></span>)}</div>}
        <textarea rows={2} value={text} placeholder={disabled ?? placeholder} disabled={!!disabled} aria-label="Pesan"
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(240, e.target.scrollHeight) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <div className="composer-bar">
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) void add(e.target.files); e.target.value = ''; }} />
          <Tip text="Lampirkan gambar atau berkas teks (atau seret ke sini)"><button className="icon-btn" aria-label="Lampirkan berkas" onClick={() => fileRef.current?.click()}><Paperclip size={17} /></button></Tip>
          {leftExtra}
          <span className="spacer" />
          {rightExtra}
          {busy
            ? <Tip text="Hentikan AI"><button className="send stop" onClick={() => task && stopTask(task.id)} aria-label="Hentikan AI"><Square size={13} fill="currentColor" /></button></Tip>
            : <button className="send" disabled={!!disabled || (!text.trim() && !atts.length)} onClick={submit} aria-label="Kirim"><ArrowUp size={18} /></button>}
        </div>
      </div>
      {below && <div className="composer-foot">{below}</div>}
    </div>
  );
}

export function AiAvatar() { return <Logo size={26} />; }
export { store };
