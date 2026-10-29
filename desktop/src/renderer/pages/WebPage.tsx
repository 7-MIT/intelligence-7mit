import { Globe, Power, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Timeline, PlanList, StatusPill } from '@/components/agent';
import { ModelBar, useCurrentTask } from '@/components/common';
import { Tip } from '@/components/ui';
import { api } from '@/lib/api';
import { guard, setPage, store } from '@/lib/state';
import { ChatPane } from './ChatPage';

export function WebPage() {
  const frame = store.use((s) => s.browserFrame);
  const task = useCurrentTask('web');
  const timelines = store.use((s) => s.timelines);
  const plans = store.use((s) => s.plans);
  const perms = store.use((s) => s.permissions);
  const [tab, setTab] = useState<'agent' | 'timeline'>('agent');
  const [url, setUrl] = useState('');
  const [state, setState] = useState<{ open: boolean; tabs: { index: number; url: string; active: boolean }[] }>({ open: false, tabs: [] });
  const [busy, setBusy] = useState(false);
  const refresh = async () => setState((await api.browser.state()) ?? { open: false, tabs: [] });
  useEffect(() => { void refresh(); const t = setInterval(refresh, 2500); return () => clearInterval(t); }, []);
  const go = async () => { if (!url.trim()) return; setBusy(true); await guard(api.browser.navigate({ url })); setBusy(false); void refresh(); };
  return (
    <>
      <div className="topbar"><h2 className="display">Web</h2><ModelBar mode="web" /><StatusPill task={task} /></div>
      <div className="page" style={{ overflow: 'hidden' }}>
        <div className="web">
          <div className="browser-view">
            <form className="row" onSubmit={(e) => { e.preventDefault(); void go(); }}>
              <Globe size={17} color="var(--blue)" />
              <input className="input" placeholder="Alamat (https://…) — browser terisolasi tanpa login Anda" aria-label="Alamat URL" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button className="btn" disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} />Buka</button>
              <Tip text="Tutup browser terisolasi"><button type="button" className="icon-btn" aria-label="Tutup browser" onClick={async () => { await api.browser.close(); store.set({ browserFrame: null }); void refresh(); }}><Power size={16} /></button></Tip>
            </form>
            <div className="row wrap">
              <span className={`chip ${state.open ? 'ok' : ''}`}><span className={`dot ${state.open ? 'live' : ''}`} />{state.open ? 'Browser aktif (sesi terisolasi)' : 'Browser belum dibuka'}</span>
              {!perms.grants.browser && <button className="chip warn" onClick={() => setPage('permissions')}>Izin Browser belum diberikan</button>}
              {state.tabs.map((t) => <span key={t.index} className={`chip ${t.active ? 'blue' : ''}`} title={t.url}>Tab {t.index}: {t.url.replace(/^https?:\/\//, '').slice(0, 28)}</span>)}
            </div>
            <div className="screen">
              {frame && state.open ? <div className="screen-inner"><img src={frame} alt="Tampilan browser agen" />{task && ['running', 'waiting_approval'].includes(task.status) && <div className="scan" />}</div>
                : <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}><Globe size={40} /><p>Aktivitas browser tampil real-time di sini.<br />Sesi terisolasi: tidak memakai cookie atau login Chrome/Edge Anda.</p></div>}
            </div>
          </div>
          <div className="panel">
            <div className="tabs" role="tablist"><button role="tab" className={tab === 'agent' ? 'on' : ''} onClick={() => setTab('agent')}>Agen</button><button role="tab" className={tab === 'timeline' ? 'on' : ''} onClick={() => setTab('timeline')}>Aktivitas</button></div>
            {tab === 'agent' ? <div style={{ flex: 1, minHeight: 0 }}><ChatPane mode="web" placeholder="Contoh: buka example.com dan ringkas isinya" hint="Agen membuka halaman, mengklik, mengisi formulir, mengambil screenshot, dan menguji situs. Tindakan kirim/beli/hapus/terbitkan selalu meminta konfirmasi." /></div>
              : <>{task && <PlanList steps={plans[task.id]} />}<Timeline events={task ? timelines[task.id] ?? [] : []} /></>}
          </div>
        </div>
      </div>
    </>
  );
}
