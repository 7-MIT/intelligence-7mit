import { randomUUID } from 'node:crypto';
import type { AuditLogger } from '../security/audit';
import type { PermissionManager } from '../security/permissions';
import { scanForInjection, wrapUntrusted } from '../security/injection';
import { validateArgs, type ToolContext, type ToolDef, type ToolResult } from './types';

const MAX_OUTPUT = 40_000;

/**
 * Satu-satunya jalur eksekusi tool: validasi argumen -> rencana risiko -> PermissionManager -> run -> audit.
 * Tool tidak dapat dipanggil langsung oleh output model maupun konten web.
 */
export class ToolExecutor {
  private tools = new Map<string, ToolDef>();
  constructor(private permissions: PermissionManager, private audit: AuditLogger) {}

  register(...defs: ToolDef[]): void {
    for (const d of defs) this.tools.set(d.name, d);
  }
  get(name: string): ToolDef | undefined {
    return this.tools.get(name);
  }
  all(): ToolDef[] {
    return [...this.tools.values()];
  }

  async execute(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    const emitCall = (title: string, detail?: string, risk?: import('@shared/types').Risk) =>
      ctx.emit({ type: 'timeline', event: { id: randomUUID(), taskId: ctx.taskId, at: Date.now(), kind: 'tool_call', title, detail, tool: name, risk } });
    const emitResult = (ok: boolean, title: string, detail?: string) =>
      ctx.emit({ type: 'timeline', event: { id: randomUUID(), taskId: ctx.taskId, at: Date.now(), kind: 'tool_result', title, detail, tool: name, ok } });

    if (!tool) {
      emitResult(false, `Tool tidak dikenal: ${name}`);
      return { ok: false, output: `Tool "${name}" tidak ada.` };
    }
    if (ctx.allowedTools && !ctx.allowedTools.has(name)) {
      emitResult(false, `Tool ${name} tidak tersedia pada mode ini`);
      this.audit.log({ actor: 'agent', taskId: ctx.taskId, tool: name, decision: 'denied', summary: `Tool di luar mode ditolak: ${name}` });
      return { ok: false, output: `Tool "${name}" tidak tersedia pada mode/sub-mode ini.` };
    }
    if (ctx.signal.aborted) return { ok: false, output: 'Task dihentikan.' };

    let args: Record<string, unknown>;
    try {
      args = validateArgs(tool.args, rawArgs);
    } catch (err) {
      emitResult(false, `${name}: argumen tidak valid`, (err as Error).message);
      return { ok: false, output: `Argumen tidak valid: ${(err as Error).message}` };
    }

    let plan;
    try {
      plan = await tool.plan(args, ctx);
    } catch (err) {
      emitResult(false, `${name}: ditolak`, (err as Error).message);
      this.audit.log({ actor: 'agent', taskId: ctx.taskId, tool: name, kind: tool.kind, decision: 'denied', summary: (err as Error).message });
      return { ok: false, output: (err as Error).message };
    }

    emitCall(plan.summary, plan.detail, plan.risk);
    if (tool.meta) {
      try {
        const res = await tool.run(args, ctx);
        emitResult(res.ok, plan.summary, res.output.slice(0, 300));
        return res;
      } catch (err) {
        emitResult(false, `Error: ${plan.summary}`, (err as Error).message);
        return { ok: false, output: `Error: ${(err as Error).message}` };
      }
    }
    const decision = await this.permissions.authorize(
      {
        tool: name, kind: tool.kind, risk: plan.risk, summary: plan.summary, detail: plan.detail, readOnly: plan.readOnly,
        actor: 'agent', taskId: ctx.taskId, blocked: plan.blocked, workspacePath: ctx.workspace?.path, tainted: ctx.tainted
      },
      ctx.signal
    );
    if (!decision.allowed) {
      emitResult(false, `Ditolak: ${plan.summary}`, decision.reason);
      return { ok: false, output: decision.reason };
    }
    if (ctx.signal.aborted) return { ok: false, output: 'Task dihentikan.' };

    try {
      const res = await tool.run(args, ctx);
      let output = res.output.length > MAX_OUTPUT ? res.output.slice(0, MAX_OUTPUT) + '\n… (output dipotong)' : res.output;
      if (res.untrusted) {
        const scan = scanForInjection(output);
        if (scan.flagged) {
          ctx.setTainted();
          ctx.emit({ type: 'timeline', event: { id: randomUUID(), taskId: ctx.taskId, at: Date.now(), kind: 'warning', title: 'Kemungkinan prompt injection terdeteksi', detail: `Sumber: ${res.untrusted}. Pola: ${scan.matches.join(', ')}. Tindakan berikutnya wajib disetujui.` } });
          this.audit.log({ actor: 'system', taskId: ctx.taskId, tool: name, decision: 'denied', summary: `Prompt injection terdeteksi dari ${res.untrusted}: ${scan.matches.join(', ')}` });
        }
        output = wrapUntrusted(res.untrusted, output, scan);
      }
      emitResult(res.ok, res.ok ? `Selesai: ${plan.summary}` : `Gagal: ${plan.summary}`, output.slice(0, 600));
      this.audit.log({ actor: 'agent', taskId: ctx.taskId, tool: name, kind: tool.kind, risk: plan.risk, decision: res.ok ? 'ok' : 'error', summary: plan.summary, detail: output.slice(0, 500) });
      return { ...res, output };
    } catch (err) {
      const msg = (err as Error).message || String(err);
      emitResult(false, `Error: ${plan.summary}`, msg);
      this.audit.log({ actor: 'agent', taskId: ctx.taskId, tool: name, kind: tool.kind, risk: plan.risk, decision: 'error', summary: plan.summary, detail: msg });
      return { ok: false, output: `Error: ${msg}` };
    }
  }
}
