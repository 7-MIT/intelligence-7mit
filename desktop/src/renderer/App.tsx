import { AnimatePresence, motion } from 'framer-motion';
import { Component, useEffect, type ReactNode } from 'react';
import { ApprovalHost } from '@/components/agent';
import { Sidebar } from '@/components/Sidebar';
import { init, store } from '@/lib/state';
import { ChatPage } from '@/pages/ChatPage';
import { CodePage } from '@/pages/CodePage';
import { ControlPage } from '@/pages/ControlPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WebPage } from '@/pages/WebPage';
import { Logo } from '@/components/ui';

const PAGES = { chat: ChatPage, code: CodePage, web: WebPage, control: ControlPage, permissions: PermissionsPage, history: HistoryPage, settings: SettingsPage };

class Boundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return <div className="empty"><div><h1>Terjadi kesalahan tampilan</h1><p>{this.state.err.message}</p><button className="btn primary" onClick={() => this.setState({ err: undefined })}>Coba lagi</button></div></div>;
    return this.props.children;
  }
}

export default function App() {
  const ready = store.use((s) => s.ready);
  const page = store.use((s) => s.page);
  const toasts = store.use((s) => s.toasts);
  useEffect(() => { void init(); }, []);
  if (!ready) return <div className="empty" style={{ height: '100%' }}><div><Logo size={56} /><p>Memuat…</p></div></div>;
  const Page = PAGES[page];
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
