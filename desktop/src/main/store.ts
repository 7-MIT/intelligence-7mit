import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PERMISSIONS, DEFAULT_SETTINGS, type Conversation, type PermissionState, type ProviderConfig, type Settings, type TaskSummary, type Workspace } from '@shared/types';

export interface SecretCrypto {
  available(): boolean;
  encrypt(plain: string): string;
  decrypt(enc: string): string;
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}
function writeJson(file: string, data: unknown, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode });
  fs.renameSync(tmp, file);
}

export const BUILTIN_PROVIDER: ProviderConfig = {
  id: 'seven-mit', name: 'intelligence.7mit (backend bawaan)', kind: 'intelligence7mit',
  baseUrl: 'https://lajzrempjyoqkubkumhb.supabase.co/functions/v1/intellegence-7mit-public', model: 'intelligence.7mit',
  supportsTools: false, supportsVision: false, hasKey: true
};

export class Store {
  private sessionKeys = new Map<string, string>(); // fallback bila enkripsi OS tidak tersedia: hanya di memori
  constructor(private dir: string, private crypto: SecretCrypto) {
    fs.mkdirSync(path.join(dir, 'conversations'), { recursive: true });
  }

  private f = (n: string) => path.join(this.dir, n);

  // Pengaturan
  getSettings(): Settings { return { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(this.f('settings.json'), {}) }; }
  setSettings(patch: Partial<Settings>): Settings { const n = { ...this.getSettings(), ...patch }; writeJson(this.f('settings.json'), n); return n; }

  // Izin
  loadPermissions(): PermissionState | undefined { return readJson<PermissionState | undefined>(this.f('permissions.json'), undefined); }
  savePermissions(s: PermissionState) { writeJson(this.f('permissions.json'), s); }
  defaultPermissions() { return DEFAULT_PERMISSIONS; }

  // Penyedia AI + rahasia
  listProviders(): ProviderConfig[] {
    const custom = readJson<Omit<ProviderConfig, 'hasKey'>[]>(this.f('providers.json'), []);
    return [BUILTIN_PROVIDER, ...custom.map((p) => ({ ...p, hasKey: !!this.getKey(p.id) }))];
  }
  getProvider(id: string): ProviderConfig | undefined { return this.listProviders().find((p) => p.id === id); }
  saveProvider(p: Omit<ProviderConfig, 'hasKey' | 'id'> & { id?: string }): ProviderConfig {
    if (p.id === BUILTIN_PROVIDER.id) throw new Error('Penyedia bawaan tidak dapat diubah');
    const list = readJson<Omit<ProviderConfig, 'hasKey'>[]>(this.f('providers.json'), []);
    const id = p.id ?? randomUUID();
    const rec = { ...p, id } as Omit<ProviderConfig, 'hasKey'>;
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    writeJson(this.f('providers.json'), list);
    return { ...rec, hasKey: !!this.getKey(id) };
  }
  deleteProvider(id: string) {
    writeJson(this.f('providers.json'), readJson<{ id: string }[]>(this.f('providers.json'), []).filter((p) => p.id !== id));
    this.setKey(id, '');
  }
  private secrets(): Record<string, string> { return readJson<Record<string, string>>(this.f('secrets.json'), {}); }
  setKey(id: string, key: string): { persisted: boolean } {
    const all = this.secrets();
    delete all[id];
    this.sessionKeys.delete(id);
    let persisted = true;
    if (key) {
      if (this.crypto.available()) all[id] = this.crypto.encrypt(key);
      else { this.sessionKeys.set(id, key); persisted = false; }
    }
    writeJson(this.f('secrets.json'), all);
    return { persisted };
  }
  /** Hanya untuk main process. Tidak pernah diteruskan ke renderer. */
  getKey(id: string): string | undefined {
    const s = this.sessionKeys.get(id);
    if (s) return s;
    const enc = this.secrets()[id];
    if (!enc) return undefined;
    try { return this.crypto.decrypt(enc); } catch { return undefined; }
  }

