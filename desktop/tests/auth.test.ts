import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuthError, AuthService, SUPABASE_KEY, type StoredAuth } from '../src/main/auth';
import { HistorySync, conversationToRow, rowToConversation } from '../src/main/history-sync';
import { Store } from '../src/main/store';
import { SevenMitProvider } from '../src/main/agent/llm';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const memPersist = (persisted = true) => { let v: StoredAuth | undefined; return { get: () => v, p: { load: () => v, save: (a: StoredAuth | undefined) => { v = a; return { persisted }; } } }; };
const sessionBody = (over: Record<string, unknown> = {}) => ({ access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, user: { id: 'u1', email: 'a@b.co', user_metadata: { display_name: 'Ayu' } }, ...over });

describe('AuthService', () => {
  it('login email: menyimpan sesi, status tanpa token, header apikey benar', async () => {
    const m = memPersist();
    let seen: { url: string; headers: Record<string, string>; body: any } | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
    const a = new AuthService(m.p, (async (url: string, init: RequestInit) => { seen = { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) }; return json(sessionBody()); }) as unknown as typeof fetch);
    await a.signIn('a@b.co', 'secret1');
    expect(seen!.url).toContain('/auth/v1/token?grant_type=password');
    expect(seen!.headers.apikey).toBe(SUPABASE_KEY);
    const st = a.state();
    expect(st).toMatchObject({ status: 'user', email: 'a@b.co', profile: { display_name: 'Ayu', provider: 'email' } });
    expect(JSON.stringify(st)).not.toContain('AT1');
    expect(a.userId()).toBe('u1');
    expect(await a.accessToken()).toBe('AT1');
    expect(m.get()?.session?.access_token).toBe('AT1');
  });
  it('galat server diterjemahkan dan tidak menyimpan sesi', async () => {
    const m = memPersist();
    const a = new AuthService(m.p, (async () => json({ msg: 'Invalid login credentials' }, 400)) as unknown as typeof fetch);
    await expect(a.signIn('a@b.co', 'salah1')).rejects.toThrow('Email atau kata sandi salah.');
    expect(a.state().status).toBe('none');
    expect(m.get()).toBeUndefined();
  });
  it('jaringan putus: galat jelas', async () => {
    const a = new AuthService(memPersist().p, (async () => { throw new Error('ENOTFOUND'); }) as unknown as typeof fetch);
    await expect(a.signIn('a@b.co', 'secret1')).rejects.toBeInstanceOf(AuthError);
  });
  it('signup: butuh konfirmasi email bila tidak ada access_token', async () => {
    const a = new AuthService(memPersist().p, (async () => json({ id: 'u9', email: 'x@y.z' })) as unknown as typeof fetch);
    expect(await a.signUp('x@y.z', 'secret1')).toBe(false);
    expect(a.state().status).toBe('none');
  });
  it('refresh otomatis saat token hampir kedaluwarsa; user dipertahankan', async () => {
    let t = 1_000_000_000_000;
    const calls: string[] = [];
    const a = new AuthService(memPersist().p, (async (url: string) => { calls.push(url); return json(url.includes('refresh_token') ? { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 } : sessionBody({ expires_in: 100 })); }) as unknown as typeof fetch, () => t);
    await a.signIn('a@b.co', 'secret1');
    t += 50_000; // masuk jendela 60 dtk -> refresh
    expect(await a.accessToken()).toBe('AT2');
    expect(calls.some((c) => c.includes('grant_type=refresh_token'))).toBe(true);
    expect(a.userId()).toBe('u1');
  });
  it('refresh ditolak server -> kembali ke status none (login ulang)', async () => {
    let t = 1_000_000_000_000;
    const a = new AuthService(memPersist().p, (async (url: string) => (url.includes('refresh_token') ? json({ error_description: 'bad' }, 400) : json(sessionBody({ expires_in: 10 })))) as unknown as typeof fetch, () => t);
    await a.signIn('a@b.co', 'secret1');
    t += 100_000;
    expect(await a.accessToken()).toBeUndefined();
    expect(a.state().status).toBe('none');
  });
  it('refresh gagal karena jaringan: sesi dipertahankan', async () => {
    let t = 1_000_000_000_000; let down = false;
    const a = new AuthService(memPersist().p, (async () => { if (down) throw new Error('offline'); return json(sessionBody({ expires_in: 10 })); }) as unknown as typeof fetch, () => t);
    await a.signIn('a@b.co', 'secret1');
    down = true; t += 100_000;
    await a.accessToken();
    expect(a.state().status).toBe('user');
  });
  it('SSO akun.7mit: pilih akun lalu masuk; konteks organisasi', async () => {
    const calls: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const a = new AuthService(memPersist().p, (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string); calls.push({ url, body });
      return body.account_key ? json({ session: sessionBody(), profile: { display_name: 'Guru A', role: 'guru', account_type: 'staff' } }) : json({ requires_selection: true, accounts: [{ account_key: 'k1', display_name: 'Guru A', account_type: 'staff', role: 'guru' }] });
    }) as unknown as typeof fetch);
    const r1 = await a.ssoSignIn('guru', 'pw');
    expect(r1).toMatchObject({ requiresSelection: true });
    expect(a.state().status).toBe('none');
    const r2 = await a.ssoSignIn('guru', 'pw', 'k1');
    expect(r2.requiresSelection).toBe(false);
    expect(a.state().profile).toMatchObject({ provider: 'akun7mit', role: 'guru' });
    expect(a.accountContext()).toMatchObject({ mode: 'organization', organization: '7 MIT', role: 'guru' });
    expect(calls[0].url).toContain('/functions/v1/intellegence-7mit-auth');
  });
  it('tamu & keluar; sesi dipulihkan dari penyimpanan', async () => {
    const m = memPersist();
    const a = new AuthService(m.p, (async () => json({})) as unknown as typeof fetch);
    a.continueAsGuest();
    expect(a.state().status).toBe('guest');
    expect(a.accountContext()).toEqual({ mode: 'guest' });
    const b = new AuthService(m.p);
    expect(b.state().status).toBe('guest');
    await b.signOut();
    expect(b.state().status).toBe('none');
  });
  it('enkripsi OS tidak tersedia: sesi hanya di memori dan diberi tanda', async () => {
    const a = new AuthService(memPersist(false).p, (async () => json(sessionBody())) as unknown as typeof fetch);
    await a.signIn('a@b.co', 'secret1');
    expect(a.state().persisted).toBe(false);
  });
});

