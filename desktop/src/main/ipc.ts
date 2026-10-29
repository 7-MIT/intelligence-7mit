import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell, systemPreferences, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { CH, schemas } from '@shared/ipc';
import type { SystemStatus } from '@shared/types';
import { listModels, OpenAICompatProvider, type LLMProvider } from './agent/llm';
import { gitCommitAll, gitDiff, gitStatus } from './code/git';
import type { Services } from './services';
import { validateUrl } from './browser/controller';

export interface IpcHooks {
  getWindow(): BrowserWindow | null;
  isTrusted(url: string): boolean;
  applySettings(): void;
  checkUpdate(): Promise<string>;
  startBrowserStream(): void;
}

/** Semua handler: verifikasi pengirim -> validasi zod -> eksekusi. Error dikembalikan sebagai pesan jelas. */
export function registerIpc(s: Services, hooks: IpcHooks) {
  const handle = <T extends z.ZodTypeAny | null>(channel: string, schema: T, fn: (arg: T extends z.ZodTypeAny ? z.infer<T> : undefined, e: IpcMainInvokeEvent) => unknown | Promise<unknown>) => {
    ipcMain.handle(channel, async (e, raw) => {
      const url = e.senderFrame?.url ?? '';
      if (!hooks.isTrusted(url)) throw new Error('Pengirim IPC tidak tepercaya');
      const arg = schema ? schema.parse(raw) : undefined;
      return fn(arg as never, e);
    });
  };
  const confirmNative = async (message: string, detail: string) => {
    if (process.env.IT7_E2E === '1' && !app.isPackaged) return true; // hook uji otomatis; dinonaktifkan pada build terpasang
    const win = hooks.getWindow();
    const opts = { type: 'warning' as const, buttons: ['Batal', 'Izinkan'], defaultId: 0, cancelId: 0, title: 'Konfirmasi keamanan', message, detail };
    const r = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    return r.response === 1;
  };
  const wsOrThrow = (id: string) => {
    const w = s.store.getWorkspace(id);
    if (!w) throw new Error('Workspace tidak ditemukan');
    return w;
  };
  const userAuth = async (tool: string, kind: 'filesystem' | 'terminal' | 'browser', summary: string, readOnly: boolean, risk: 'low' | 'medium' | 'high' = 'low') => {
    const d = await s.permissions.authorize({ tool, kind, risk, summary, readOnly, actor: 'user' });
    if (!d.allowed) throw new Error(d.reason);
  };

  // Akun (token tidak pernah dikirim ke renderer)
  const syncAfterLogin = async () => { try { await s.history.sync(); } catch (e) { return (e as Error).message; } return undefined; };
  handle(CH.authStatus, null, () => s.auth.state());
  handle(CH.authSignIn, schemas.authEmail, async ({ email, password }) => { await s.auth.signIn(email, password); s.audit.log({ actor: 'user', tool: 'auth.signin', decision: 'ok', summary: 'Masuk dengan email' }); return { state: s.auth.state(), syncError: await syncAfterLogin() }; });
  handle(CH.authSignUp, schemas.authEmail, async ({ email, password }) => { const direct = await s.auth.signUp(email, password); return { signedIn: direct, state: s.auth.state(), syncError: direct ? await syncAfterLogin() : undefined }; });
  handle(CH.authRecover, schemas.authRecover, async ({ email }) => { await s.auth.recover(email); });
  handle(CH.authSso, schemas.authSso, async ({ username, password, accountKey }) => { const r = await s.auth.ssoSignIn(username, password, accountKey); if (r.requiresSelection) return { ...r, state: s.auth.state() }; s.audit.log({ actor: 'user', tool: 'auth.sso', decision: 'ok', summary: 'Masuk dengan akun.7mit' }); return { ...r, state: s.auth.state(), syncError: await syncAfterLogin() }; });
  handle(CH.authGuest, null, () => { s.auth.continueAsGuest(); return s.auth.state(); });
  handle(CH.authSignOut, null, async () => {
    // Dorong perubahan terakhir, lalu bersihkan riwayat Chat lokal agar tidak bocor ke akun lain di komputer yang sama.
    await s.history.sync().catch(() => undefined);
    s.history.flush();
    for (const c of s.store.listConversations()) if (c.mode === 'chat') s.store.deleteConversation(c.id);
    await s.auth.signOut(); s.audit.log({ actor: 'user', tool: 'auth.signout', decision: 'ok', summary: 'Keluar dari akun' }); return s.auth.state(); });
  handle(CH.historySync, null, async () => s.history.sync());

  // Pengaturan & sistem
  handle(CH.settingsGet, null, () => s.store.getSettings());
  handle(CH.settingsSet, schemas.settingsSet, (patch) => { const n = s.store.setSettings(patch); hooks.applySettings(); return n; });
  handle(CH.appInfo, null, () => ({ version: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged, userData: app.getPath('userData'), crashed: crashed }));
  handle(CH.systemStatus, null, async (): Promise<SystemStatus> => {
    const input = await s.driver.availability();
    const mac = process.platform === 'darwin';
    return {
      platform: process.platform, arch: process.arch, version: app.getVersion(),
      safeStorage: (await import('electron')).safeStorage.isEncryptionAvailable(),
      input: { available: input.ok, reason: input.reason },
      screen: { available: true, macScreenStatus: mac ? systemPreferences.getMediaAccessStatus('screen') : undefined, macAccessibility: mac ? systemPreferences.isTrustedAccessibilityClient(false) : undefined },
      encryptionNote: (await import('electron')).safeStorage.isEncryptionAvailable() ? undefined : 'Enkripsi OS (Keychain/DPAPI/libsecret) tidak tersedia: API key hanya disimpan di memori selama aplikasi berjalan.'
    };
  });
  handle(CH.openExternal, schemas.externalUrl, async ({ url }) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Hanya http/https');
    await shell.openExternal(u.toString());
  });

  // Izin
  handle(CH.permGet, null, () => s.permissions.getState());
  handle(CH.permSet, schemas.permSet, async (patch) => {
    const cur = s.permissions.getState();
    const sensitive: string[] = [];
    if (patch.grants?.input && !cur.grants.input) sensitive.push('Mouse & keyboard: AI dapat mengklik dan mengetik di komputer Anda');
    if (patch.grants?.terminal && !cur.grants.terminal) sensitive.push('Terminal: AI dapat menjalankan perintah shell (dengan pembatasan)');
    if (patch.mode === 'auto' && cur.mode !== 'auto') sensitive.push('Mode Auto Execute: tindakan berisiko rendah di workspace yang disetujui berjalan tanpa bertanya');
    if (patch.allowScreenshotUpload && !cur.allowScreenshotUpload) sensitive.push('Screenshot layar Anda akan dikirim ke penyedia AI yang dipilih');
    const newFolders = (patch.allowedFolders ?? []).filter((f) => !cur.allowedFolders.includes(f));
    if (newFolders.length) sensitive.push(`Akses folder: ${newFolders.join(', ')}`);
    if (sensitive.length && !(await confirmNative('Berikan izin ini?', sensitive.join('\n• ')))) throw new Error('Perubahan izin dibatalkan');
    for (const f of [...(patch.allowedFolders ?? []), ...(patch.autoWorkspaces ?? [])]) {
      if (!path.isAbsolute(f) || !fs.existsSync(f) || !fs.statSync(f).isDirectory()) throw new Error(`Folder tidak valid: ${f}`);
      if (path.dirname(f) === f) throw new Error('Root drive tidak boleh diizinkan');
    }
    const norm = (l?: string[]) => l?.map((f) => fs.realpathSync(f));
    const clean = { ...patch, allowedFolders: norm(patch.allowedFolders), autoWorkspaces: norm(patch.autoWorkspaces) };
    return s.permissions.update(clean);
  });
  handle(CH.permRequestMac, null, async () => {
    if (process.platform !== 'darwin') return { ok: false, message: 'Hanya relevan di macOS' };
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');
    if (screenStatus !== 'granted') await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    return { ok: trusted && screenStatus === 'granted', accessibility: trusted, screen: screenStatus, message: 'Berikan izin di System Settings → Privacy & Security, lalu mulai ulang aplikasi.' };
  });
  handle(CH.approvalRespond, schemas.approval, ({ id, approved, remember }) => s.broker.respond(id, approved, remember));

  // Penyedia AI
  handle(CH.providersList, null, () => s.store.listProviders().map((p) => ({ ...p })));
  handle(CH.providerSave, schemas.providerSave, (p) => s.store.saveProvider({ ...p }));
  handle(CH.providerDelete, schemas.idOnly, ({ id }) => { s.store.deleteProvider(id); if (s.store.getSettings().activeProviderId === id) s.store.setSettings({ activeProviderId: 'seven-mit' }); });
  handle(CH.providerKey, schemas.providerKey, ({ id, key }) => { if (!s.store.getProvider(id)) throw new Error('Penyedia tidak ada'); return s.store.setKey(id, key.trim()); });
  handle(CH.providerModels, schemas.idOnly, async ({ id }) => {
    const p = s.store.getProvider(id); const key = s.store.getKey(id);
    if (!p || p.kind !== 'openai') throw new Error('Penyedia ini tidak mendukung daftar model');
    if (!key) throw new Error('API key belum diatur');
    return listModels(p.baseUrl, key);
  });
  handle(CH.providerTest, schemas.idOnly, async ({ id }) => {
    const cfg = s.store.getProvider(id);
    if (!cfg) throw new Error('Penyedia tidak ada');
    const prov: LLMProvider = cfg.kind === 'openai' ? new OpenAICompatProvider(cfg, () => s.store.getKey(id)) : s.getProvider();
    const out: Record<string, string> = {};
    try {
      const r = await prov.chat({ messages: [{ role: 'user', content: 'Balas hanya dengan kata: ok' }] });
      out.chat = r.content ? `OK (“${r.content.slice(0, 40)}”)` : 'Respons kosong';
    } catch (e) { out.chat = `GAGAL: ${(e as Error).message}`; return out; }
    if (cfg.kind === 'openai') {
      try {
        const r = await prov.chat({ messages: [{ role: 'user', content: 'Panggil tool get_time sekarang.' }], tools: [{ type: 'function', function: { name: 'get_time', description: 'Mengambil waktu', parameters: { type: 'object', properties: {}, additionalProperties: false } } }] });
        out.tools = r.toolCalls.length ? 'Terverifikasi: model memanggil tool' : 'Tidak teramati: model tidak memanggil tool pada uji ini';
      } catch (e) { out.tools = `GAGAL: ${(e as Error).message}`; }
      try {
        const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        await prov.chat({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Warna gambar ini? Jawab satu kata.' }, { type: 'image_url', image_url: { url: px } }] }] });
        out.vision = 'Gambar diterima oleh API (dukungan vision kemungkinan ada)';
      } catch (e) { out.vision = `Tidak didukung / ditolak: ${(e as Error).message.slice(0, 160)}`; }
    } else out.tools = out.vision = 'Tidak didukung backend bawaan (hanya chat teks)';
    return out;
  });

  // Percakapan & workspace
  handle(CH.convList, null, () => s.store.listConversations());
  handle(CH.convGet, schemas.idOnly, ({ id }) => s.store.getConversation(id) ?? null);
  handle(CH.convSave, schemas.convSave, (c) => { s.store.saveConversation(c); s.store.setSession({ activeConversationId: c.id }); s.history.schedulePush(c); });
  handle(CH.convDelete, schemas.idOnly, async ({ id }) => { s.store.deleteConversation(id); await s.history.remove(id); });
  handle(CH.convSearch, schemas.search, ({ query }) => s.store.searchConversations(query));
  handle(CH.wsList, null, () => s.store.listWorkspaces());
  handle(CH.wsPick, null, async () => {
    const win = hooks.getWindow();
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'], title: 'Pilih folder workspace' });
    return r.canceled ? null : fs.realpathSync(r.filePaths[0]);
  });
  handle(CH.wsAdd, schemas.wsAdd, ({ name, path: p }) => {
    if (!path.isAbsolute(p) || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) throw new Error('Folder tidak valid');
    return s.store.addWorkspace(name, fs.realpathSync(p));
  });
  handle(CH.wsRemove, schemas.idOnly, ({ id }) => s.store.removeWorkspace(id));

  // Task
  handle(CH.taskStart, schemas.taskStart, (input) => s.manager.start(input));
  handle(CH.taskPause, schemas.idOnly, ({ id }) => s.manager.pause(id));
  handle(CH.taskResume, schemas.idOnly, ({ id }) => s.manager.resume(id));
  handle(CH.taskStop, schemas.idOnly, ({ id }) => s.manager.stop(id));
  handle(CH.taskStopAll, null, () => { s.manager.stopAll(); s.broker.rejectAll(); s.term.killAll(); });
  handle(CH.taskList, null, () => [...s.manager.list(), ...s.store.listTasks().filter((t) => !s.manager.list().some((m) => m.id === t.id))]);
  handle(CH.taskTimeline, schemas.taskTimeline, ({ id }) => s.manager.timeline(id));

  // Berkas, Git, terminal (aksi langsung pengguna; tetap melewati izin & batas folder)
  handle(CH.fsList, schemas.fsList, async ({ path: p }) => { await userAuth('fs.list', 'filesystem', `Daftar ${p}`, true); return s.fsAgent.list(p); });
  handle(CH.fsRead, schemas.fsRead, async ({ path: p }) => { await userAuth('fs.read', 'filesystem', `Baca ${p}`, true); return s.fsAgent.read(p); });
  handle(CH.fsWrite, schemas.fsWrite, async ({ path: p, content }) => { await userAuth('fs.write', 'filesystem', `Simpan ${p}`, false, 'medium'); await s.fsAgent.write(p, content); });
  handle(CH.gitStatus, schemas.gitStatus, async ({ workspaceId }) => { const w = wsOrThrow(workspaceId); await userAuth('git.status', 'filesystem', `Git status ${w.path}`, true); s.fsAgent.resolve(w.path); return gitStatus(w.path); });
  handle(CH.gitDiff, schemas.gitDiff, async ({ workspaceId, path: f }) => { const w = wsOrThrow(workspaceId); await userAuth('git.diff', 'filesystem', `Git diff ${w.path}`, true); s.fsAgent.resolve(w.path); return gitDiff(w.path, f); });
  handle(CH.gitCommit, schemas.gitCommit, async ({ workspaceId, message }) => { const w = wsOrThrow(workspaceId); await userAuth('git.commit', 'terminal', `Git commit: ${message}`, false, 'medium'); s.fsAgent.resolve(w.path, true); return gitCommitAll(w.path, message); });
  handle(CH.termStart, schemas.termStart, async ({ workspaceId }, e) => {
    const w = wsOrThrow(workspaceId);
    await userAuth('terminal.session', 'terminal', `Buka terminal di ${w.path}`, false, 'medium');
    const cwd = s.fsAgent.resolve(w.path);
    return s.term.startSession(cwd, (id, data) => e.sender.send(CH.termData, { id, data }));
  });
  handle(CH.termWrite, schemas.termWrite, ({ id, data }) => s.term.write(id, data));
  handle(CH.termKill, schemas.idOnly, ({ id }) => s.term.kill(id));

  // Browser bawaan
  handle(CH.browserState, null, () => s.browser.state());
  handle(CH.browserNavigate, schemas.browserNavigate, async ({ url }) => {
    const u = validateUrl(/^[a-z]+:/i.test(url) ? url : `https://${url}`);
    await userAuth('browser.navigate', 'browser', `Buka ${u}`, true);
    hooks.startBrowserStream();
    return s.browser.goto(u.toString());
  });
  handle(CH.browserClose, null, () => s.browser.close());

  // Audit & update
  handle(CH.auditList, null, () => s.audit.list(500));
  handle(CH.auditExport, null, async () => {
    const win = hooks.getWindow();
    const r = await dialog.showSaveDialog(win!, { title: 'Ekspor audit log', defaultPath: `intelligence7mit-audit-${new Date().toISOString().slice(0, 10)}.jsonl` });
    if (r.canceled || !r.filePath) return null;
    return { path: r.filePath, count: s.audit.exportTo(r.filePath) };
  });
  handle(CH.updateCheck, null, () => hooks.checkUpdate());
}

let crashed = false;
export function setCrashed(v: boolean) { crashed = v; }