  // Workspace
  listWorkspaces(): Workspace[] { return readJson<Workspace[]>(this.f('workspaces.json'), []); }
  addWorkspace(name: string, p: string): Workspace {
    const list = this.listWorkspaces();
    const existing = list.find((w) => w.path === p);
    if (existing) return existing;
    const w = { id: randomUUID(), name, path: p };
    writeJson(this.f('workspaces.json'), [...list, w]);
    return w;
  }
  removeWorkspace(id: string) { writeJson(this.f('workspaces.json'), this.listWorkspaces().filter((w) => w.id !== id)); }
  getWorkspace(id: string) { return this.listWorkspaces().find((w) => w.id === id); }

  // Memori workspace
  memoryRead(wsId: string): string { try { return fs.readFileSync(path.join(this.dir, 'memory', `${wsId}.md`), 'utf8'); } catch { return ''; } }
  memoryWrite(wsId: string, text: string, replace: boolean) {
    const file = path.join(this.dir, 'memory', `${wsId}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const next = replace ? text : (this.memoryRead(wsId) + `\n- ${text}`).trim();
    fs.writeFileSync(file, next.slice(-8000), { mode: 0o600 });
  }

  // Percakapan
  private cf = (id: string) => path.join(this.dir, 'conversations', `${id.replace(/[^\w-]/g, '_')}.json`);
  listConversations(): Omit<Conversation, 'messages'>[] {
    const out: Omit<Conversation, 'messages'>[] = [];
    for (const f of fs.readdirSync(path.join(this.dir, 'conversations'))) {
      const c = readJson<Conversation | undefined>(path.join(this.dir, 'conversations', f), undefined);
      if (c) { const { messages: _m, ...meta } = c; out.push(meta); }
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  getConversation(id: string): Conversation | undefined { return readJson<Conversation | undefined>(this.cf(id), undefined); }
  saveConversation(c: Conversation) { writeJson(this.cf(c.id), c); }
  deleteConversation(id: string) { try { fs.rmSync(this.cf(id)); } catch { /* sudah hilang */ } }
  searchConversations(q: string): { id: string; title: string; snippet: string }[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const res: { id: string; title: string; snippet: string }[] = [];
    for (const meta of this.listConversations()) {
      const c = this.getConversation(meta.id);
      if (!c) continue;
      if (c.title.toLowerCase().includes(needle)) { res.push({ id: c.id, title: c.title, snippet: c.title }); continue; }
      for (const m of c.messages) {
        const i = m.content.toLowerCase().indexOf(needle);
        if (i >= 0) { res.push({ id: c.id, title: c.title, snippet: m.content.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ') }); break; }
      }
    }
    return res.slice(0, 50);
  }

  // Riwayat task
  listTasks(): TaskSummary[] { return readJson<TaskSummary[]>(this.f('tasks.json'), []); }
  saveTask(t: TaskSummary) {
    const list = this.listTasks().filter((x) => x.id !== t.id);
    list.unshift(t);
    writeJson(this.f('tasks.json'), list.slice(0, 300));
  }

  // Pemulihan crash / sesi
  markStarted(): { crashed: boolean } {
    const prev = readJson<{ clean?: boolean }>(this.f('session.json'), { clean: true });
    const crashed = prev.clean === false;
    writeJson(this.f('session.json'), { ...readJson(this.f('session.json'), {}), clean: false });
    return { crashed };
  }
  markClean() { writeJson(this.f('session.json'), { ...readJson(this.f('session.json'), {}), clean: true }); }
  getSession(): { lastPage?: string; activeConversationId?: string; workspaceId?: string; mode?: string } { return readJson(this.f('session.json'), {}); }
  setSession(p: Record<string, unknown>) { writeJson(this.f('session.json'), { ...readJson(this.f('session.json'), {}), ...p }); }
}
