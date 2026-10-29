import type { Risk } from '@shared/types';

export type ShellLevel = Risk | 'blocked';
export interface ShellVerdict {
  level: ShellLevel;
  reason: string;
}

const ORDER: ShellLevel[] = ['low', 'medium', 'high', 'critical', 'blocked'];
const max = (a: ShellLevel, b: ShellLevel): ShellLevel => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);

/** Perintah yang tidak pernah dijalankan, bahkan dengan persetujuan. */
const BLOCKED: [RegExp, string][] = [
  [/\brm\s+(-[a-z-]*\s+)*(\/|~|\$home|\/\*|\*|\.\.?)(\s|$)/i, 'Penghapusan massal pada root/home'],
  [/\brm\s+.*(-[a-z]*r[a-z]*|--recursive).*\s(\/|~|\$home|\/\*)(\s|$)/i, 'Penghapusan rekursif pada root/home'],
  [/\b(mkfs(\.\w+)?|fdisk|parted|diskpart|wipefs)\b/i, 'Operasi format/partisi disk'],
  [/\bdd\b[^|;&]*\bof=\/dev\//i, 'Penulisan langsung ke perangkat blok'],
  [/:\s*\(\s*\)\s*\{/, 'Pola fork bomb'],
  [/>\s*\/dev\/(sd|nvme|disk)/i, 'Penulisan langsung ke disk'],
  [/\bformat\s+[a-z]:/i, 'Format drive'],
  [/\b(del|erase)\b[^|;&]*\/[sq][^|;&]*\s[a-z]:\\?(\s|$)/i, 'Penghapusan massal drive Windows'],
  [/\b(rd|rmdir)\b[^|;&]*\/s[^|;&]*\s[a-z]:\\?(\s|$)/i, 'Penghapusan massal drive Windows'],
  [/remove-item\b[^|;&]*-recurse[^|;&]*\s[a-z]:\\?(\s|$)/i, 'Penghapusan massal drive Windows'],
  [/\b(shutdown|reboot|halt|poweroff|init\s+0|init\s+6)\b/i, 'Mematikan/memulai ulang komputer'],
  [/\bchmod\s+-R\s+[0-7]*7[0-7]*\s+\//i, 'chmod rekursif pada root'],
  [/\bchown\s+-R\b[^|;&]*\s\/(\s|$)/i, 'chown rekursif pada root'],
  [/\b(curl|wget|iwr|invoke-webrequest|irm|invoke-restmethod)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|dash|pwsh|powershell|iex|invoke-expression|python3?|node)\b/i, 'Mengunduh lalu langsung mengeksekusi skrip'],
  [/\|\s*(sh|bash|zsh|dash|iex|invoke-expression)\b/i, 'Pipe ke interpreter shell'],
  [/\b(iex|invoke-expression)\b/i, 'Invoke-Expression tidak diizinkan'],
  [/\b(sudo|doas|runas|su)\b(\s|$)/i, 'Eskalasi privilege tidak didukung'],
  [/(^|[\s/\\])\.ssh([\s/\\]|$)|\bid_(rsa|dsa|ecdsa|ed25519)\b/i, 'Akses ke kunci SSH'],
  [/\.aws[/\\]credentials|\.gnupg|\.netrc|\.git-credentials|\/etc\/(shadow|sudoers)|\bsam\b.*system32/i, 'Akses ke berkas kredensial'],
  [/\bsecurity\s+(find|dump|export)-?(generic|internet|keychain|identity)?/i, 'Akses ke Keychain'],
  [/\b(cmdkey|vaultcmd)\b|\breg\s+(save|export)\b.*\b(sam|security)\b/i, 'Akses ke penyimpanan kredensial Windows'],
  [/\b(printenv|env)\s*(\||$|>)/i, 'Dump environment variable dapat membocorkan rahasia'],
  [/\b(nc|ncat|netcat)\b[^|;&]*\s-[a-z]*e\b/i, 'Reverse shell'],
  [/\/dev\/tcp\//i, 'Koneksi shell mentah'],
  [/\bbase64\s+(-d|--decode)\b[^;&]*\|/i, 'Dekode lalu eksekusi payload']
];

const HIGH: [RegExp, string][] = [
  [/\b(rm|rmdir|del|erase|rd|unlink|shred|trash)\b|remove-item/i, 'Menghapus berkas'],
  [/\bgit\s+(push|reset\s+--hard|clean|checkout\s+--|checkout\s+\.|branch\s+-D|rebase|stash\s+drop)\b/i, 'Operasi Git yang mengubah/menghapus riwayat atau mengirim ke remote'],
  [/\b(npm|pnpm|yarn)\s+publish\b|\btwine\s+upload\b|\bcargo\s+publish\b/i, 'Menerbitkan paket'],
  [/\b(scp|rsync|sftp|ftp)\b/i, 'Transfer data ke host lain'],
  [/\b(kill|killall|pkill|taskkill)\b/i, 'Menghentikan proses'],
  [/\b(chmod|chown|icacls|takeown)\b/i, 'Mengubah izin berkas'],
  [/\b(crontab|schtasks|launchctl|systemctl|sc\s+(create|config))\b/i, 'Mengubah layanan/tugas terjadwal'],
  [/\$\(|`|<\(/, 'Command substitution'],
  [/\b(curl|wget|iwr|invoke-webrequest)\b[^|;&]*(-X\s*(POST|PUT|DELETE|PATCH)|-d\b|--data|-F\b|--upload)/i, 'Permintaan jaringan yang mengirim data']
];

const MEDIUM: [RegExp, string][] = [
  [/\b(npm|pnpm|yarn|bun)\s+(i|install|add|ci|update|upgrade|remove|uninstall)\b/i, 'Menginstal/mengubah dependency'],
  [/\b(pip3?|pipx|uv|poetry|gem|cargo|go|composer|brew|apt(-get)?|dnf|yum|pacman|choco|winget|scoop)\s+(install|add|get|update|upgrade|remove|uninstall)\b/i, 'Menginstal/mengubah paket sistem atau bahasa'],
  [/\bgit\s+(add|commit|merge|pull|fetch|checkout|switch|tag|stash|clone|init|apply|cherry-pick|mv|rm|restore)\b/i, 'Operasi Git yang mengubah repositori'],
  [/\b(mkdir|md|cp|copy|mv|move|ren|rename|touch|tee|ln|mklink|xcopy|robocopy|new-item|set-content|add-content|out-file|copy-item|move-item)\b|\bsed\s+-i/i, 'Membuat/mengubah berkas'],
  [/\b(node|deno|bun|python3?|ruby|php|perl|java|dotnet|npx|tsx|ts-node|make|cmake|gradle|mvn|cargo|go|pytest|vitest|jest|mocha|tsc|vite|webpack|next|electron)\b/i, 'Menjalankan kode/proses build'],
  [/\b(npm|pnpm|yarn|bun)\s+(run|start|test|exec|build|dev)\b/i, 'Menjalankan skrip proyek'],
  [/\b(curl|wget|iwr|invoke-webrequest|ping|nslookup|ssh)\b/i, 'Akses jaringan']
];

const REDIRECT = /(^|[^<>=-])>{1,2}(?!&)/;

const LOW_ONLY = new RegExp(
  '^\\s*(' +
    [
      'ls', 'dir', 'pwd', 'cd', 'cat', 'type', 'head', 'tail', 'wc', 'echo', 'which', 'where', 'whoami', 'hostname',
      'date', 'uname', 'tree', 'stat', 'file', 'du', 'df', 'sort', 'uniq', 'diff', 'grep', 'rg', 'findstr', 'get-childitem',
      'get-content', 'get-location', 'select-string', 'node\\s+(-v|--version)', 'npm\\s+(-v|--version|ls|list|outdated)',
      'python3?\\s+(-V|--version)', 'git\\s+(status|diff|log|branch|show|rev-parse|remote\\s+-v|ls-files|blame)', 'find\\s+(?!.*(-delete|-exec|-ok))'
    ].join('|') +
    ')(\\s|$)',
  'i'
);

/** Pisahkan perintah majemuk; pemisah di dalam kutip diperlakukan konservatif (hanya menaikkan risiko). */
export function splitSegments(cmd: string): string[] {
  return cmd
    .split(/&&|\|\||;|\||\r?\n|&(?!&)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function classifyCommand(command: string): ShellVerdict {
  const cmd = command.trim();
  if (!cmd) return { level: 'blocked', reason: 'Perintah kosong' };
  if (cmd.length > 8000) return { level: 'blocked', reason: 'Perintah terlalu panjang' };

  for (const [re, reason] of BLOCKED) if (re.test(cmd)) return { level: 'blocked', reason };

  let level: ShellLevel = 'low';
  let reason = 'Perintah baca-saja';
  const bump = (l: ShellLevel, r: string) => {
    if (ORDER.indexOf(l) > ORDER.indexOf(level)) {
      level = l;
      reason = r;
    }
  };

  for (const [re, r] of HIGH) if (re.test(cmd)) bump('high', r);
  // Redirect output mengubah berkas, apa pun perintahnya.
  if (REDIRECT.test(cmd.replace(/2>&1|>&\d|&>\s*\/dev\/null|>\s*\/dev\/null/g, ''))) bump('medium', 'Redirect output ke berkas');

  for (const seg of splitSegments(cmd)) {
    if (LOW_ONLY.test(seg)) continue;
    const hit = MEDIUM.find(([re]) => re.test(seg));
    bump('medium', hit ? hit[1] : 'Perintah tidak dikenal sebagai baca-saja');
  }
  return { level: max('low', level), reason };
}

export function verdictToRisk(v: ShellVerdict): Risk {
  return v.level === 'blocked' ? 'critical' : v.level;
}
