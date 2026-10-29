import { Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AuditEntry } from '@shared/types';
import { fmtTime } from '@/components/agent';
import { api } from '@/lib/api';
import { guard, store, toast } from '@/lib/state';

export function HistoryPage() {
  const tasks = store.use((s) => s.tasks);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const load = useCallback(async () => setAudit(((await guard(api.audit.list())) ?? []).reverse()), []);
  useEffect(() => { void load(); }, [load, tasks]);
  const list = Object.values(tasks).sort((a, b) => b.startedAt - a.startedAt);
  const cls: Record<string, string> = { ok: 'ok', allowed: 'ok', approved: 'ok', denied: 'bad', rejected: 'warn', error: 'bad' };
  return (
    <>
      <div className="topbar"><h2 className="display">Riwayat & Audit</h2><span className="spacer" />
        <button className="btn" onClick={load}><RefreshCw size={15} />Segarkan</button>
        <button className="btn primary" onClick={async () => { const r = await guard(api.audit.export()); if (r) toast('success', `${r.count} entri diekspor ke ${r.path}`); }}><Download size={15} />Ekspor log</button></div>
      <div className="page"><div className="pad stack">
        <div className="card"><h3>Riwayat task</h3><p className="sub">Semua task agen di perangkat ini.</p>
          <table className="tbl"><thead><tr><th>Waktu</th><th>Mode</th><th>Task</th><th>Status</th><th>Langkah</th></tr></thead><tbody>
            {list.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--faint)' }}>Belum ada task.</td></tr>}
            {list.slice(0, 100).map((t) => <tr key={t.id}><td>{new Date(t.startedAt).toLocaleString('id-ID')}</td><td><span className="chip">{t.mode}</span></td><td style={{ maxWidth: 420, overflowWrap: 'anywhere' }}>{t.title}</td><td><span className={`chip ${t.status === 'done' ? 'ok' : t.status === 'error' ? 'bad' : ''}`}>{t.status}</span></td><td>{t.steps}</td></tr>)}
          </tbody></table></div>
        <div className="card"><h3>Audit log tindakan</h3><p className="sub">Setiap keputusan izin dan tindakan agen dicatat (rahasia disamarkan). Berkas JSONL disimpan lokal.</p>
          <table className="tbl"><thead><tr><th>Waktu</th><th>Aktor</th><th>Tool</th><th>Risiko</th><th>Keputusan</th><th>Ringkasan</th></tr></thead><tbody>
            {audit.slice(0, 300).map((e, i) => <tr key={i}><td>{fmtTime(e.at)}</td><td>{e.actor}</td><td>{e.tool}</td><td>{e.risk && <span className={`risk ${e.risk}`}>{e.risk}</span>}</td><td><span className={`chip ${cls[e.decision] ?? ''}`}>{e.decision}</span></td><td style={{ overflowWrap: 'anywhere' }}>{e.summary}</td></tr>)}
          </tbody></table></div>
      </div></div>
    </>
  );
}
