import type { ProviderCapabilities, ProviderConfig } from '@shared/types';
import { redact } from '../security/audit';
import type { ToolSpec } from '../tools/types';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface LLMToolCall { id: string; name: string; arguments: string }
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}
export interface LLMRequest {
  messages: LLMMessage[];
  tools?: ToolSpec[];
  signal?: AbortSignal;
  onTextDelta?: (d: string) => void;
}
export interface LLMResponse { content: string; toolCalls: LLMToolCall[]; finishReason: string }

export interface LLMProvider {
  config: ProviderConfig;
  capabilities(): ProviderCapabilities;
  chat(req: LLMRequest): Promise<LLMResponse>;
}

export class LLMError extends Error {
  constructor(message: string, public status?: number, public retryable = false) { super(message); }
}

export function capabilitiesOf(c: ProviderConfig): ProviderCapabilities {
  if (c.kind === 'intelligence7mit') {
    return { chat: true, tools: false, vision: false, reason: 'Backend intelligence.7mit bawaan hanya mendukung chat teks. Mode Code/Web/Control butuh endpoint kompatibel OpenAI dengan tool calling.' };
  }
  return { chat: true, tools: c.supportsTools, vision: c.supportsVision, reason: !c.supportsTools ? 'Penyedia ini ditandai tidak mendukung tool calling.' : undefined };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenAICompatProvider implements LLMProvider {
  constructor(public config: ProviderConfig, private getKey: () => string | undefined, private fetchImpl: typeof fetch = fetch) {}
  capabilities() { return capabilitiesOf(this.config); }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const key = this.getKey();
    if (!key) throw new LLMError('API key belum diatur untuk penyedia ini. Buka Pengaturan → Penyedia AI.');
    const body: Record<string, unknown> = { model: this.config.model, messages: req.messages, stream: true };
    if (req.tools?.length) { body.tools = req.tools; body.tool_choice = 'auto'; }
    const url = this.config.baseUrl.replace(/\/+$/, '') + '/chat/completions';

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (req.signal?.aborted) throw new LLMError('Dibatalkan');
      try {
        return await this.once(url, key, body, req);
      } catch (e) {
        lastErr = e;
        if (!(e instanceof LLMError) || !e.retryable || attempt === 2) break;
        await sleep(1000 * 2 ** attempt);
      }
    }
    throw lastErr;
  }

  private async once(url: string, key: string, body: Record<string, unknown>, req: LLMRequest): Promise<LLMResponse> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: req.signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new LLMError('Dibatalkan');
      throw new LLMError(`Tidak dapat terhubung ke penyedia AI: ${(e as Error).message}`, undefined, true);
    }
    if (!res.ok) {
      const text = redact((await res.text().catch(() => '')).slice(0, 500));
      throw new LLMError(`Penyedia AI mengembalikan HTTP ${res.status}: ${text}`, res.status, res.status === 429 || res.status >= 500);
    }
    if (!res.body) throw new LLMError('Respons penyedia AI kosong');

    let content = '';
    let finish = '';
    const calls = new Map<number, LLMToolCall>();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const handle = (payload: string) => {
      if (payload === '[DONE]') return;
      let j: { choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[]; error?: { message?: string } };
      try { j = JSON.parse(payload); } catch { return; }
      if (j.error) throw new LLMError(`Kesalahan penyedia AI: ${redact(j.error.message ?? 'tidak diketahui')}`);
      const ch = j.choices?.[0];
      if (!ch) return;
      if (ch.delta?.content) { content += ch.delta.content; req.onTextDelta?.(ch.delta.content); }
      for (const tc of ch.delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0;
        const cur = calls.get(idx) ?? { id: '', name: '', arguments: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.arguments += tc.function.arguments;
        calls.set(idx, cur);
      }
      if (ch.finish_reason) finish = ch.finish_reason;
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line.startsWith('data:')) handle(line.slice(5).trim());
        }
      }
      if (buf.trim().startsWith('data:')) handle(buf.trim().slice(5).trim());
    } catch (e) {
      if (req.signal?.aborted) throw new LLMError('Dibatalkan');
      if (e instanceof LLMError) throw e;
      throw new LLMError(`Aliran respons terputus: ${(e as Error).message}`, undefined, true);
    }
    const toolCalls = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => ({ ...c, id: c.id || `call_${i}_${Date.now()}` }));
    return { content, toolCalls, finishReason: finish || (toolCalls.length ? 'tool_calls' : 'stop') };
  }
}

/** Adapter backend intelligence.7mit yang sudah ada (Supabase Edge Function). Hanya teks; tanpa tool calling/vision. */
export class SevenMitProvider implements LLMProvider {
  constructor(public config: ProviderConfig, private anonKey: string, private fetchImpl: typeof fetch = fetch) {}
  capabilities() { return capabilitiesOf(this.config); }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const msgs = req.messages.filter((m) => m.role !== 'system' && m.role !== 'tool');
    const text = (m: LLMMessage) => (typeof m.content === 'string' ? m.content : (m.content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join(''));
    const last = [...msgs].reverse().find((m) => m.role === 'user');
    if (!last) throw new LLMError('Tidak ada pesan pengguna');
    const history = msgs.slice(0, -1).slice(-20).map((m) => ({ role: m.role, content: text(m) }));
    let res: Response;
    try {
      res = await this.fetchImpl(this.config.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.anonKey}` },
        body: JSON.stringify({ message: text(last), prompt: text(last), history, messages: history, attachments: [], mode: 'chat', account_context: { mode: 'guest' } }),
        signal: req.signal
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new LLMError('Dibatalkan');
      throw new LLMError(`Tidak dapat terhubung ke backend intelligence.7mit: ${(e as Error).message}`);
    }
    const raw = await res.text();
    let data: unknown = raw;
    try { data = JSON.parse(raw); } catch { /* teks biasa */ }
    const answer = extractAnswer(data);
    if (!res.ok) throw new LLMError(`Backend intelligence.7mit HTTP ${res.status}: ${redact(answer ?? raw).slice(0, 300)}`, res.status, res.status >= 500);
    if (!answer) throw new LLMError('Backend intelligence.7mit mengembalikan respons yang tidak terbaca');
    req.onTextDelta?.(answer);
    return { content: answer, toolCalls: [], finishReason: 'stop' };
  }
}

export function extractAnswer(data: unknown): string | undefined {
  if (typeof data === 'string') return data;
  const d = data as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const direct = d?.response ?? d?.answer ?? d?.text ?? d?.output ?? d?.message ?? d?.content ?? d?.result ?? d?.error;
  if (typeof direct === 'string') return direct;
  if (typeof direct?.content === 'string') return direct.content;
  const cand = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
  return cand || undefined;
}

export async function listModels(baseUrl: string, key: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(baseUrl.replace(/\/+$/, '') + '/models', { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new LLMError(`HTTP ${res.status} saat mengambil daftar model`);
  const j = (await res.json()) as { data?: { id: string }[] };
  return (j.data ?? []).map((m) => m.id).sort();
}
