import type { LLMMessage, ContentPart } from './llm';

const BUDGET_CHARS = 380_000;
const KEEP_IMAGES = 2;

function size(m: LLMMessage): number {
  if (typeof m.content === 'string') return m.content.length + 50;
  if (!m.content) return 50;
  return m.content.reduce((n, p) => n + (p.type === 'text' ? p.text.length : 1500), 50) + JSON.stringify(m.tool_calls ?? '').length;
}

/** Kompaksi konteks: hapus gambar lama, pangkas output tool lama, buang grup lama bila perlu. Pasangan tool_call/tool dipertahankan. */
export function compactContext(messages: LLMMessage[], budget = BUDGET_CHARS): LLMMessage[] {
  const out = messages.map((m) => ({ ...m }));

  // 1. gambar: simpan hanya KEEP_IMAGES terbaru
  let seen = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    const c = out[i].content;
    if (!Array.isArray(c) || !c.some((p) => p.type === 'image_url')) continue;
    seen++;
    if (seen > KEEP_IMAGES) {
      out[i].content = c.map((p): ContentPart => (p.type === 'image_url' ? { type: 'text', text: '[screenshot lama dihapus untuk menghemat konteks]' } : p));
    }
  }

  // 2. pangkas output tool yang lama
  const recentFrom = Math.max(0, out.length - 10);
  for (let i = 0; i < recentFrom; i++) {
    if (out[i].role === 'tool' && typeof out[i].content === 'string' && (out[i].content as string).length > 1500) {
      out[i].content = (out[i].content as string).slice(0, 1500) + '\n… (dipangkas)';
    }
  }

  // 3. buang grup tertua jika masih melebihi anggaran
  let total = out.reduce((n, m) => n + size(m), 0);
  if (total <= budget) return out;
  const firstUser = out.findIndex((m) => m.role === 'user');
  const head = out.slice(0, firstUser + 1);
  const rest = out.slice(firstUser + 1);
  const groups: LLMMessage[][] = [];
  for (const m of rest) {
    if (m.role === 'assistant' || !groups.length) groups.push([m]);
    else groups[groups.length - 1].push(m);
  }
  let dropped = 0;
  while (total > budget && groups.length > 6) {
    const g = groups.shift()!;
    total -= g.reduce((n, m) => n + size(m), 0);
    dropped++;
  }
  const note: LLMMessage[] = dropped ? [{ role: 'user', content: `[Catatan sistem: ${dropped} langkah lama dihapus dari konteks untuk menghemat ruang. Lanjutkan berdasarkan langkah terbaru.]` }] : [];
  return [...head, ...note, ...groups.flat()];
}
