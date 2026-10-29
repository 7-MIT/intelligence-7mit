// E2E Control NYATA di Linux/X11 (Xvfb): agen melihat screenshot, mengklik jendela xterm, mengetik, menekan Enter.
// Hasil diverifikasi secara independen lewat berkas yang ditulis oleh proses di dalam xterm.
import { _electron as electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = path.join(os.tmpdir(), `it7-typed-${process.pid}.txt`);
fs.rmSync(out, { force: true });
const shots = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'it7-shots');
fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'it7-ud-'));

// Mock LLM berskrip: screenshot -> klik -> ketik -> Enter -> selesai
const seen = [];
const steps = [
  () => ({ name: 'screenshot', args: {} }),
  () => ({ name: 'list_windows', args: {} }),
  (last) => ({ name: 'focus_window', args: { id: Number(last.match(/#(\d+) "[^"\n]*it7xterm[^"\n]*"/i)?.[1]) } }),
  () => ({ name: 'click', args: { x: 340, y: 250 } }),
  () => ({ name: 'type_text', args: { text: 'halo-kontrol-nyata' } }),
  () => ({ name: 'press_keys', args: { keys: 'enter' } }),
  (_l, all) => ({ name: 'window_action', args: { id: Number(all[1].match(/#(\d+) "[^"\n]*it7xterm[^"\n]*"/i)?.[1]), action: 'close' } })
];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const j = JSON.parse(body);
    seen.push(j);
    const n = j.messages.filter((m) => m.role === 'tool').length;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (delta, fin) => res.write(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: fin ?? null }] })}\n\n`);
    if (process.env.DEBUG_TOOLS) console.error('MODEL SAW:', j.messages.filter((m) => m.role === 'tool').slice(-1).map((m) => String(m.content).slice(0, 700)).join());
    const toolTexts = j.messages.filter((m) => m.role === 'tool').map((m) => String(m.content));
    if (n < steps.length) { const st = steps[n](toolTexts.at(-1) ?? '', toolTexts); send({ tool_calls: [{ index: 0, id: `c${n}`, function: { name: st.name, arguments: JSON.stringify(st.args) } }] }, 'tool_calls'); }
    else send({ content: 'Selesai: sudah mengetik di terminal.' }, 'stop');
    res.write('data: [DONE]\n\n'); res.end();
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

let xterm;
const xtermExited = { done: false };
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args); let o = ''; p.stdout.on('data', (d) => (o += d)); p.on('close', () => res(o)); p.on('error', rej); });

// Izin diseed langsung ke berkas (build terpasang tidak memakai hook uji, dialog konfirmasi native tetap aktif).
fs.writeFileSync(path.join(userData, 'permissions.json'), JSON.stringify({ grants: { screen: true, input: true, terminal: false, filesystem: false, browser: false, apps: true }, mode: 'ask', allowedFolders: [], autoWorkspaces: [], allowScreenshotUpload: true }));
const app = await electron.launch({ ...(process.env.IT7_APP_EXE ? { executablePath: process.env.IT7_APP_EXE } : {}), args: [...(process.env.IT7_APP_EXE ? [] : ['.']), '--no-sandbox', `--user-data-dir=${userData}`], env: { ...process.env, IT7_E2E: '1' } });
const page = await app.firstWindow();
try {
  await page.waitForSelector('aside >> text=Permission Center', { timeout: 30000 });
  const sys = await page.evaluate(() => window.it7.system.status());
  console.log('status sistem:', JSON.stringify({ input: sys.input, platform: sys.platform }));
  assert.equal(sys.input.available, true, 'nut.js harus termuat: ' + sys.input.reason);

  await page.evaluate(async ({ port }) => {
    const p = await window.it7.provider.save({ name: 'Mock', kind: 'openai', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'mock', supportsTools: true, supportsVision: true });
    await window.it7.provider.setKey({ id: p.id, key: 'sk-e2e-0123456789abcdef' });
    await window.it7.settings.set({ activeProviderId: p.id });
    // Simulasi pengguna yang menekan "Setujui" pada setiap permintaan
    window.__approved = [];
    window.it7.onAgentEvent((e) => { if (e.type === 'approval') { window.__approved.push(e.request.tool + ':' + e.request.risk); window.it7.perm.respond({ id: e.request.id, approved: true }); } });
  }, { port });
  await page.reload();
  await page.waitForSelector('aside >> text=Permission Center');
  await page.evaluate(() => { window.__approved = []; window.it7.onAgentEvent((e) => { if (e.type === 'approval') { window.__approved.push(e.request.tool + ':' + e.request.risk); window.it7.perm.respond({ id: e.request.id, approved: true }); } }); });

  await page.click('.modeseg button:has-text("Code")');
  await page.waitForSelector('textarea[aria-label="Pesan"]');
  await page.click('button:has-text("Komputer")');
  // xterm dibuka SETELAH jendela aplikasi sehingga berada di atasnya (tanpa window manager, urutan = waktu dibuat)
  xterm = spawn('xterm', ['-T', 'it7xterm', '-geometry', '60x16+100+100', '-e', 'sh', '-c', `cat > ${out}`], { stdio: 'ignore' });
  xterm.on('exit', () => { xtermExited.done = true; });
  await new Promise((r) => setTimeout(r, 1500));
  await page.fill('textarea[aria-label="Pesan"]', 'ketik halo di terminal');
  await page.click('button[aria-label="Kirim"]');
  await page.waitForSelector('.a-msg:has-text("Selesai: sudah mengetik")', { timeout: 40000 });
  await page.screenshot({ path: path.join(shots, '10-control-live.png') });

  await new Promise((r) => setTimeout(r, 500));
  const mouse = (await run('xdotool', ['getmouselocation'])).trim();
  console.log('posisi pointer menurut X server:', mouse);
  const typed = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  assert.equal(typed, 'halo-kontrol-nyata\n', `isi berkas dari xterm: ${JSON.stringify(typed)}`);
  console.log('✓ mouse klik + keyboard ketik + Enter benar-benar terjadi di X11');

  assert.equal(xtermExited.done, true, 'xterm harus tertutup oleh window_action close');
  console.log('✓ window_action close menutup jendela aplikasi sungguhan (setelah persetujuan risiko tinggi)');
  const imgReq = seen.find((r) => r.messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === 'image_url')));
  assert.ok(imgReq, 'screenshot harus dikirim ke model sebagai gambar');
  const url = imgReq.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).find((c) => c.type === 'image_url').image_url.url;
  assert.match(url, /^data:image\/jpeg;base64,\/9j\//);
  console.log('✓ screenshot nyata (JPEG', Math.round(url.length / 1024), 'KB) dikirim sebagai image_url');

  const approved = await page.evaluate(() => window.__approved);
  assert.ok(approved.some((a) => a.startsWith('click:')) && approved.some((a) => a.startsWith('type_text:')), 'klik/ketik harus meminta persetujuan: ' + approved);
  console.log('✓ setiap tindakan input meminta persetujuan:', approved.join(', '));
  const frame = await page.evaluate(() => document.querySelector('.screen img')?.src?.slice(0, 23));
  assert.equal(frame, 'data:image/jpeg;base64,');
  console.log('✓ pratinjau layar langsung tampil di panel Layar (Code + Komputer)');

  // Stop: task baru, tolak semua lalu Stop AI
  await app.close();
  console.log('SEMUA UJI CONTROL E2E LULUS');
} catch (e) {
  console.error('GAGAL:', e.message.split('\n').slice(0, 3).join(' | '));
  try {
    const tasks = await page.evaluate(() => window.it7.task.list());
    for (const t of tasks) for (const ev of await page.evaluate((id) => window.it7.task.timeline({ id }), t.id)) console.error(' •', ev.kind, ev.title, (ev.detail || '').slice(0, 160).replace(/\n/g, ' '));
  } catch {}
  spawn('import', ['-window', 'root', path.join(shots, 'FAIL-root.png')], { stdio: 'ignore' });
  xterm.on('exit', () => { xtermExited.done = true; });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(shots, 'FAIL-control.png') }).catch(() => {});
  await app.close().catch(() => {});
  process.exitCode = 1;
} finally {
  xterm?.kill(); server.close();
}
