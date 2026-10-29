import { execFile } from 'node:child_process';

export function run(cmd: string, args: string[], env: Record<string, string> = {}, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: true, env: { ...process.env, ...env }, maxBuffer: 2_000_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).toString().trim().slice(0, 500)));
      else resolve(stdout.toString());
    });
  });
}

/** Argumen dikirim lewat environment variable, bukan disisipkan ke teks skrip -> tidak ada injeksi. */
const PS = (script: string, env: Record<string, string>) =>
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], env);

export type WindowOp = 'maximize' | 'close';

export async function windowOp(op: WindowOp, title: string, platform = process.platform): Promise<string> {
  if (platform === 'win32') {
    const script =
      op === 'close'
        ? `$t=$env:IT7_TITLE; $p=Get-Process | Where-Object { $_.MainWindowTitle -eq $t } | Select-Object -First 1; if(-not $p){throw 'Jendela tidak ditemukan'}; if($p.CloseMainWindow()){'Permintaan tutup dikirim (aplikasi dapat menanyakan penyimpanan)'}else{throw 'Jendela tidak merespons permintaan tutup'}`
        : `Add-Type -Name W -Namespace IT7 -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);'; $t=$env:IT7_TITLE; $p=Get-Process | Where-Object { $_.MainWindowTitle -eq $t } | Select-Object -First 1; if(-not $p){throw 'Jendela tidak ditemukan'}; [IT7.W]::ShowWindow($p.MainWindowHandle,3) | Out-Null; 'ok'`;
    return PS(script, { IT7_TITLE: title });
  }
  if (platform === 'darwin') {
    const script =
      op === 'close'
        ? 'on run argv\ntell application "System Events" to tell (first process whose frontmost is true)\nclick (first button of window 1 whose subrole is "AXCloseButton")\nend tell\nreturn "ok"\nend run'
        : 'on run argv\ntell application "System Events" to tell (first process whose frontmost is true)\nset value of attribute "AXFullScreen" of window 1 to false\ntell window 1 to perform action "AXZoomWindow"\nend tell\nreturn "ok"\nend run';
    return run('osascript', ['-e', script, '--', title]);
  }
  // Linux: butuh wmctrl
  return run('wmctrl', op === 'close' ? ['-c', title] : ['-r', title, '-b', 'add,maximized_vert,maximized_horz']);
}

const SAFE_APP = /^[\p{L}\p{N} .+\-()&'_]{1,100}$/u;
export function validateAppName(name: string): string {
  const n = name.trim();
  if (!SAFE_APP.test(n) || /^\.|[\\/]/.test(n)) throw new Error('Nama aplikasi tidak valid. Gunakan nama aplikasi, bukan path.');
  return n;
}

export async function openApp(name: string, platform = process.platform): Promise<string> {
  const n = validateAppName(name);
  if (platform === 'darwin') {
    await run('open', ['-a', n]);
    return `Membuka ${n}`;
  }
  if (platform === 'win32') {
    const script = `$n=$env:IT7_APP; $c=Get-Command $n -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){Start-Process -FilePath $c.Source; 'ok'; return}; $dirs=@("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs","$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"); $l=Get-ChildItem -Path $dirs -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -like "*$n*" } | Sort-Object { $_.BaseName.Length } | Select-Object -First 1; if(-not $l){throw "Aplikasi '$n' tidak ditemukan"}; Start-Process -FilePath $l.FullName; 'ok'`;
    await PS(script, { IT7_APP: n });
    return `Membuka ${n}`;
  }
  await run('gtk-launch', [n]).catch(() => run('xdg-open', [n]));
  return `Membuka ${n}`;
}

export async function listApps(platform = process.platform): Promise<string[]> {
  if (platform === 'darwin') {
    const out = await run('sh', ['-c', 'ls /Applications /System/Applications 2>/dev/null']);
    return [...new Set(out.split('\n').filter((l) => l.endsWith('.app')).map((l) => l.replace(/\.app$/, '')))].sort();
  }
  if (platform === 'win32') {
    const out = await PS(`$dirs=@("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs","$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"); Get-ChildItem -Path $dirs -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object { $_.BaseName } | Sort-Object -Unique`, {});
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  const out = await run('sh', ['-c', "grep -h '^Name=' /usr/share/applications/*.desktop 2>/dev/null | cut -d= -f2 | sort -u"]);
  return out.split('\n').filter(Boolean);
}
