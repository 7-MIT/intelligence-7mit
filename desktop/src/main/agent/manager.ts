import { randomUUID } from 'node:crypto';
import type { AgentEvent, AgentMode, TaskCaps, ApprovalRequest, PlanStep, Settings, TaskStatus, TaskSummary, TimelineEvent, Workspace } from '@shared/types';
import type { TaskStartInput } from '@shared/ipc';
import type { PermissionManager } from '../security/permissions';
import type { ApprovalBroker } from '../security/approvals';
import type { AuditLogger } from '../security/audit';
import type { ToolExecutor } from '../tools/executor';
import { toSpec, type ToolContext } from '../tools/types';
import { TOOL_GROUPS } from '../tools/definitions';
import { compactContext } from './context';
import { LLMError, type ContentPart, type LLMMessage, type LLMProvider } from './llm';
import { buildSystemPrompt } from './prompts';
import { buildFirstPrompt, buildResultsPrompt, parseBlocks, renderForDisplay } from './text-mode';
import { wrapUntrusted } from '../security/injection';

export interface ManagerDeps {
  executor: ToolExecutor;
  permissions: PermissionManager;
  broker: ApprovalBroker;
  audit: AuditLogger;
  getProvider(): LLMProvider;
  getSettings(): Settings;
  getWorkspace(id: string): Workspace | undefined;
  memoryRead(workspaceId: string): string;
  emit(e: AgentEvent): void;
  platform: string;
  hooks?: { onStart?(task: TaskSummary): void; onEnd?(task: TaskSummary): void };
}

interface Task {
  summary: TaskSummary;
  abort: AbortController;
  paused: boolean;
  resumeWaiters: (() => void)[];
  waitingApproval: number;
  timeline: TimelineEvent[];
  tainted: boolean;
}

const TERMINAL: TaskStatus[] = ['stopped', 'done', 'error'];

/** Kemampuan efektif: mode lama 'web'/'control' dipetakan ke kemampuan di dalam Code. */
export function effectiveCaps(mode: AgentMode, caps?: Partial<TaskCaps>): TaskCaps {
  return { web: mode === 'web' || !!caps?.web, computer: mode === 'control' || !!caps?.computer };
}

export function toolNamesFor(mode: AgentMode, submode?: string, caps?: Partial<TaskCaps>): string[] {
  const G = TOOL_GROUPS;
  let names: string[] = [];
  if (mode === 'code') {
    const c = effectiveCaps(mode, caps);
    names = [...G.meta, ...G.fsRead, ...(c.web ? G.browser : G.browserRead)];
    if (submode !== 'plan') names.push(...G.fsWrite);
    if (submode === 'agent' || submode === undefined) names.push(...G.terminal);
    // Komputer: hanya pada sub-mode Agent (butuh aksi input); Plan/Edit tidak mendapat tool kontrol.
    if (c.computer && (submode === 'agent' || submode === undefined)) names.push(...G.control);
  } else if (mode === 'web') names = [...G.meta, ...G.browser];
  else if (mode === 'control') names = [...G.meta, ...G.control, ...G.fsRead, ...G.fsWrite, ...G.terminal];
  return names;
}

export class AgentTaskManager {
  private tasks = new Map<string, Task>();
  constructor(private d: ManagerDeps) {}

  setHooks(hooks: NonNullable<ManagerDeps['hooks']>) { this.d.hooks = hooks; }

  list(): TaskSummary[] { return [...this.tasks.values()].map((t) => ({ ...t.summary })).sort((a, b) => b.startedAt - a.startedAt); }
  timeline(id: string): TimelineEvent[] { return this.tasks.get(id)?.timeline ?? []; }
  hasRunningComputer(): boolean { return [...this.tasks.values()].some((t) => !TERMINAL.includes(t.summary.status) && t.summary.caps?.computer); }
  hasRunning(mode?: AgentMode): boolean { return [...this.tasks.values()].some((t) => !TERMINAL.includes(t.summary.status) && (!mode || t.summary.mode === mode)); }

  private setStatus(t: Task, status: TaskStatus) {
    t.summary.status = status;
    if (TERMINAL.includes(status)) t.summary.endedAt = Date.now();
    this.d.emit({ type: 'task', task: { ...t.summary } });
  }

  private note(t: Task, kind: TimelineEvent['kind'], title: string, detail?: string, extra: Partial<TimelineEvent> = {}) {
    const ev: TimelineEvent = { id: randomUUID(), taskId: t.summary.id, at: Date.now(), kind, title, detail, ...extra };
    t.timeline.push(ev);
    this.d.emit({ type: 'timeline', event: ev });
  }

