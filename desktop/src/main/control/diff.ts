/** Diff baris sederhana (LCS) untuk pratinjau perubahan sebelum diterapkan. */
export function unifiedDiff(oldText: string, newText: string, label = 'file', context = 3): string {
  if (oldText === newText) return '(tidak ada perubahan)';
  const a = oldText.split('\n');
  const b = newText.split('\n');
  if (a.length * b.length > 4_000_000) {
    return `--- ${label}\n+++ ${label}\n(berkas terlalu besar untuk diff rinci: ${a.length} → ${b.length} baris)`;
  }
  const m = a.length;
  const n = b.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  type Op = { t: ' ' | '+' | '-'; s: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { ops.push({ t: ' ', s: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: '-', s: a[i++] });
    else ops.push({ t: '+', s: b[j++] });
  }
  while (i < m) ops.push({ t: '-', s: a[i++] });
  while (j < n) ops.push({ t: '+', s: b[j++] });

  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((o, k) => {
    if (o.t !== ' ') for (let x = Math.max(0, k - context); x <= Math.min(ops.length - 1, k + context); x++) keep[x] = true;
  });
  const out: string[] = [`--- ${label}`, `+++ ${label}`];
  let skipping = false;
  ops.forEach((o, k) => {
    if (keep[k]) { out.push(o.t + o.s); skipping = false; }
    else if (!skipping) { out.push('…'); skipping = true; }
  });
  const text = out.join('\n');
  return text.length > 20_000 ? text.slice(0, 20_000) + '\n… (diff dipotong)' : text;
}
