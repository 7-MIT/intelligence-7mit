import { redact } from './security/audit';

export const SUPABASE_URL = 'https://lajzrempjyoqkubkumhb.supabase.co';
/** Kunci *publishable* Supabase yang sama dengan frontend web (publik by design, bukan rahasia). */
export const SUPABASE_KEY = 'sb_publishable_yGZ90Bkv3yreqc9pA55bpw_YKKBhWRw';
/** Hanya untuk pengujian E2E pada build pengembangan (services.ts memastikan !app.isPackaged). */
export const endpoints = { base: SUPABASE_URL };
export function setTestBaseUrl(url: string) { endpoints.base = url.replace(/\/+$/, ''); }
const authUrl = () => endpoints.base + '/auth/v1';
const ssoUrl = () => endpoints.base + '/functions/v1/intellegence-7mit-auth';

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  /** detik epoch */
  expires_at: number;
  user?: { id: string; email?: string };
}
export interface AuthProfile {
  display_name: string;
  provider: 'email' | 'akun7mit' | 'guest';
  role?: string;
  account_type?: string;
}
export interface StoredAuth { guest?: boolean; session?: AuthSession; profile?: AuthProfile }
/** Yang boleh dilihat renderer: tanpa token. */
export interface AuthState { status: 'none' | 'guest' | 'user'; profile?: AuthProfile; email?: string; persisted?: boolean }
export type SsoResult = { requiresSelection: true; accounts: { account_key: string; display_name: string; account_type: string; role: string }[] } | { requiresSelection: false };

export interface AuthPersistence {
  load(): StoredAuth | undefined;
  /** Mengembalikan false bila sesi tidak dapat disimpan terenkripsi (hanya di memori). */
  save(a: StoredAuth | undefined): { persisted: boolean };
}

const FRIENDLY: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email atau kata sandi salah.'],
  [/email not confirmed/i, 'Email belum dikonfirmasi. Periksa kotak masuk Anda.'],
  [/user already registered/i, 'Email ini sudah terdaftar. Silakan masuk.'],
  [/password should be at least/i, 'Kata sandi terlalu pendek (minimal 6 karakter).'],
  [/rate limit|too many requests/i, 'Terlalu banyak percobaan. Coba lagi beberapa saat.']
];
const friendly = (m: string) => FRIENDLY.find(([re]) => re.test(m))?.[1] ?? m;

export class AuthError extends Error {}

export class AuthService {
  private data: StoredAuth | undefined;
  private memoryOnly = false;
  private listeners = new Set<(s: AuthState) => void>();
  private refreshing: Promise<AuthSession | undefined> | null = null;

  constructor(private persistence: AuthPersistence, private fetchImpl: typeof fetch = fetch, private now: () => number = Date.now) {
    this.data = persistence.load();
  }