  /** Dipanggil wiring main saat ApprovalBroker memunculkan/menyelesaikan permintaan. */
  onApproval(kind: 'request' | 'resolved', req: ApprovalRequest | { id: string; approved: boolean }, taskId?: string) {
    const t = taskId ? this.tasks.get(taskId) : undefined;
    if (!t || TERMINAL.includes(t.summary.status)) return;
    if (kind === 'request') {
      t.waitingApproval++;
      this.setStatus(t, 'waiting_approval');
      this.note(t, 'approval', 'Menunggu persetujuan', (req as ApprovalRequest).summary, { risk: (req as ApprovalRequest).risk });
    } else {
      t.waitingApproval = Math.max(0, t.waitingApproval - 1);
      const r = req as { approved: boolean };
      this.note(t, 'approval', r.approved ? 'Disetujui pengguna' : 'Ditolak / dibatalkan');
      if (t.waitingApproval === 0 && t.summary.status === 'waiting_approval') this.setStatus(t, t.paused ? 'paused' : 'running');
    }
  }

  start(input: TaskStartInput): TaskSummary {
    const workspace = input.workspaceId ? this.d.getWorkspace(input.workspaceId) : undefined;
    const t: Task = {
      summary: { id: randomUUID(), title: input.prompt.slice(0, 80), mode: input.mode, status: 'running', startedAt: Date.now(), steps: 0, conversationId: input.conversationId, caps: effectiveCaps(input.mode, input.capabilities) },
      abort: new AbortController(), paused: false, resumeWaiters: [], waitingApproval: 0, timeline: [], tainted: false
    };
    this.tasks.set(t.summary.id, t);
    this.d.emit({ type: 'task', task: { ...t.summary } });
    this.d.audit.log({ actor: 'user', taskId: t.summary.id, tool: 'task.start', decision: 'ok', summary: `Mulai task (${input.mode}): ${input.prompt.slice(0, 200)}` });
    this.d.hooks?.onStart?.(t.summary);
    void this.run(t, input, workspace).catch((err) => {
      this.note(t, 'error', 'Kesalahan internal', (err as Error).message);
      this.setStatus(t, 'error');
    }).finally(() => {
      this.d.permissions.clearTask(t.summary.id);
      this.d.hooks?.onEnd?.(t.summary);
    });
    return { ...t.summary };
  }

  pause(id: string) {
    const t = this.tasks.get(id);
    if (!t || TERMINAL.includes(t.summary.status)) return;
    t.paused = true;
    this.note(t, 'status', 'Dijeda oleh pengguna (berlaku setelah langkah berjalan selesai)');
    if (t.summary.status === 'running') this.setStatus(t, 'paused');
  }
  resume(id: string) {
    const t = this.tasks.get(id);
    if (!t || !t.paused) return;
    t.paused = false;
    this.note(t, 'status', 'Dilanjutkan');
    if (t.summary.status === 'paused') this.setStatus(t, 'running');
    t.resumeWaiters.splice(0).forEach((w) => w());
  }
  stop(id: string) {
    const t = this.tasks.get(id);
    if (!t || TERMINAL.includes(t.summary.status)) return;
    t.abort.abort();
    this.d.broker.rejectAll(id);
    t.paused = false;
    t.resumeWaiters.splice(0).forEach((w) => w());
    this.note(t, 'status', 'Dihentikan oleh pengguna');
    this.setStatus(t, 'stopped');
    this.d.audit.log({ actor: 'user', taskId: id, tool: 'task.stop', decision: 'ok', summary: 'Task dihentikan pengguna' });
  }
  stopAll() { for (const t of this.tasks.values()) this.stop(t.summary.id); }

  private async waitIfPaused(t: Task) {
    while (t.paused && !t.abort.signal.aborted) await new Promise<void>((r) => t.resumeWaiters.push(r));
  }

  private fail(t: Task, title: string, detail: string) {
    this.note(t, 'error', title, detail);
    this.d.emit({ type: 'text_done', taskId: t.summary.id, messageId: randomUUID(), content: `⚠️ ${title}\n\n${detail}`, at: Date.now() });
    this.setStatus(t, 'error');
  }

