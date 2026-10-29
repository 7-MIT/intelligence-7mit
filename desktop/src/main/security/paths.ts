import fs from 'node:fs';
import path from 'node:path';

export type PathCheck = { ok: true; real: string } | { ok: false; reason: string };

const WIN = process.platform === 'win32';
const norm = (p: string) => (WIN ? p.toLowerCase() : p);

export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

const SENSITIVE_DIRS = new Set(['.ssh', '.gnupg', '.aws', '.kube', '.azure', '.config/gcloud', '.docker']);
const SENSITIVE_FILE =
  /^(id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|.*\.(pem|key|p12|pfx|ppk|kdbx|keystore|jks)|\.netrc|\.npmrc|\.pypirc|\.git-credentials|credentials(\.json)?|secrets?\.(json|ya?ml|toml)|\.env(\.(?!example$|sample$|template$).+)?)$/i;

/** Mengembalikan alasan jika path menunjuk ke rahasia/kredensial. */
export function sensitiveReason(p: string): string | null {
  const parts = p.split(/[\\/]+/).filter(Boolean);
  for (const part of parts) if (SENSITIVE_DIRS.has(part.toLowerCase())) return `Direktori kredensial (${part})`;
  const base = parts[parts.length - 1] ?? '';
  if (SENSITIVE_FILE.test(base)) return `Berkas kredensial/kunci privat (${base})`;
  return null;
}

function realpathNearest(p: string): string {
  let cur = path.resolve(p);
  const tail: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(cur), ...tail.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

export class PathGuard {
  constructor(private getAllowed: () => string[]) {}

  check(target: string, opts: { write?: boolean; allowSensitive?: boolean } = {}): PathCheck {
    if (!target || target.includes('\0')) return { ok: false, reason: 'Path tidak valid' };
    const allowed = this.getAllowed();
    if (!allowed.length) return { ok: false, reason: 'Belum ada folder yang diizinkan. Tambahkan folder di Permission Center.' };
    const real = realpathNearest(target);
    const roots = allowed.map((a) => realpathNearest(a));
    if (!roots.some((r) => isInside(r, real))) {
      return { ok: false, reason: `Di luar folder yang diizinkan: ${target}` };
    }
    if (!opts.allowSensitive) {
      const s = sensitiveReason(real);
      if (s) return { ok: false, reason: `Dilindungi: ${s}` };
    }
    if (opts.write) {
      const parts = real.split(/[\\/]+/);
      if (parts.includes('.git')) return { ok: false, reason: 'Penulisan ke dalam .git diblokir' };
    }
    return { ok: true, real };
  }
}
