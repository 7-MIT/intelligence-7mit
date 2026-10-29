import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const SECRET_ENV = /(key|token|secret|passw|credential|auth|cookie|session|private)/i;
const KEEP_ENV = /^(path|pathext|home|userprofile|lang|lc_.*|term|shell|comspec|systemroot|windir|temp|tmp|tmpdir|user|username|logname|appdata|localappdata|programdata|programfiles.*|processor_.*|number_of_processors|os|computername|node_env|editor|pwd|ssh_auth_sock_disabled)$/i;

/** Environment untuk proses anak: tanpa variabel yang tampak seperti rahasia. */
export function sanitizedEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (SECRET_ENV.test(k) && !KEEP_ENV.test(k)) continue;
    out[k] = v;
  }
  out.CI = out.CI ?? '1';
  out.FORCE_COLOR = '0';
  return out;
}

export function killTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => undefined);
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* sudah selesai */ } }
  }
}

export interface RunResult {
  exitCode: number | null;
  output: string;
  timedOut: boolean;
  aborted: boolean;
  truncated: boolean;
}

const MAX_OUT = 60_000;

export class TerminalExecutor {
  private sessions = new Map<string, ChildProcess>();

  /** Eksekusi satu perintah (dipakai agen). Wajib dipanggil hanya setelah PermissionManager mengizinkan. */
  run(command: string, cwd: string, opts: { timeoutMs?: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
    const timeoutMs = Math.min(opts.timeoutMs ?? 120_000, 600_000);
    return new Promise((resolve) => {
      const child = spawn(command, { cwd, shell: true, env: opts.env ?? sanitizedEnv(), detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let truncated = false;
      let timedOut = false;
      let aborted = false;
      const onData = (b: Buffer) => {
        if (out.length < MAX_OUT) out += b.toString('utf8');
        else truncated = true;
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
      const onAbort = () => { aborted = true; killTree(child); };
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      if (opts.signal?.aborted) onAbort();
      const finish = (code: number | null) => {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', onAbort);
        resolve({ exitCode: code, output: out.slice(0, MAX_OUT), timedOut, aborted, truncated });
      };
      child.on('error', (e) => { out += `\n[spawn error] ${e.message}`; finish(null); });
      child.on('close', (code) => finish(code));
    });
  }

  /** Shell interaktif untuk panel terminal bawaan (dikendalikan pengguna). Tanpa PTY: program yang butuh TTY penuh tidak didukung. */
  startSession(cwd: string, onData: (id: string, data: string) => void): string {
    const id = randomUUID();
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : process.env.SHELL || '/bin/sh';
    const args = isWin ? ['-NoLogo', '-NoProfile', '-NoExit', '-Command', '-'] : ['-i'];
    const child = spawn(shell, args, { cwd, env: { ...sanitizedEnv(), TERM: 'dumb' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: !isWin });
    this.sessions.set(id, child);
    child.stdout?.on('data', (b) => onData(id, b.toString('utf8')));
    child.stderr?.on('data', (b) => onData(id, b.toString('utf8')));
    child.on('close', (code) => { onData(id, `\n[proses selesai, kode ${code}]\n`); this.sessions.delete(id); });
    child.on('error', (e) => onData(id, `\n[error] ${e.message}\n`));
    return id;
  }

  write(id: string, data: string): boolean {
    const c = this.sessions.get(id);
    if (!c?.stdin?.writable) return false;
    c.stdin.write(data);
    return true;
  }

  kill(id: string): void {
    const c = this.sessions.get(id);
    if (c) { killTree(c); this.sessions.delete(id); }
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }
}
