import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, UserRound } from 'lucide-react';
import { useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { onSignedIn, store, toast } from '@/lib/state';
import { Logo } from './ui';

type View = 'email' | 'sso' | 'reset';

export function AuthGate({ onClose }: { onClose?: () => void }) {
  const [view, setView] = useState<View>('email');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState('');
  const [accounts, setAccounts] = useState<{ account_key: string; display_name: string; account_type: string; role: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const done = async (st: Parameters<typeof onSignedIn>[0], err?: string) => { await onSignedIn(st, err); onClose?.(); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ text: errMsg(e) }); } finally { setBusy(false); }
  };
  const submitEmail = () => run(async () => {
    if (mode === 'login') { const r = await api.auth.signIn({ email, password }); if (r) await done(r.state, r.syncError); }
    else {
      const r = await api.auth.signUp({ email, password });
      if (r?.signedIn) await done(r.state, r.syncError); else setMsg({ text: 'Akun dibuat. Periksa email Anda untuk mengonfirmasi, lalu masuk.', ok: true });
    }
  });
  const submitSso = (accountKey?: string) => run(async () => {
    const r = await api.auth.sso({ username, password, accountKey });
    if (!r) return;
    if (r.requiresSelection) setAccounts(r.accounts ?? []); else await done(r.state, r.syncError);
  });
  const reset = () => run(async () => { await api.auth.recover({ email }); setMsg({ text: 'Tautan reset kata sandi telah dikirim. Periksa email Anda.', ok: true }); });
  const guest = () => run(async () => { const st = await api.auth.guest(); if (st) await done(st); });

  return (
    <div className="gate" role="dialog" aria-label="Masuk">
      <motion.div className="gate-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {onClose && <button className="icon-btn" style={{ position: 'absolute', left: 12, top: 12 }} aria-label="Tutup" onClick={onClose}><ArrowLeft size={17} /></button>}
        <Logo size={44} />
        <h1 className="serif">{view === 'reset' ? 'Atur ulang kata sandi' : mode === 'login' ? 'Selamat datang kembali' : 'Buat akun baru'}</h1>
        <p className="sub">{view === 'reset' ? 'Kami kirim tautan reset ke email Anda.' : mode === 'login' ? 'Masuk agar riwayat Chat tersinkron dengan akun intelligence.7mit Anda.' : 'Daftar agar riwayat Chat tersimpan di akun Anda.'}</p>

        {view === 'email' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submitEmail(); }}>
            <div className="seg2" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Masuk</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Daftar</button>
            </div>
            <label className="field"><span>Email</span><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" /></label>
            <label className="field"><span>Kata sandi</span>
              <div className="row" style={{ position: 'relative' }}>
                <input className="input" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Kata sandi" />
                <button type="button" className="icon-btn" style={{ position: 'absolute', right: 4 }} aria-label={show ? 'Sembunyikan' : 'Tampilkan'} onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
            <button className="btn primary gate-btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />}{mode === 'login' ? 'Masuk dengan email' : 'Daftar'}</button>
            {mode === 'login' && <button type="button" className="linkish" onClick={() => { setView('reset'); setMsg(null); }}>Lupa kata sandi?</button>}
          </form>
        )}

        {view === 'reset' && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void reset(); }}>
            <label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email reset" /></label>
            {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
            <button className="btn primary gate-btn" disabled={busy}>Kirim tautan reset</button>
            <button type="button" className="linkish" onClick={() => { setView('email'); setMsg(null); }}>Kembali ke login</button>
          </form>
        )}

        {view === 'sso' && !accounts && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); void submitSso(); }}>
            <label className="field"><span>Username akun.7mit</span><input className="input" required value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Username akun.7mit" autoComplete="username" /></label>
            <label className="field"><span>Kata sandi</span><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Kata sandi akun.7mit" autoComplete="current-password" /></label>
            {msg && <div className={`status-banner ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
            <button className="btn primary gate-btn" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />}Masuk dengan akun.7mit</button>
            <button type="button" className="linkish" onClick={() => { setView('email'); setMsg(null); }}>Kembali</button>
          </form>
        )}
        {view === 'sso' && accounts && (
          <div className="stack">
            <b style={{ textAlign: 'left' }}>Pilih akun</b>
            {accounts.map((a) => <button key={a.account_key} className="sug" disabled={busy} onClick={() => void submitSso(a.account_key)}><b>{a.display_name}</b>{a.account_type} · {a.role}</button>)}
            <button type="button" className="linkish" onClick={() => setAccounts(null)}>Kembali</button>
          </div>
        )}

        {view !== 'reset' && !accounts && (
          <>
            <div className="gate-or"><span>atau</span></div>
            {view === 'email' && <button className="btn gate-btn" onClick={() => { setView('sso'); setMsg(null); }}><KeyRound size={16} />Masuk dengan akun.7mit</button>}
            <button className="btn gate-btn" disabled={busy} onClick={() => void guest()}><UserRound size={16} />Lanjut sebagai tamu</button>
            <small style={{ color: 'var(--faint)' }}>Mode tamu: riwayat hanya tersimpan di komputer ini, tanpa sinkron.</small>
          </>
        )}
      </motion.div>
    </div>
  );
}
export { store, toast };
