import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PathGuard, sensitiveReason } from '../src/main/security/paths';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'it7p-')));
const root = path.join(tmp, 'ws');
fs.mkdirSync(root);
fs.writeFileSync(path.join(root, 'a.txt'), 'x');
const outside = path.join(tmp, 'outside');
fs.mkdirSync(outside);
fs.writeFileSync(path.join(outside, 'secret.txt'), 's');

describe('PathGuard', () => {
  const g = new PathGuard(() => [root]);
  it('mengizinkan path dalam folder, termasuk berkas baru', () => {
    expect(g.check(path.join(root, 'a.txt')).ok).toBe(true);
    expect(g.check(path.join(root, 'new/dir/file.ts'), { write: true }).ok).toBe(true);
  });
  it('menolak di luar folder & traversal', () => {
    expect(g.check(path.join(outside, 'secret.txt')).ok).toBe(false);
    expect(g.check(path.join(root, '..', 'outside', 'secret.txt')).ok).toBe(false);
    expect(g.check('/etc/passwd').ok).toBe(false);
  });
  it('menolak symlink yang keluar dari folder', () => {
    const link = path.join(root, 'link');
    try { fs.symlinkSync(outside, link); } catch { return; }
    expect(g.check(path.join(link, 'secret.txt')).ok).toBe(false);
  });
  it('menolak prefix serupa (ws-evil)', () => {
    const evil = path.join(tmp, 'ws-evil');
    fs.mkdirSync(evil, { recursive: true });
    expect(g.check(path.join(evil, 'x')).ok).toBe(false);
  });
  it('tanpa folder diizinkan, semua ditolak', () => expect(new PathGuard(() => []).check(root).ok).toBe(false));
  it('melindungi kredensial dan kunci privat', () => {
    for (const f of ['.env', '.env.local', 'id_rsa', 'server.pem', '.npmrc', '.ssh/config', 'credentials.json']) {
      expect(g.check(path.join(root, f)).ok, f).toBe(false);
    }
    expect(g.check(path.join(root, '.env.example')).ok).toBe(true);
    expect(sensitiveReason('/home/u/.aws/config')).toBeTruthy();
  });
  it('menolak menulis ke .git', () => expect(g.check(path.join(root, '.git', 'hooks', 'pre-commit'), { write: true }).ok).toBe(false));
  it('menolak path dengan null byte', () => expect(g.check(root + '\0/x').ok).toBe(false));
});