  /**
   * Code tanpa tool calling: AI menulis blok FILE/RUN di balasannya; aplikasi menerapkannya lewat tool nyata
   * (write_file / run_command) dengan diff, persetujuan, batas folder, dan audit yang sama.
   */
  private async runText(t: Task, input: TaskStartInput, workspace: Workspace | undefined, provider: LLMProvider) {
    const settings = this.d.getSettings();
    const submode = input.submode ?? 'agent';
    t.summary.caps = { web: false, computer: false };
    this.d.emit({ type: 'task', task: { ...t.summary } });
    const names = new Set(toolNamesFor('code', submode, { web: false, computer: false }));
    const ctx: ToolContext = {
      taskId: t.summary.id, mode: 'code', workspace, allowedTools: names, signal: t.abort.signal,
      emit: (e) => { if (e.type === 'timeline') t.timeline.push(e.event); this.d.emit(e); },
      allowImages: false,
      get tainted() { return t.tainted; },
      setTainted: () => { t.tainted = true; }
    };
    this.note(t, 'status', `Task dimulai (code/${submode}, mode teks) • ${provider.config.name} / ${provider.config.model}`);
    if (input.capabilities?.web || input.capabilities?.computer) this.note(t, 'warning', 'Web/Komputer dilewati', 'Kemampuan ini butuh penyedia dengan tool calling. Code berjalan dalam mode teks.');

    // 1) Konteks proyek: struktur folder + berkas yang relevan (dibaca lewat tool read-only, tetap diaudit)
    let tree = '';
    const files: { path: string; wrapped: string }[] = [];
    if (workspace) {
      const list = await this.d.executor.execute('search_files', { path: '.', name: '*', max: 300 }, ctx);
      if (list.ok) {
        const rel = list.output.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('<') && !l.startsWith('[PERINGATAN')).map((l) => l.replace(workspace.path, '').replace(/^[\\/]+/, '').replace(/\\/g, '/'));
        tree = rel.join('\n');
        const prompt = input.prompt.toLowerCase();
        const pick = new Set<string>();
        for (const f of rel) if (/^(readme\.md|package\.json)$/i.test(f)) pick.add(f);
        for (const f of rel) { const base = f.split('/').pop()!.toLowerCase(); if (prompt.includes(f.toLowerCase()) || (base.length > 3 && prompt.includes(base))) pick.add(f); }
        let budget = 80_000;
        for (const f of [...pick].slice(0, 8)) {
          if (budget <= 0 || t.abort.signal.aborted) break;
          const r = await this.d.executor.execute('read_file', { path: f, raw: true }, ctx);
          if (r.ok) { const w = r.output.slice(0, Math.min(30_000, budget)); budget -= w.length; files.push({ path: f, wrapped: w }); }
        }
      }
    }
    if (t.abort.signal.aborted) return;

    // 2) Percakapan
    const messages: LLMMessage[] = [];
    for (const h of input.history ?? []) messages.push({ role: h.role, content: h.content });
    let attach = '';
    for (const a of input.attachments ?? []) if (!a.mime.startsWith('image/')) attach += `\nLampiran "${a.name}":\n` + wrapUntrusted(`lampiran ${a.name}`, a.data.slice(0, 60_000));
    messages.push({ role: 'user', content: buildFirstPrompt({ submode, hasWorkspace: !!workspace, tree, files, request: input.prompt + attach }) });

