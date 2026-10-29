import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '@shared/types';
import type { PathGuard } from '../security/paths';

const MAX_READ = 400_000;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next', '.cache', '__pycache__', '.venv', 'target']);
const EXEC_EXT = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|js|jse|wsf|sh|command|app|dmg|pkg|jar|lnk|appimage)$/i;

export class FileSystemAgent {
  constructor(private guard: PathGuard, private trash: (p: string) => Promise<void>) {}

  private ok(p: string, opts: { write?: boolean } = {}): string {
    const r = this.guard.check(p, opts);
    if (!r.ok) throw new Error(r.reason);
    return r.real;
  }

  resolve(p: string, write = false): string {
    return this.ok(p, { write });
  }

  async list(p: string): Promise<FileEntry[]> {
    const dir = this.ok(p);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out = await Promise.all(
      entries.map(async (e) => {
        const full = path.join(dir, e.name);
        let size = 0;
        try { if (e.isFile()) size = (await fs.stat(full)).size; } catch { /* ignore */ }
        return { name: e.name, path: full, isDir: e.isDirectory(), size } satisfies FileEntry;
      })
    );
    return out.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  }

  async read(p: string): Promise<{ content: string; truncated: boolean; size: number }> {
    const file = this.ok(p);
    const st = await fs.stat(file);
    if (!st.isFile()) throw new Error('Bukan berkas');
    const fh = await fs.open(file, 'r');
    try {
      const len = Math.min(st.size, MAX_READ);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, 0);
      if (buf.subarray(0, Math.min(len, 4096)).includes(0)) throw new Error('Berkas biner tidak dapat dibaca sebagai teks');
      return { content: buf.toString('utf8'), truncated: st.size > MAX_READ, size: st.size };
    } finally {
      await fh.close();
    }
  }

  async readIfExists(p: string): Promise<string | null> {
    const file = this.ok(p);
    try { return (await this.read(file)).content; } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async write(p: string, content: string): Promise<void> {
    const file = this.ok(p, { write: true });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf8');
  }

  async mkdir(p: string): Promise<void> {
    await fs.mkdir(this.ok(p, { write: true }), { recursive: true });
  }

  async copy(from: string, to: string): Promise<void> {
    const src = this.ok(from);
    const dst = this.ok(to, { write: true });
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.cp(src, dst, { recursive: true, errorOnExist: true, force: false });
  }

  async move(from: string, to: string): Promise<void> {
    const src = this.ok(from, { write: true });
    const dst = this.ok(to, { write: true });
    try { await fs.access(dst); throw new Error('Tujuan sudah ada'); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    await fs.mkdir(path.dirname(dst), { recursive: true });
    try { await fs.rename(src, dst); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
      await fs.cp(src, dst, { recursive: true });
      await fs.rm(src, { recursive: true });
    }
  }

  /** Hapus = pindahkan ke Trash/Recycle Bin sehingga dapat dipulihkan. */
  async remove(p: string): Promise<void> {
    const target = this.ok(p, { write: true });
    await this.trash(target);
  }

  async stat(p: string) {
    return fs.stat(this.ok(p));
  }

  /** Aman dibuka dengan aplikasi default (bukan executable/skrip). */
  checkOpenable(p: string): string {
    const real = this.ok(p);
    if (EXEC_EXT.test(real)) throw new Error('Berkas executable/skrip tidak dibuka otomatis. Jalankan lewat terminal dengan persetujuan.');
    return real;
  }

  async search(root: string, opts: { name?: string; text?: string; max?: number }, signal?: AbortSignal): Promise<string[]> {
    const base = this.ok(root);
    const max = Math.min(opts.max ?? 100, 500);
    const nameRe = opts.name ? globToRegExp(opts.name) : null;
    const needle = opts.text?.toLowerCase();
    const results: string[] = [];
    const walk = async (dir: string, depth: number) => {
      if (results.length >= max || depth > 12 || signal?.aborted) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (results.length >= max || signal?.aborted) return;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (SKIP_DIRS.has(e.name)) continue;
          if (this.guard.check(full).ok) await walk(full, depth + 1);
        } else if (e.isFile()) {
          if (nameRe && !nameRe.test(e.name)) continue;
          if (!this.guard.check(full).ok) continue;
          if (needle) {
            try {
              const st = await fs.stat(full);
              if (st.size > 1_000_000) continue;
              const text = (await fs.readFile(full, 'utf8')).toLowerCase();
              const idx = text.indexOf(needle);
              if (idx < 0) continue;
              const line = text.slice(0, idx).split('\n').length;
              results.push(`${full}:${line}`);
            } catch { /* biner/tak terbaca */ }
          } else results.push(full);
        }
      }
    };
    await walk(base, 0);
    return results;
  }
}

export function globToRegExp(glob: string): RegExp {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}
