import { AnimatePresence, motion } from 'framer-motion';
import { Component, useEffect, type ReactNode } from 'react';
import { ApprovalCard } from '@/components/agent';
import { Sidebar } from '@/components/Sidebar';
import { init, store } from '@/lib/state';
import { ChatPage } from '@/pages/ChatPage';
import { CodePage } from '@/pages/CodePage';
import { HistoryPage } from '@/pages/HistoryPage';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Logo, Modal } from '@/components/ui';
import { AuthGate } from '@/components/AuthGate';

const PAGES = { chat: ChatPage, code: CodePage, permissions: PermissionsPage, history: HistoryPage, settings: SettingsPage };

class Boundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return <div className="empty"><div><h1>Terjadi kesalahan tampilan</h1><p>{this.state.err.message}</p><button className="btn primary" onClick={() => this.setState({ err: undefined })}>Coba lagi</button></div></div>;
    return this.props.children;
  }
}

/** Persetujuan tampil inline di thread Code; bila tidak terlihat di sana (halaman lain / task percakapan lain) tampil sebagai dialog agar tidak pernah macet. */
function ApprovalHost() {
  const approvals = store.use((s) => s.approvals);
  const page = store.use((s) => s.page);
  const conv = store.use((s) => s.conv);
  const taskConv = store.use((s) => s.taskConv);
  const hidden = approvals.filter((a) => !(page === 'code' && conv && (!a.taskId || taskConv[a.taskId] === conv.id)));
  if (!hidden.length) return null;
  return <Modal label="Persetujuan tindakan AI"><ApprovalCard a={hidden[0]} count={hidden.length} /></Modal>;
}

export default function App() {
  const ready = store.use((s) => s.ready);
  const page = store.use((s) => s.page);
  const toasts = store.use((s) => s.toasts);
  const auth = store.use((s) => s.auth);
  useEffect(() => { void init(); }, []);
  if (!ready) return <div className="empty" style={{ height: '100%' }}><div><Logo size={56} /><p>Memuat…</p></div></div>;
  const Page = PAGES[page];
  if (auth?.status === 'none') return <><AuthGate /><div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div></>;
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={page} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .14 }}>
            <Boundary><Page /></Boundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <ApprovalHost />
      <div className="toasts" aria-live="polite"><AnimatePresence>{toasts.map((t) => <motion.div key={t.id} className={`toast ${t.kind}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>{t.text}</motion.div>)}</AnimatePresence></div>
    </div>
  );
}
