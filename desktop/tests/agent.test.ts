import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { call, harness, makeManager, ScriptedProvider, waitFor } from './helpers';
import { toolNamesFor } from '../src/main/agent/manager';

describe('AgentTaskManager', () => {
  it('menjalankan loop tool-calling nyata: tulis berkas -> jalankan perintah -> ringkasan', async () => {
    const h = harness({ grants: { filesystem: true, terminal: true }, autoApprove: true });
    const p = new ScriptedProvider((req, n) => {
      if (n === 1) return { content: 'Saya buat berkas.', toolCalls: [call('write_file', { path: 'hello.js', content: 'console.log("hi")' }, 'c1')], finishReason: 'tool_calls' };
      if (n === 2) return { content: '', toolCalls: [call('run_command', { command: 'node hello.js' }, 'c2')], finishReason: 'tool_calls' };
      const last = req.messages[req.messages.length - 1];
      return { content: `Selesai. Output: ${last.content}`, toolCalls: [], finishReason: 'stop' };
    });
    const m = makeManager(h, p);
    const t = m.start({ mode: 'code', submode: 'agent', prompt: 'buat hello', workspaceId: 'w1' });
    await waitFor(() => ['done', 'error'].includes(m.list()[0].status));
    expect(m.list()[0].status).toBe('done');
    expect(fs.readFileSync(path.join(h.ws, 'hello.js'), 'utf8')).toContain('console.log');
    const textDone = h.events.filter((e) => e.type === 'text_done').map((e) => (e as { content: string }).content).join('\n');
    expect(textDone).toContain('hi');
    expect(m.timeline(t.id).length).toBeGreaterThan(0);
    // hasil tool dikembalikan ke model dengan pasangan tool_call_id
    const second = p.calls[1].messages;
    expect(second.some((x) => x.role === 'tool' && x.tool_call_id === 'c1')).toBe(true);
  });

  it('provider tanpa tool calling: mode Control/Web gagal jelas, tidak pura-pura bekerja (Code memakai mode teks)', async () => {
    const h = harness({ autoApprove: true });
    const p = new ScriptedProvider(() => ({ content: 'x', toolCalls: [], finishReason: 'stop' }), { chat: true, tools: false, vision: false });
    const m = makeManager(h, p);
    m.start({ mode: 'control', prompt: 'x' });
    await waitFor(() => m.list()[0].status === 'error');
    expect(p.calls).toHaveLength(0);
    expect(JSON.stringify(h.events)).toMatch(/tidak mendukung tool calling/);
  });

  it('Control butuh vision, izin screen, dan izin kirim screenshot', async () => {
    const h = harness({ grants: { screen: true }, autoApprove: true });
    let m = makeManager(h, new ScriptedProvider(() => ({ content: '', toolCalls: [], finishReason: 'stop' }), { chat: true, tools: true, vision: false }));
    m.start({ mode: 'control', prompt: 'x' });
    await waitFor(() => m.list()[0].status === 'error');
    expect(JSON.stringify(h.events)).toMatch(/tidak mendukung vision/);

    const h2 = harness({ autoApprove: true });
    m = makeManager(h2, new ScriptedProvider(() => ({ content: '', toolCalls: [], finishReason: 'stop' })));
    m.start({ mode: 'control', prompt: 'x' });
    await waitFor(() => m.list()[0].status === 'error');
    expect(JSON.stringify(h2.events)).toMatch(/Screen observation/);

    const h3 = harness({ grants: { screen: true }, autoApprove: true });
    m = makeManager(h3, new ScriptedProvider(() => ({ content: '', toolCalls: [], finishReason: 'stop' })));
    m.start({ mode: 'control', prompt: 'x' });
    await waitFor(() => m.list()[0].status === 'error');
    expect(JSON.stringify(h3.events)).toMatch(/screenshot ke penyedia AI belum diizinkan/);
  });

  it('Control end-to-end: screenshot dikirim sebagai gambar, klik dieksekusi lewat driver, hasil diverifikasi', async () => {
    const h = harness({ grants: { screen: true, input: true }, autoApprove: true });
    h.permissions.update({ allowScreenshotUpload: true });
    const p = new ScriptedProvider((req, n) => {
      if (n === 1) return { content: '', toolCalls: [call('screenshot', {}, 's1')], finishReason: 'tool_calls' };
      if (n === 2) {
        const sawImage = req.messages.some((m) => Array.isArray(m.content) && m.content.some((c) => c.type === 'image_url'));
        expect(sawImage).toBe(true);
        return { content: '', toolCalls: [call('click', { x: 100, y: 100 }, 'k1')], finishReason: 'tool_calls' };
      }
      return { content: 'Sudah diklik dan diverifikasi.', toolCalls: [], finishReason: 'stop' };
    });
    const m = makeManager(h, p);
    m.start({ mode: 'control', prompt: 'klik tombol' });
    await waitFor(() => m.list()[0].status === 'done');
    expect(h.driver.calls).toContain('click left x1');
  });

  it('tool ditolak pengguna: agen menerima alasan dan tidak ada efek samping', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: false });
    const p = new ScriptedProvider((req, n) => n === 1
      ? { content: '', toolCalls: [call('write_file', { path: 'x.txt', content: 'x' }, 'w')], finishReason: 'tool_calls' }
      : { content: `ditolak: ${req.messages.at(-1)?.content}`, toolCalls: [], finishReason: 'stop' });
    const m = makeManager(h, p);
    m.start({ mode: 'code', submode: 'edit', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0].status === 'done');
    expect(fs.existsSync(path.join(h.ws, 'x.txt'))).toBe(false);
    expect(p.calls[1].messages.at(-1)?.content).toMatch(/GAGAL: Pengguna menolak/);
  });

  it('status waiting_approval selama menunggu, lalu kembali running', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: 'manual' });
    const p = new ScriptedProvider((_r, n) => n === 1 ? { content: '', toolCalls: [call('write_file', { path: 'x.txt', content: 'x' })], finishReason: 'tool_calls' } : { content: 'ok', toolCalls: [], finishReason: 'stop' });
    const m = makeManager(h, p);
    // hubungkan broker->manager seperti services.ts
    const origRequest = h.broker.request.bind(h.broker);
    h.broker.request = (base, sig) => { m.onApproval('request', { ...base, id: 'tmp', createdAt: 0 }, base.taskId); const pr = origRequest(base, sig); void pr.then((r) => m.onApproval('resolved', { id: 'tmp', approved: r.approved }, base.taskId)); return pr; };
    m.start({ mode: 'code', submode: 'edit', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0]?.status === 'waiting_approval');
    h.broker.respond(h.approvals[0].id, true);
    await waitFor(() => m.list()[0].status === 'done');
    expect(fs.readFileSync(path.join(h.ws, 'x.txt'), 'utf8')).toBe('x');
  });

  it('Stop menghentikan task dan menolak persetujuan yang menunggu', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: 'manual' });
    const p = new ScriptedProvider(() => ({ content: '', toolCalls: [call('write_file', { path: 'x.txt', content: 'x' })], finishReason: 'tool_calls' }));
    const m = makeManager(h, p);
    const t = m.start({ mode: 'code', submode: 'edit', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => h.approvals.length === 1);
    m.stop(t.id);
    expect(m.list()[0].status).toBe('stopped');
    await new Promise((r) => setTimeout(r, 30));
    expect(fs.existsSync(path.join(h.ws, 'x.txt'))).toBe(false);
    expect(p.calls).toHaveLength(1);
  });

  it('Stop membatalkan panggilan LLM yang sedang berjalan', async () => {
    const h = harness({ autoApprove: true });
    let aborted = false;
    const p = new ScriptedProvider((req) => new Promise((_res, rej) => { req.signal?.addEventListener('abort', () => { aborted = true; rej(new Error('Dibatalkan')); }); }));
    const m = makeManager(h, p);
    const t = m.start({ mode: 'chat', prompt: 'halo' });
    await new Promise((r) => setTimeout(r, 20));
    m.stop(t.id);
    await new Promise((r) => setTimeout(r, 20));
    expect(aborted).toBe(true);
    expect(m.list()[0].status).toBe('stopped');
  });

  it('Pause menahan loop sebelum langkah berikutnya, Resume melanjutkan', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    const p = new ScriptedProvider((_r, n) => n < 3 ? { content: '', toolCalls: [call('list_dir', {})], finishReason: 'tool_calls' } : { content: 'selesai', toolCalls: [], finishReason: 'stop' });
    const m = makeManager(h, p);
    const t = m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1' });
    m.pause(t.id);
    await new Promise((r) => setTimeout(r, 50));
    const callsWhilePaused = p.calls.length;
    expect(callsWhilePaused).toBeLessThanOrEqual(1);
    expect(m.list()[0].status).toBe('paused');
    m.resume(t.id);
    await waitFor(() => m.list()[0].status === 'done');
    expect(p.calls.length).toBe(3);
  });

  it('pemulihan galat: kegagalan beruntun menghentikan task dengan pesan jelas', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    const p = new ScriptedProvider(() => ({ content: '', toolCalls: [call('read_file', { path: 'tidak-ada.txt' })], finishReason: 'tool_calls' }));
    const m = makeManager(h, p);
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0].status === 'error');
    expect(JSON.stringify(h.events)).toMatch(/Terlalu banyak kegagalan beruntun/);
  });

  it('galat tool satu kali dikembalikan ke model agar bisa memperbaiki diri', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    fs.writeFileSync(path.join(h.ws, 'ada.txt'), 'isi');
    const p = new ScriptedProvider((_r, n) => n === 1 ? { content: '', toolCalls: [call('read_file', { path: 'salah.txt' })], finishReason: 'tool_calls' } : n === 2 ? { content: '', toolCalls: [call('read_file', { path: 'ada.txt' })], finishReason: 'tool_calls' } : { content: 'ok', toolCalls: [], finishReason: 'stop' });
    const m = makeManager(h, p);
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0].status === 'done');
    expect(p.calls[1].messages.at(-1)?.content).toMatch(/GAGAL/);
  });

  it('batas langkah menghentikan loop tak berujung', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    const p = new ScriptedProvider(() => ({ content: '', toolCalls: [call('list_dir', {})], finishReason: 'tool_calls' }));
    const m = makeManager(h, p, { maxSteps: 3 });
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0].status === 'done');
    expect(p.calls).toHaveLength(3);
    expect(JSON.stringify(h.events)).toMatch(/Batas 3 langkah/);
  });

  it('JSON argumen rusak dikembalikan sebagai galat, bukan crash', async () => {
    const h = harness({ grants: { filesystem: true }, autoApprove: true });
    const p = new ScriptedProvider((_r, n) => n === 1 ? { content: '', toolCalls: [{ id: 'b', name: 'list_dir', arguments: '{bad' }], finishReason: 'tool_calls' } : { content: 'ok', toolCalls: [], finishReason: 'stop' });
    const m = makeManager(h, p);
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0].status === 'done');
    expect(p.calls[1].messages.at(-1)?.content).toMatch(/bukan JSON/);
  });

  it('sub-mode Plan tidak memberi model tool yang mengubah apa pun; Edit tanpa terminal', () => {
    const plan = toolNamesFor('code', 'plan');
    expect(plan).not.toContain('write_file');
    expect(plan).not.toContain('run_command');
    expect(toolNamesFor('code', 'edit')).toContain('write_file');
    expect(toolNamesFor('code', 'edit')).not.toContain('run_command');
    expect(toolNamesFor('code', 'agent')).toContain('run_command');
    expect(toolNamesFor('web')).toContain('browser_click');
    expect(toolNamesFor('web')).not.toContain('run_command');
    expect(toolNamesFor('control')).toContain('click');
    expect(toolNamesFor('chat')).toEqual([]);
    // kemampuan di dalam Code
    expect(toolNamesFor('code', 'agent', { web: true })).toContain('browser_click');
    expect(toolNamesFor('code', 'agent', { web: false })).not.toContain('browser_click');
    expect(toolNamesFor('code', 'agent', { computer: true })).toContain('click');
    expect(toolNamesFor('code', 'plan', { computer: true })).not.toContain('click');
    expect(toolNamesFor('code', 'edit', { computer: true })).not.toContain('click');
    expect(toolNamesFor('code', 'agent')).not.toContain('click');
  });

  it('model tidak dapat memanggil tool di luar mode (mis. click di mode code)', async () => {
    const h = harness({ grants: { screen: true, input: true }, autoApprove: true });
    await h.screen.capture(); // koordinat valid: satu-satunya penghalang adalah pembatasan mode
    const p = new ScriptedProvider((req, n) => {
      if (n === 1) {
        expect(req.tools?.some((t) => t.function.name === 'click')).toBe(false);
        return { content: '', toolCalls: [call('click', { x: 1, y: 1 })], finishReason: 'tool_calls' };
      }
      return { content: 'ok', toolCalls: [], finishReason: 'stop' };
    });
    const m = makeManager(h, p);
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1' });
    await waitFor(() => m.list()[0].status === 'done');
    expect(p.calls[1].messages.at(-1)?.content).toMatch(/tidak tersedia pada mode/);
    expect(h.driver.calls).toHaveLength(0);
  });

  it('Code + kemampuan Komputer: tetap butuh vision, izin screen, dan izin kirim screenshot', async () => {
    const h = harness({ grants: { screen: true, input: true }, autoApprove: true });
    const m = makeManager(h, new ScriptedProvider(() => ({ content: '', toolCalls: [], finishReason: 'stop' })));
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1', capabilities: { web: false, computer: true } });
    await waitFor(() => m.list()[0].status === 'error');
    expect(JSON.stringify(h.events)).toMatch(/screenshot ke penyedia AI belum diizinkan/);
  });

  it('Code + Komputer berjalan end-to-end (klik lewat driver) dan menandai task.caps', async () => {
    const h = harness({ grants: { screen: true, input: true }, autoApprove: true });
    h.permissions.update({ allowScreenshotUpload: true });
    const p = new ScriptedProvider((_r, n) => n === 1 ? { content: '', toolCalls: [call('screenshot', {}, 's')], finishReason: 'tool_calls' } : n === 2 ? { content: '', toolCalls: [call('click', { x: 10, y: 10 }, 'k')], finishReason: 'tool_calls' } : { content: 'ok', toolCalls: [], finishReason: 'stop' });
    const m = makeManager(h, p);
    m.start({ mode: 'code', submode: 'agent', prompt: 'x', workspaceId: 'w1', capabilities: { web: false, computer: true } });
    await waitFor(() => m.list()[0].status === 'done');
    expect(m.list()[0].caps).toEqual({ web: false, computer: true });
    expect(h.driver.calls).toContain('click left x1');
  });
});
