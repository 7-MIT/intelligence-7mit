// E2E: menjalankan aplikasi Electron sungguhan (di bawah Xvfb) dan menggerakkan UI + agen lewat IPC nyata.
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startMock } from './mock-llm.mjs';
import { startSupabase } from './mock-supabase.mjs';

const shots = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'it7-shots');
fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'it7-ud-'));
const ws = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'it7-ws-')));
const mock = await startMock();
const sb = await startSupabase();
// Izin diseed ke berkas agar bisa dipakai pada build terpasang (dialog konfirmasi native tidak bisa diklik otomatis).
fs.writeFileSync(path.join(userData, 'permissions.json'), JSON.stringify({ grants: { screen: false, input: false, terminal: true, filesystem: true, browser: false, apps: false }, mode: 'ask', allowedFolders: [ws], autoWorkspaces: [], allowScreenshotUpload: false }));

const app = await electron.launch({ ...(process.env.IT7_APP_EXE ? { executablePath: process.env.IT7_APP_EXE } : {}), args: [...(process.env.IT7_APP_EXE ? [] : ['.']), '--no-sandbox', `--user-data-dir=${userData}`], env: { ...process.env, IT7_E2E: '1', IT7_SUPABASE_URL: `http://127.0.0.1:${sb.port}` }, cwd: process.cwd() });
const page = await app.firstWindow();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('dialog', (d) => d.accept());
try {
await page.waitForSelector('[role=dialog][aria-label=Masuk]', { timeout: 30000 });
await page.screenshot({ path: path.join(shots, '00-login.png') });
console.log('✓ layar login tampil pada peluncuran pertama');
// login gagal -> pesan jelas
await page.fill('input[aria-label=Email]', 'ayu@contoh.id');
await page.fill('input[aria-label="Kata sandi"]', 'salahsalah');
await page.click('button:has-text("Masuk dengan email")');
await page.waitForSelector('text=Email atau kata sandi salah.');
// login berhasil -> riwayat web tersinkron
await page.fill('input[aria-label="Kata sandi"]', 'rahasia123');
await page.click('button:has-text("Masuk dengan email")');
await page.waitForSelector('aside >> text=Chat dari web', { timeout: 15000 });
await page.waitForSelector('.userchip >> text=Ayu');
const stAuth = await page.evaluate(() => window.it7.auth.status());
assert.equal(stAuth.status, 'user'); assert.ok(!JSON.stringify(stAuth).includes('E2E-JWT'), 'token tidak boleh sampai renderer');
console.log('✓ login email berhasil; riwayat Chat dari akun web tertarik; token tidak ke renderer');
await page.screenshot({ path: path.join(shots, '01-chat.png') });
console.log('✓ UI termuat');

// Keamanan renderer
const sec = await page.evaluate(() => ({ require: typeof require, process: typeof process, it7: Object.keys(window.it7).sort() }));
assert.equal(sec.require, 'undefined'); assert.equal(sec.process, 'undefined');
assert.ok(sec.it7.includes('perm'));
console.log('✓ renderer terisolasi (tanpa require/process)');

// IPC divalidasi: input buruk ditolak
const bad = await page.evaluate(() => window.it7.perm.set({ mode: 'yolo' }).then(() => 'accepted', (e) => String(e.message)));
assert.notEqual(bad, 'accepted'); console.log('✓ IPC menolak input tidak valid');

// Konfigurasi penyedia tiruan + izin
const provider = await page.evaluate(async ({ port }) => {
  const p = await window.it7.provider.save({ name: 'Mock', kind: 'openai', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'mock-1', supportsTools: true, supportsVision: true });
  await window.it7.provider.setKey({ id: p.id, key: 'sk-e2e-test-key-0123456789' });
  await window.it7.settings.set({ activeProviderId: p.id });
  return p;
}, { port: mock.port });
const w = await page.evaluate((dir) => window.it7.ws.add({ name: 'e2e-ws', path: dir }), ws);
await page.reload();
await page.waitForSelector('aside >> text=Permission Center');

// Chat biasa
await page.click('.modeseg button:has-text("Chat")');
await page.fill('textarea[aria-label="Pesan"]', 'halo');
await page.click('button[aria-label="Kirim"]');
await page.waitForSelector('text=balasan tiruan', { timeout: 15000 });
await page.screenshot({ path: path.join(shots, '02-chat-reply.png') });
console.log('✓ chat streaming dari endpoint OpenAI-compatible');
assert.equal(mock.seen.at(-1).auth, 'Bearer sk-e2e-test-key-0123456789');
await page.waitForTimeout(1500);
assert.ok(sb.state.posts.flat().some((r) => r.messages.some((m) => m.content === 'halo')), 'chat baru harus tersinkron ke akun');
console.log('✓ chat baru dikirim ke tabel riwayat akun');

// Code agent: tool call -> persetujuan -> berkas ditulis
await page.click('.modeseg button:has-text("Code")');
await page.waitForSelector('textarea[placeholder*="membangun"]');
await page.click('[aria-label="Pilih proyek"]');
await page.click(`button[role=option]:has-text("e2e-ws")`);
await page.fill('textarea[aria-label="Pesan"]', 'tolong buat file hello.txt');
await page.click('button[aria-label="Kirim"]');
await page.waitForSelector('[role=alertdialog] >> text=AI meminta izin', { timeout: 15000 });
await page.screenshot({ path: path.join(shots, '03-approval.png') });
assert.ok(!fs.existsSync(path.join(ws, 'hello.txt')), 'berkas tidak boleh ada sebelum disetujui');
await page.click('[role=alertdialog] button:text-is("Setujui")');
await page.waitForSelector('text=Selesai. Hasil tool', { timeout: 15000 });
assert.equal(fs.readFileSync(path.join(ws, 'hello.txt'), 'utf8'), 'halo dari agen\n');
await page.screenshot({ path: path.join(shots, '04-code-done.png') });
// Editor Monaco (bundel lokal + worker blob) harus tampil di bawah CSP produksi bila ada
await page.click('button[aria-label="Panel samping"]');
await page.click('.explorer >> text=hello.txt');
await page.waitForSelector('.monaco-editor', { timeout: 20000 });
await page.waitForSelector('.monaco-editor >> text=halo dari agen');
await page.screenshot({ path: path.join(shots, '04b-monaco.png') });
console.log('✓ editor Monaco menampilkan berkas hasil agen');
console.log('✓ agen Code menulis berkas nyata setelah persetujuan');

// Penolakan
await page.fill('textarea[aria-label="Pesan"]', 'buat file lagi');
await page.click('button[aria-label="Kirim"]');
await page.waitForSelector('[role=alertdialog] >> text=AI meminta izin', { timeout: 15000 });
await page.click('[role=alertdialog] button:has-text("Tolak")');
await page.waitForTimeout(500);
console.log('✓ penolakan ditangani');

// Control tanpa kemampuan: gagal jelas
await page.waitForSelector('button[aria-label="Kirim"]', { timeout: 20000 }); // task sebelumnya selesai
await page.click('button:has-text("Komputer")');
await page.fill('textarea[aria-label="Pesan"]', 'buka notepad');
await page.click('button[aria-label="Kirim"]');
await page.waitForSelector('.a-msg:has-text("Screen observation")', { timeout: 15000 });
await page.screenshot({ path: path.join(shots, '05-control-blocked.png') });
console.log('✓ Control menolak jujur tanpa izin');

// Permission center & settings & history
await page.click('aside >> text=Permission Center'); await page.waitForSelector('text=Mode eksekusi');
await page.screenshot({ path: path.join(shots, '06-permissions.png') });
await page.click('aside >> text=Pengaturan'); await page.waitForSelector('text=Penyedia AI');
await page.screenshot({ path: path.join(shots, '07-settings.png') });
await page.click('aside >> text=Riwayat & Audit'); await page.waitForSelector('text=Audit log tindakan');
await page.screenshot({ path: path.join(shots, '08-history.png') });
const audit = await page.evaluate(() => window.it7.audit.list());
assert.ok(audit.some((e) => e.tool === 'write_file' && e.decision === 'approved'));
assert.ok(audit.some((e) => e.decision === 'rejected'));
assert.ok(!JSON.stringify(audit).includes('sk-e2e-test-key'), 'audit tidak boleh memuat API key');
console.log('✓ audit log mencatat persetujuan/penolakan tanpa bocor key');

// Secret tidak ada di berkas provider
assert.ok(!fs.readFileSync(path.join(userData, 'providers.json'), 'utf8').includes('sk-e2e'));
assert.ok(!fs.readFileSync(path.join(userData, 'secrets.json'), 'utf8').includes('sk-e2e'));
const ps = await page.evaluate(() => window.it7.provider.list());
assert.ok(!JSON.stringify(ps).includes('sk-e2e'));
console.log('✓ API key tidak pernah mencapai renderer / berkas teks biasa');

await page.click('.modeseg button:has-text("Code")');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(shots, '09-code.png') });

