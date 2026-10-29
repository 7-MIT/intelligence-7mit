import { execFile } from 'node:child_process';
import type { GitStatus } from '@shared/types';

function git(cwd: string, args: string[], timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', cwd, ...args], { timeout, maxBuffer: 4_000_000, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).toString().trim().slice(0, 600)));
      else resolve(stdout.toString());
    });
  });
}

export async function gitStatus(cwd: string): Promise<GitStatus> {
  try {
    await git(cwd, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return { isRepo: false, files: [] };
  }
  const [branch, status] = await Promise.all([git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => 'HEAD'), git(cwd, ['status', '--porcelain'])]);
  return {
    isRepo: true,
    branch: branch.trim(),
    files: status.split('\n').filter(Boolean).map((l) => ({ status: l.slice(0, 2).trim() || '?', path: l.slice(3) }))
  };
}

export async function gitDiff(cwd: string, file?: string): Promise<string> {
  const args = ['diff', '--no-color', '--no-ext-diff', 'HEAD'];
  if (file) args.push('--', file);
  const out = await git(cwd, args).catch(() => git(cwd, ['diff', '--no-color', '--no-ext-diff', ...(file ? ['--', file] : [])]));
  return out.length > 200_000 ? out.slice(0, 200_000) + '\n… (dipotong)' : out;
}

export async function gitCommitAll(cwd: string, message: string): Promise<string> {
  await git(cwd, ['add', '-A']);
  return git(cwd, ['commit', '-m', message], 30000);
}
