import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Eye, MonitorOff, Pause, Play, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApprovalActions, ApprovalBody, Composer, Messages, PlanList, StatusPill, Timeline } from '@/components/agent';
import { ModelBar, capsOf, useCurrentTask } from '@/components/common';
import { Empty } from '@/components/ui';
import { pauseTask, resumeTask, respondApproval, setPage, stopTask, store, updatePermissions } from '@/lib/state';

function Preview() {
  const frame = store.use((s) => s.frame);
  const target = store.use((s) => s.target);
  const capture = store.use((s) => s.capture);
  const [ripple, setRipple] = useState(0);
  useEffect(() => { if (target?.action === 'click' || target?.action === 'drag') setRipple(target.at); }, [target]);
  const fresh = target && Date.now() - target.at < 6000;
  return (
    <div className="screen" aria-label="Pratinjau layar langsung">
      {frame ? (
        <div className="screen-inner">
          <img src={frame.dataUrl} alt="Layar komputer saat ini" draggable={false} />
          {capture.active && <div className="scan" />}
          <AnimatePresence>
            {fresh && target && (
              <motion.div key={target.at} className="target" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ left: `${(target.x / target.width) * 100}%`, top: `${(target.y / target.height) * 100}%` }} title={target.action} />
            )}
          </AnimatePresence>
          {ripple > 0 && target && <div key={ripple} className="ripple" style={{ left: `${(target.x / target.width) * 100}%`, top: `${(target.y / target.height) * 100}%` }} />}
        </div>
      ) : (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}><MonitorOff size={40} /><p>Belum ada tangkapan layar.<br />Pratinjau muncul saat Control Session berjalan dengan izin Screen observation.</p></div>
      )}
    </div>
  );
}