  onChange(fn: (s: AuthState) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { const s = this.state(); this.listeners.forEach((l) => l(s)); }
  private commit(next: StoredAuth | undefined) {
    this.data = next;
    this.memoryOnly = !this.persistence.save(next).persisted && !!next?.session;
    this.emit();
  }

  state(): AuthState {
    if (this.data?.session) return { status: 'user', profile: this.data.profile, email: this.data.session.user?.email, persisted: !this.memoryOnly };
    if (this.data?.guest) return { status: 'guest', profile: this.data.profile ?? { display_name: 'Tamu', provider: 'guest' } };
    return { status: 'none' };
  }
  userId(): string | undefined { return this.data?.session?.user?.id; }

  private async call(path: string, body: unknown, token?: string): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    let res: Response;
    try {
      res = await this.fetchImpl(authUrl() + path, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    } catch (e) { throw new AuthError(`Tidak dapat terhubung ke server akun: ${(e as Error).message}`); }
    const data = (await res.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) throw new AuthError(friendly(redact(String(data.msg || data.message || data.error_description || 'Autentikasi gagal.'))));
    return data;
  }

  private toSession(d: Record<string, any>): AuthSession { // eslint-disable-line @typescript-eslint/no-explicit-any
    const expires_in = Number(d.expires_in || 3600);
    return {
      access_token: String(d.access_token),
      refresh_token: d.refresh_token ? String(d.refresh_token) : undefined,
      expires_at: Number(d.expires_at) || Math.floor(this.now() / 1000) + expires_in,
      user: d.user?.id ? { id: String(d.user.id), email: d.user.email } : undefined
    };
  }

  async signIn(email: string, password: string): Promise<void> {
    const d = await this.call('/token?grant_type=password', { email, password });
    if (!d.access_token) throw new AuthError('Respons login tidak valid.');
    const session = this.toSession(d);
    this.commit({ session, profile: { display_name: d.user?.user_metadata?.display_name || email.split('@')[0], provider: 'email' } });
  }

  /** true bila langsung masuk; false bila butuh konfirmasi email. */
  async signUp(email: string, password: string): Promise<boolean> {
    const d = await this.call('/signup', { email, password, data: { display_name: email.split('@')[0] } });
    if (!d.access_token) return false;
    this.commit({ session: this.toSession(d), profile: { display_name: d.user?.user_metadata?.display_name || email.split('@')[0], provider: 'email' } });
    return true;
  }

  async recover(email: string): Promise<void> { await this.call('/recover', { email }); }

  /** Login akun.7mit lewat edge function yang sama dengan web. */
  async ssoSignIn(username: string, password: string, accountKey?: string): Promise<SsoResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(ssoUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, ...(accountKey ? { account_key: accountKey } : {}) }) });
    } catch (e) { throw new AuthError(`Tidak dapat terhubung ke server akun.7mit: ${(e as Error).message}`); }
    const d = (await res.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) throw new AuthError(redact(String(d.error || 'Login akun.7mit gagal.')));
    if (d.requires_selection) return { requiresSelection: true, accounts: Array.isArray(d.accounts) ? d.accounts : [] };
    if (!d.session?.access_token) throw new AuthError('Respons login akun.7mit tidak valid.');
    this.commit({
      session: this.toSession(d.session),
      profile: { display_name: String(d.profile?.display_name || username), provider: 'akun7mit', role: d.profile?.role, account_type: d.profile?.account_type }
    });
    return { requiresSelection: false };
  }

  continueAsGuest() { this.commit({ guest: true, profile: { display_name: 'Tamu', provider: 'guest' } }); }

  async signOut(): Promise<void> {
    const token = this.data?.session?.access_token;
    this.commit(undefined);
    if (token) await this.call('/logout', {}, token).catch(() => undefined); // best-effort
  }

  /** Token akses valid (di-refresh bila hampir kedaluwarsa). undefined bila tamu / tidak login. */
  async accessToken(): Promise<string | undefined> {
    const s = this.data?.session;
    if (!s) return undefined;
    if (s.expires_at * 1000 > this.now() + 60_000) return s.access_token;
    return (await this.refresh())?.access_token;
  }

  private refresh(): Promise<AuthSession | undefined> {
    this.refreshing ??= (async () => {
      const s = this.data?.session;
      if (!s?.refresh_token) { this.commit(undefined); return undefined; }
      try {
        const d = await this.call('/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
        if (!d.access_token) throw new AuthError('refresh gagal');
        const next = this.toSession(d);
        next.user ??= s.user;
        this.commit({ ...this.data, session: next });
        return next;
      } catch (e) {
        if (e instanceof AuthError && /terhubung/.test(e.message)) return s; // jaringan: pertahankan sesi, coba lagi nanti
        this.commit(undefined); // sesi ditolak server -> perlu login ulang
        return undefined;
      }
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  accountContext(): Record<string, unknown> {
    const p = this.data?.profile;
    if (p?.provider === 'akun7mit') return { mode: 'organization', organization: '7 MIT', role: p.role ?? '', account_type: p.account_type ?? '' };
    return { mode: this.data?.session ? 'personal' : 'guest' };
  }
}
