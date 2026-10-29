import { randomUUID } from 'node:crypto';
import type { ChatMessage, Conversation } from '@shared/types';
import { SUPABASE_KEY, endpoints, type AuthService } from './auth';
import type { Store } from './store';

const table = () => endpoints.base + '/rest/v1/intellegence_chat_history';

interface Row { id: string; title: string; messages: unknown; created_at: string; updated_at: string }

/** Format pesan web: { role, content, ... } — diterima apa adanya; field tak dikenal diabaikan. */
export function rowToConversation(r: Row): Conversation {
  const base = new Date(r.created_at).getTime() || Date.now();
  const msgs = (Array.isArray(r.messages) ? r.messages : []) as Record<string, unknown>[];
  const messages: ChatMessage[] = msgs
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m, i) => ({ id: typeof m.id === 'string' && m.id ? m.id : randomUUID(), role: m.role as 'user' | 'assistant', content: m.content as string, createdAt: typeof m.createdAt === 'number' ? m.createdAt : base + i }));
  return { id: r.id, title: r.title || 'Percakapan', mode: 'chat', messages, createdAt: base, updatedAt: new Date(r.updated_at).getTime() || base };
}

export function conversationToRow(c: Conversation, userId: string) {
  return {
    id: c.id, user_id: userId, title: c.title,
    messages: c.messages.map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt })),
    created_at: new Date(c.createdAt).toISOString(), updated_at: new Date(c.updatedAt).toISOString()
  };
}

/** Sinkron riwayat Chat dengan akun web (tabel yang sama). Percakapan Code tetap lokal. Kegagalan tidak fatal. */
export class HistorySync {
  private timers = new Map<string, NodeJS.Timeout>();
  lastError: string | null = null;
  constructor(private auth: AuthService, private store: Store, private fetchImpl: typeof fetch = fetch, private debounceMs = 600) {}

  private async req(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.auth.accessToken();
    if (!token) throw new Error('Belum masuk');
    return this.fetchImpl(table() + path, { ...init, headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  }

  /** Tarik riwayat dari akun, gabungkan (yang lebih baru menang), lalu dorong yang lokal-lebih-baru. */
  async sync(): Promise<{ pulled: number; pushed: number }> {
    const userId = this.auth.userId();
    if (!userId) return { pulled: 0, pushed: 0 };
    try {
      const res = await this.req('?select=id,title,messages,created_at,updated_at&order=updated_at.desc');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as Row[];
      const remote = new Map(rows.map((r) => [r.id, rowToConversation(r)]));
      let pulled = 0;
      for (const rc of remote.values()) {
        const local = this.store.getConversation(rc.id);
        if (local && local.mode !== 'chat') continue;
        if (!local || rc.updatedAt > local.updatedAt) { this.store.saveConversation(rc); pulled++; }
      }
      const toPush = this.store.listConversations().filter((m) => m.mode === 'chat' && (!remote.has(m.id) || m.updatedAt > remote.get(m.id)!.updatedAt));
      const full = toPush.map((m) => this.store.getConversation(m.id)).filter((c): c is Conversation => !!c && c.messages.length > 0);
      if (full.length) await this.push(full);
      this.lastError = null;
      return { pulled, pushed: full.length };
    } catch (e) {
      this.lastError = (e as Error).message;
      throw new Error(`Sinkronisasi riwayat gagal: ${this.lastError}`);
    }
  }

  private async push(convs: Conversation[]) {
    const userId = this.auth.userId();
    if (!userId) return;
    const res = await this.req('?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(convs.map((c) => conversationToRow(c, userId))) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  schedulePush(c: Conversation) {
    if (c.mode !== 'chat' || !this.auth.userId() || !c.messages.length) return;
    clearTimeout(this.timers.get(c.id));
    this.timers.set(c.id, setTimeout(() => {
      this.timers.delete(c.id);
      const fresh = this.store.getConversation(c.id);
      if (fresh) void this.push([fresh]).then(() => { this.lastError = null; }, (e) => { this.lastError = (e as Error).message; });
    }, this.debounceMs));
  }

  async remove(id: string) {
    if (!this.auth.userId()) return;
    await this.req('?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }).catch((e) => { this.lastError = (e as Error).message; });
  }

  flush() { for (const t of this.timers.values()) clearTimeout(t); this.timers.clear(); }
}