export function ControlPage() {
  const task = useCurrentTask('control');
  const timelines = store.use((s) => s.timelines);
  const plans = store.use((s) => s.plans);
  const approvals = store.use((s) => s.approvals);
  const perms = store.use((s) => s.permissions);
  const capture = store.use((s) => s.capture);
  const providers = store.use((s) => s.providers);
  const settings = store.use((s) => s.settings);
  const system = store.use((s) => s.system);
  const [tab, setTab] = useState<'timeline' | 'tools' | 'perms' | 'logs' | 'errors'>('timeline');
  const p = providers.find((x) => x.id === settings.activeProviderId);
  const c = capsOf(p);
  const events = task ? timelines[task.id] ?? [] : [];
  const live = !!task && ['running', 'paused', 'waiting_approval'].includes(task.status);
  const ap = approvals.find((a) => a.taskId === task?.id) ?? approvals[0];
  const lastTitle = [...events].reverse().find((e) => e.kind === 'tool_call' || e.kind === 'status')?.title;
  const blockers: string[] = [];
  if (!c.tools) blockers.push('Penyedia AI tidak mendukung tool calling — Control tidak dapat berjalan dan tidak akan berpura-pura.');
  else if (!c.vision) blockers.push('Model tidak ditandai mendukung vision — Control membutuhkan model multimodal.');
  if (!perms.grants.screen) blockers.push('Izin Screen observation belum diberikan.');
  if (!perms.grants.input) blockers.push('Izin Mouse & keyboard belum diberikan (AI hanya bisa melihat, tidak bisa bertindak).');
  if (!perms.allowScreenshotUpload) blockers.push('Pengiriman screenshot ke penyedia AI belum diizinkan.');
  if (system && !system.input.available) blockers.push(`Otomasi input OS tidak tersedia: ${system.input.reason}`);
  const errCount = events.filter((e) => e.kind === 'error' || e.ok === false).length;

  return (
    <>
      <div className="topbar"><h2 className="display">Control Session</h2><ModelBar mode="control" /><StatusPill task={task} /></div>
      <div className="page" style={{ overflow: 'hidden' }}>
        <div className="ctl" style={{ gridTemplateRows: ap ? '1fr auto auto' : '1fr auto' }}>
          <section className="ctl-left" aria-label="Chat dan rencana">
            <div style={{ flex: '1 1 55%', minHeight: 0 }}>
              <ControlChat />
            </div>
            <div className="panel-h" style={{ borderTop: '1px solid var(--line)' }}>Rencana & progres</div>
            <div style={{ overflow: 'auto', maxHeight: '38%' }}>
              <PlanList steps={task ? plans[task.id] : undefined} />
              {lastTitle && live && <div className="plan"><div className="plan-step active"><motion.span animate={{ opacity: [1, .4, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>▶</motion.span><span><small style={{ color: 'var(--faint)' }}>Langkah saat ini</small><br />{lastTitle}</span></div></div>}
            </div>
          </section>

          <section className="ctl-mid" aria-label="Pratinjau layar">
            <div className="row wrap">
              <span className={`chip ${capture.active ? 'ok' : ''}`}><span className={`dot ${capture.active ? 'live' : ''}`} />{capture.active ? 'Menangkap layar' : 'Tidak menangkap layar'}</span>
              {capture.reason && <span className="chip bad" title={capture.reason}><AlertTriangle size={12} />{capture.reason.slice(0, 70)}</span>}
              <span className="chip"><Eye size={12} />Pratinjau lokal — tidak dikirim ke AI</span>
            </div>
            {blockers.length > 0 && !live && (
              <div className="stack" style={{ gap: 6 }}>
                {blockers.map((b) => <div key={b} className="status-banner warn"><AlertTriangle size={15} />{b}</div>)}
                <div className="row"><button className="btn sm" onClick={() => setPage('permissions')}>Buka Permission Center</button><button className="btn sm" onClick={() => setPage('settings')}>Pengaturan penyedia</button></div>
              </div>
            )}
            <Preview />
          </section>

          <section className="ctl-right" aria-label="Aktivitas agen">
            <div className="tabs" role="tablist">
              {([['timeline', 'Timeline'], ['tools', 'Tool calls'], ['perms', 'Izin'], ['logs', 'Log'], ['errors', `Error${errCount ? ` (${errCount})` : ''}`]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
            </div>
            {tab === 'timeline' && <Timeline events={events} />}
            {tab === 'tools' && <Timeline events={events} filter={(e) => e.kind === 'tool_call' || e.kind === 'tool_result'} />}
            {tab === 'logs' && <Timeline events={events} filter={(e) => e.kind === 'status' || e.kind === 'plan' || e.kind === 'warning' || e.kind === 'approval'} />}
            {tab === 'errors' && <Timeline events={events} filter={(e) => e.kind === 'error' || e.ok === false} />}
            {tab === 'perms' && (
              <div className="tl">
                {(['screen', 'input', 'terminal', 'filesystem', 'apps'] as const).map((k) => (
                  <div key={k} className="tl-item" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                    <span><b>{{ screen: 'Screen observation', input: 'Mouse & keyboard', terminal: 'Terminal', filesystem: 'File system', apps: 'Application management' }[k]}</b></span>
                    <button className={`btn sm ${perms.grants[k] ? 'ok' : ''}`} onClick={() => updatePermissions({ grants: { [k]: !perms.grants[k] } })}>{perms.grants[k] ? 'Diizinkan — cabut' : 'Diblokir — izinkan'}</button>
                  </div>
                ))}
                <div className="tl-item" style={{ gridTemplateColumns: '1fr' }}><span>Mode: <b>{perms.mode}</b> • Kirim screenshot ke AI: <b>{perms.allowScreenshotUpload ? 'ya' : 'tidak'}</b></span></div>
              </div>
            )}
          </section>

          {ap && (
            <div className="approval-inline" role="alertdialog" aria-label="Persetujuan tindakan AI">
              <div style={{ flex: 1, minWidth: 0 }}><ApprovalBody a={ap} /></div>
              <div style={{ alignSelf: 'center' }}><ApprovalActions a={ap} compact /></div>
            </div>
          )}

          <div className="ctl-bar">
            <button className="btn" disabled={!live || task?.status === 'paused'} onClick={() => task && pauseTask(task.id)}><Pause size={16} />Pause</button>
            <button className="btn" disabled={task?.status !== 'paused'} onClick={() => task && resumeTask(task.id)}><Play size={16} />Resume</button>
            <button className="btn danger" disabled={!live} onClick={() => task && stopTask(task.id)}><Square size={14} fill="currentColor" />Stop</button>
            <span style={{ width: 1, height: 24, background: 'var(--line2)' }} />
            <button className="btn ok" disabled={!ap} onClick={() => ap && respondApproval(ap.id, true)}><Check size={16} />Approve</button>
            <button className="btn danger" disabled={!ap} onClick={() => ap && respondApproval(ap.id, false)}><X size={16} />Reject</button>
            <span className="spacer" />
            <small style={{ color: 'var(--faint)' }}>Stop menghentikan eksekusi seketika dan menolak semua persetujuan yang menunggu.</small>
          </div>
        </div>
      </div>
    </>
  );
}

function ControlChat() {
  const conv = store.use((s) => s.conv);
  const task = useCurrentTask('control');
  const has = conv?.mode === 'control' && conv.messages.length > 0;
  return (
    <div className="chat-wrap">
      <div style={{ flex: 1, minHeight: 0 }}>
        {has ? <Messages mode="control" task={task} /> : <Empty title="Perintahkan komputer Anda"><p style={{ fontSize: '.88rem' }}>Contoh: “Buka VS Code, buka proyek saya, cari error, perbaiki, lalu jalankan aplikasinya.”</p></Empty>}
      </div>
      <Composer mode="control" task={task} placeholder="Apa yang harus dilakukan di komputer?" />
    </div>
  );
}