    // 3) Loop terbatas: balasan -> terapkan blok -> hasil kembali ke model
    let rejectedRounds = 0;
    let failedRounds = 0;
    const maxTurns = Math.min(settings.maxSteps, 8);
    for (let step = 1; step <= maxTurns; step++) {
      await this.waitIfPaused(t);
      if (t.abort.signal.aborted) return;
      t.summary.steps = step;
      this.d.emit({ type: 'task', task: { ...t.summary } });
      const messageId = randomUUID();
      let resp;
      try {
        resp = await provider.chat({ messages: compactContext(messages), signal: t.abort.signal, onTextDelta: (delta) => this.d.emit({ type: 'text_delta', taskId: t.summary.id, messageId, delta }) });
      } catch (err) {
        if (t.abort.signal.aborted) return;
        return this.fail(t, 'Panggilan ke penyedia AI gagal', (err as Error).message);
      }
      if (t.abort.signal.aborted) return;
      const blocks = parseBlocks(resp.content);
      if (resp.content) this.d.emit({ type: 'text_done', taskId: t.summary.id, messageId, content: renderForDisplay(resp.content), at: Date.now() });
      messages.push({ role: 'assistant', content: resp.content });
      if (blocks.truncated) this.note(t, 'warning', 'Balasan AI terpotong', 'Ada blok FILE/RUN tanpa penutup; blok itu diabaikan.');

      const actionable = submode === 'plan' ? { files: [], runs: [] } : { files: blocks.files.slice(0, 10), runs: submode === 'edit' ? [] : blocks.runs.slice(0, 4) };
      if (!actionable.files.length && !actionable.runs.length) { this.note(t, 'status', 'Task selesai'); this.setStatus(t, 'done'); return; }

      const results: string[] = [];
      let ok = 0; let denied = 0;
      for (const f of actionable.files) {
        if (t.abort.signal.aborted) return;
        const r = await this.d.executor.execute('write_file', { path: f.path, content: f.content.slice(0, 400_000) }, ctx);
        results.push(`- FILE ${f.path}: ${r.ok ? 'tersimpan' : 'GAGAL — ' + r.output.slice(0, 300)}`);
        if (r.ok) ok++; else if (/menolak/i.test(r.output)) denied++;
      }
      for (const cmd of actionable.runs) {
        if (t.abort.signal.aborted) return;
        const r = await this.d.executor.execute('run_command', { command: cmd }, ctx);
        results.push(`- RUN ${cmd}\n${r.output.slice(0, 3000)}`);
        if (r.ok) ok++; else if (/menolak/i.test(r.output)) denied++;
      }
      if (t.abort.signal.aborted) return;
      const total = actionable.files.length + actionable.runs.length;
      if (denied === total) { rejectedRounds++; }
      if (rejectedRounds >= 1) { this.note(t, 'status', 'Semua usulan ditolak pengguna — task dihentikan'); this.setStatus(t, 'done'); return; }
      failedRounds = ok === 0 ? failedRounds + 1 : 0;
      if (failedRounds >= 3) return this.fail(t, 'Terlalu banyak kegagalan beruntun', results.join('\n').slice(0, 500));
      messages.push({ role: 'user', content: buildResultsPrompt(results) });
    }
    this.note(t, 'warning', `Batas ${maxTurns} putaran tercapai`, 'Kirim pesan lanjutan untuk meneruskan.');
    this.setStatus(t, 'done');
  }

  private async run(t: Task, input: TaskStartInput, workspace?: Workspace) {
    const settings = this.d.getSettings();
    const provider = this.d.getProvider();
    const caps = provider.capabilities();
    const perm = this.d.permissions.getState();
    const mode = input.mode;

    if (mode !== 'chat') {
      if (!caps.tools && mode === 'code') return this.runText(t, input, workspace, provider);
      if (!caps.tools) return this.fail(t, `Penyedia "${provider.config.name}" tidak mendukung tool calling`, `${caps.reason ?? ''}\nMode ${mode} membutuhkan tool calling, jadi tidak dijalankan agar tidak berpura-pura bekerja. Pilih penyedia kompatibel OpenAI yang mendukung tool calling di Pengaturan.`.trim());
      if (effectiveCaps(mode, input.capabilities).computer && (mode === 'control' || input.submode === 'agent' || !input.submode)) {
        if (!caps.vision) return this.fail(t, `Penyedia "${provider.config.name}" tidak mendukung vision`, 'Mode Control perlu model multimodal untuk membaca layar. Pilih model dengan vision, atau tandai dukungan vision jika model Anda memang mendukungnya.');
        if (!perm.grants.screen) return this.fail(t, 'Izin "Screen observation" belum diberikan', 'Aktifkan izin di Permission Center sebelum memulai Control Session.');
        if (!perm.allowScreenshotUpload) return this.fail(t, 'Pengiriman screenshot ke penyedia AI belum diizinkan', `Mode Control mengirim screenshot ke ${provider.config.name} (${provider.config.baseUrl}). Aktifkan "Izinkan kirim screenshot ke penyedia AI" di Permission Center jika Anda setuju.`);
      }
    }

    const tools = mode === 'chat' ? [] : toolNamesFor(mode, input.submode, input.capabilities).map((n) => this.d.executor.get(n)).filter((x): x is NonNullable<typeof x> => !!x);
    const specs = tools.map(toSpec);
    const ctx: ToolContext = {
      taskId: t.summary.id, mode, workspace, allowedTools: new Set(tools.map((x) => x.name)), signal: t.abort.signal, emit: (e) => {
        if (e.type === 'timeline') t.timeline.push(e.event);
        this.d.emit(e);
      },
      allowImages: caps.vision && perm.allowScreenshotUpload,
      get tainted() { return t.tainted; },
      setTainted: () => { t.tainted = true; },
      setPlan: (steps) => {
        const plan: PlanStep[] = steps.map((s, i) => ({ id: String(i), title: s.title, status: (s.status as PlanStep['status']) ?? 'pending' }));
        this.d.emit({ type: 'plan', taskId: t.summary.id, steps: plan });
        this.note(t, 'plan', `Rencana: ${plan.length} langkah`, plan.map((p) => `${p.status === 'done' ? '✔' : p.status === 'active' ? '▶' : p.status === 'failed' ? '✖' : '○'} ${p.title}`).join('\n'));
      }
    };

    const messages: LLMMessage[] = [{ role: 'system', content: buildSystemPrompt({ mode, submode: input.submode, caps: effectiveCaps(mode, input.capabilities), workspace, memory: workspace ? this.d.memoryRead(workspace.id) : undefined, platform: this.d.platform }) }];
    for (const h of input.history ?? []) messages.push({ role: h.role, content: h.content });
    const userParts: ContentPart[] = [{ type: 'text', text: input.prompt }];
    for (const a of input.attachments ?? []) {
      if (a.mime.startsWith('image/')) {
        if (caps.vision) userParts.push({ type: 'image_url', image_url: { url: a.data } });
        else userParts.push({ type: 'text', text: `[Lampiran gambar "${a.name}" tidak dapat dibaca: model tidak mendukung vision]` });
      } else userParts.push({ type: 'text', text: `Lampiran "${a.name}":\n` + wrapUntrusted(`lampiran ${a.name}`, a.data.slice(0, 100_000)) });
    }
    messages.push({ role: 'user', content: userParts.length === 1 ? input.prompt : userParts });

    this.note(t, 'status', `Task dimulai (${mode}${input.submode ? '/' + input.submode : ''}) • ${provider.config.name} / ${provider.config.model}`);
    let failures = 0;

    for (let step = 1; step <= settings.maxSteps; step++) {
      await this.waitIfPaused(t);
      if (t.abort.signal.aborted) return;
      t.summary.steps = step;
      this.d.emit({ type: 'task', task: { ...t.summary } });

      const messageId = randomUUID();
      let resp;
      try {
        resp = await provider.chat({
          messages: compactContext(messages), tools: specs.length ? specs : undefined, signal: t.abort.signal,
          onTextDelta: (delta) => this.d.emit({ type: 'text_delta', taskId: t.summary.id, messageId, delta })
        });
      } catch (err) {
        if (t.abort.signal.aborted) return;
        const e = err as LLMError;
        return this.fail(t, 'Panggilan ke penyedia AI gagal', e.message);
      }
      if (t.abort.signal.aborted) return;

      if (resp.content) this.d.emit({ type: 'text_done', taskId: t.summary.id, messageId, content: resp.content, at: Date.now() });
      messages.push({
        role: 'assistant', content: resp.content || null,
        ...(resp.toolCalls.length ? { tool_calls: resp.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments || '{}' } })) } : {})
      });

      if (!resp.toolCalls.length) {
        this.note(t, 'status', 'Task selesai');
        this.setStatus(t, 'done');
        return;
      }

      for (const call of resp.toolCalls) {
        if (t.abort.signal.aborted) return;
        await this.waitIfPaused(t);
        let args: unknown = {};
        let parseError: string | null = null;
        try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { parseError = 'Argumen bukan JSON valid'; }
        const result = parseError ? { ok: false, output: parseError } : await this.d.executor.execute(call.name, args, ctx);
        if (t.abort.signal.aborted) return;
        messages.push({ role: 'tool', tool_call_id: call.id, content: (result.ok ? '' : 'GAGAL: ') + result.output });
        if (result.images?.length) {
          messages.push({ role: 'user', content: [{ type: 'text', text: `[Gambar hasil tool ${call.name}]` }, ...result.images.map((u): ContentPart => ({ type: 'image_url', image_url: { url: u } }))] });
        }
        failures = result.ok ? 0 : failures + 1;
        if (failures >= 4) return this.fail(t, 'Terlalu banyak kegagalan beruntun', `4 tool berturut-turut gagal. Kesalahan terakhir:\n${result.output.slice(0, 500)}`);
      }
    }
    this.note(t, 'warning', `Batas ${settings.maxSteps} langkah tercapai`, 'Task dihentikan agar tidak berjalan tanpa batas. Mulai task baru untuk melanjutkan.');
    this.d.emit({ type: 'text_done', taskId: t.summary.id, messageId: randomUUID(), content: `⏹ Batas ${settings.maxSteps} langkah tercapai. Kirim pesan lanjutan untuk meneruskan.`, at: Date.now() });
    this.setStatus(t, 'done');
  }
}