// Keluar: riwayat Chat lokal dibersihkan, sesi dicabut di server, layar login kembali
await page.click('aside >> text=Pengaturan');
await page.waitForSelector('text=Sinkronkan sekarang');
await page.screenshot({ path: path.join(shots, '10-account.png') });
await page.click('button:text-is("Keluar")');
await page.waitForSelector('[role=dialog][aria-label=Masuk]');
await page.waitForTimeout(500);
assert.equal(sb.state.loggedOut, true);
const chats = await page.evaluate(() => window.it7.conv.list());
assert.ok(!chats.some((c) => c.mode === 'chat'), 'riwayat Chat lokal harus dibersihkan setelah keluar');
assert.ok(chats.some((c) => c.mode === 'code'), 'percakapan Code tetap ada');
console.log('✓ keluar: sesi dicabut, riwayat Chat lokal dibersihkan, Code tetap ada');
await page.click('button:has-text("Lanjut sebagai tamu")');
await page.waitForSelector('aside >> text=Permission Center');
console.log('✓ mode tamu tanpa login');
await app.close();
mock.server.close();
sb.server.close();
console.log('SEMUA UJI E2E LULUS');
} catch (e) {
  console.error('GAGAL:', e.message.split('\n')[0]);
  await page.screenshot({ path: path.join(shots, 'FAIL.png') }).catch(() => {});
  await app.close().catch(() => {});
  mock.server.close();
  sb.server.close();
  process.exit(1);
}