describe('Store: sesi terenkripsi', () => {
  it('sesi tidak muncul sebagai teks biasa & pulih setelah restart', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'it7a-'));
    const crypto = { available: () => true, encrypt: (s: string) => Buffer.from('E:' + s).toString('base64'), decrypt: (s: string) => Buffer.from(s, 'base64').toString().slice(2) };
    const s1 = new Store(dir, crypto);
    expect(s1.saveAuth({ session: { access_token: 'SECRET-TOKEN-XYZ', expires_at: 9e9, user: { id: 'u' } }, profile: { display_name: 'A', provider: 'email' } }).persisted).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8')).not.toContain('SECRET-TOKEN-XYZ');
    expect(new Store(dir, crypto).loadAuth()?.session?.access_token).toBe('SECRET-TOKEN-XYZ');
    const s2 = new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'it7a-')), { ...crypto, available: () => false });
    expect(s2.saveAuth({ session: { access_token: 'T', expires_at: 1 } }).persisted).toBe(false);
    expect(s2.loadAuth()).toBeUndefined();
  });
});

describe('HistorySync', () => {
  const mk = (remoteRows: any[], onReq?: (url: string, init: RequestInit) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'it7h-'));
    const store = new Store(dir, { available: () => false, encrypt: (s) => s, decrypt: (s) => s });
    const f = (async (url: string, init: RequestInit = {}) => { onReq?.(url, init); if ((init.method ?? 'GET') === 'GET') return json(remoteRows); return new Response(null, { status: 201 }); }) as unknown as typeof fetch;
    const auth = new AuthService({ load: () => undefined, save: () => ({ persisted: true }) }, (async () => json(sessionBody())) as unknown as typeof fetch);
    return { store, f, auth };
  };
  it('mengonversi baris web <-> percakapan', () => {
    const c = rowToConversation({ id: 'c1', title: 'T', messages: [{ role: 'user', content: 'hai' }, { role: 'assistant', content: 'halo' }, { role: 'system', content: 'x' }], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' });
    expect(c.mode).toBe('chat');
    expect(c.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const row = conversationToRow(c, 'u1');
    expect(row.user_id).toBe('u1');
    expect(row.messages[0]).toMatchObject({ role: 'user', content: 'hai' });
    expect(Object.keys(row.messages[0]).sort()).toEqual(['content', 'createdAt', 'id', 'role']);
  });
  it('sync: tarik yang lebih baru, dorong yang lokal-lebih-baru, abaikan percakapan Code', async () => {
    const reqs: { url: string; init: RequestInit }[] = [];
    const h = mk([
      { id: 'r1', title: 'Dari web', messages: [{ role: 'user', content: 'a' }], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
      { id: 'shared', title: 'Lama di web', messages: [{ role: 'user', content: 'old' }], created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-05T00:00:00Z' }
    ], (url, init) => reqs.push({ url, init }));
    await h.auth.signIn('a@b.co', 'secret1');
    h.store.saveConversation({ id: 'shared', title: 'Baru lokal', mode: 'chat', messages: [{ id: 'm', role: 'user', content: 'new', createdAt: 1 }], createdAt: 1, updatedAt: new Date('2026-02-01').getTime() });
    h.store.saveConversation({ id: 'code1', title: 'Kode', mode: 'code', messages: [{ id: 'm2', role: 'user', content: 'x', createdAt: 1 }], createdAt: 1, updatedAt: Date.now() });
    const sync = new HistorySync(h.auth, h.store, h.f, 5);
    const r = await sync.sync();
    expect(r).toEqual({ pulled: 1, pushed: 1 });
    expect(h.store.getConversation('r1')?.title).toBe('Dari web');
    const post = reqs.find((x) => x.init.method === 'POST')!;
    const rows = JSON.parse(post.init.body as string);
    expect(rows.map((x: { id: string }) => x.id)).toEqual(['shared']);
    expect((post.init.headers as Record<string, string>).Authorization).toBe('Bearer AT1');
  });
  it('sync tanpa login tidak melakukan apa pun; galat jaringan dilaporkan jelas', async () => {
    const h = mk([]);
    expect(await new HistorySync(h.auth, h.store, h.f).sync()).toEqual({ pulled: 0, pushed: 0 });
    await h.auth.signIn('a@b.co', 'secret1');
    const bad = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await expect(new HistorySync(h.auth, h.store, bad).sync()).rejects.toThrow(/Sinkronisasi riwayat gagal/);
  });
});

describe('SevenMitProvider memakai token akun', () => {
  it('Bearer = token login bila ada, anon key bila tamu; account_context ikut', async () => {
    const seen: { auth: string; ctx: unknown }[] = [];
    const f = (async (_u: string, init: RequestInit) => { seen.push({ auth: (init.headers as Record<string, string>).Authorization, ctx: JSON.parse(init.body as string).account_context }); return json({ answer: 'ok' }); }) as unknown as typeof fetch;
    const cfg = { id: 's', name: 's', kind: 'intelligence7mit' as const, baseUrl: 'https://x/f', model: 'm', supportsTools: false, supportsVision: false, hasKey: true };
    const msg = [{ role: 'user' as const, content: 'hai' }];
    await new SevenMitProvider(cfg, 'ANON', f, { token: async () => 'USER-JWT', context: () => ({ mode: 'personal' }) }).chat({ messages: msg });
    await new SevenMitProvider(cfg, 'ANON', f).chat({ messages: msg });
    expect(seen[0]).toEqual({ auth: 'Bearer USER-JWT', ctx: { mode: 'personal' } });
    expect(seen[1]).toEqual({ auth: 'Bearer ANON', ctx: { mode: 'guest' } });
  });
});
