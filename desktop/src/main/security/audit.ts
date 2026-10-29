import fs from 'node:fs';
import path from 'node:path';
import type { AuditEntry } from '@shared/types';

const REDACTIONS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[PRIVATE KEY REDACTED]'],
  [/\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}\b/g, '[KEY REDACTED]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[TOKEN REDACTED]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[AWS KEY REDACTED]'],
  [/(bearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[REDACTED]'],
  [/((?:api[_-]?key|secret|token|password|passwd|authorization)["'\s:=]+)[^\s"',;]{6,}/gi, '$1[REDACTED]']
];

export function redact(text: string): string {
  return REDACTIONS.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

export class AuditLogger {
  private listeners = new Set<(e: AuditEntry) => void>();
  constructor(private file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  log(entry: Omit<AuditEntry, 'at'> & { at?: number }): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      at: entry.at ?? Date.now(),
      summary: redact(entry.summary).slice(0, 2000),
      detail: entry.detail ? redact(entry.detail).slice(0, 4000) : undefined
    };
    try {
      fs.appendFileSync(this.file, JSON.stringify(full) + '\n', { mode: 0o600 });
    } catch (err) {
      console.error('[audit] gagal menulis log', err);
    }
    this.listeners.forEach((l) => l(full));
    return full;
  }

  onEntry(fn: (e: AuditEntry) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  list(limit = 500): AuditEntry[] {
    try {
      const lines = fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
      return lines.slice(-limit).flatMap((l) => {
        try {
          return [JSON.parse(l) as AuditEntry];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  }

  exportTo(dest: string): number {
    const entries = this.list(100_000);
    fs.writeFileSync(dest, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', { mode: 0o600 });
    return entries.length;
  }
}
