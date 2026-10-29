import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PERMISSIONS, type AgentEvent, type ApprovalRequest, type PermissionState, type Settings, DEFAULT_SETTINGS } from '@shared/types';
import { AgentTaskManager } from '../src/main/agent/manager';
import type { LLMProvider, LLMRequest, LLMResponse } from '../src/main/agent/llm';
import { FileSystemAgent } from '../src/main/control/fs-agent';
import type { InputDriver, WindowInfo } from '../src/main/control/driver';
import { KeyboardController } from '../src/main/control/keyboard';
import { MouseController } from '../src/main/control/mouse';
import { ScreenshotService } from '../src/main/control/screenshot';
import { TerminalExecutor } from '../src/main/control/terminal';
import { ApprovalBroker } from '../src/main/security/approvals';
import { AuditLogger } from '../src/main/security/audit';
import { PathGuard } from '../src/main/security/paths';
import { PermissionManager } from '../src/main/security/permissions';
import { buildTools, type Services } from '../src/main/tools/definitions';
import { ToolExecutor } from '../src/main/tools/executor';

export class FakeDriver implements InputDriver {
  calls: string[] = [];
  pos = { x: 0, y: 0 };
  scale = 1;
  windows: WindowInfo[] = [{ id: 1, title: 'Editor', x: 0, y: 0, width: 800, height: 600 }];
  async availability() { return { ok: true }; }
  async getPosition() { return this.pos; }
  async screenSize() { return { width: 2000 * this.scale, height: 1000 * this.scale }; }
  async moveTo(x: number, y: number) { this.pos = { x, y }; this.calls.push(`move ${Math.round(x)},${Math.round(y)}`); }
  async click(b: string, n: number) { this.calls.push(`click ${b} x${n}`); }
  async drag(f: { x: number; y: number }, t: { x: number; y: number }) { this.calls.push(`drag ${f.x},${f.y}->${t.x},${t.y}`); }
  async scroll(dx: number, dy: number) { this.calls.push(`scroll ${dx},${dy}`); }
  async typeText(t: string) { this.calls.push(`type ${t}`); }
  async pressCombo(c: string) { this.calls.push(`combo ${c}`); }
  async listWindows() { return this.windows; }
  async focusWindow(id: number) { this.calls.push(`focus ${id}`); return true; }
  async minimizeWindow(id: number) { this.calls.push(`min ${id}`); return true; }
  async restoreWindow(id: number) { this.calls.push(`restore ${id}`); return true; }
}

export function harness(opts: { grants?: Partial<PermissionState['grants']>; mode?: PermissionState['mode']; autoApprove?: boolean | 'manual' | ((r: ApprovalRequest) => boolean) } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'it7-'));
  const ws = fs.realpathSync(fs.mkdtempSync(path.join(dir, 'ws-')));
  const events: AgentEvent[] = [];
  const approvals: ApprovalRequest[] = [];
  const audit = new AuditLogger(path.join(dir, 'audit.jsonl'));
  let persisted: PermissionState | undefined = {
    ...DEFAULT_PERMISSIONS,
    grants: { ...DEFAULT_PERMISSIONS.grants, ...opts.grants },
    mode: opts.mode ?? 'ask',
    allowedFolders: [ws]
  };
  const answer = opts.autoApprove ?? false;
  let broker!: ApprovalBroker;
  broker = new ApprovalBroker((type, payload) => {
    if (type === 'request') {
      const r = payload as ApprovalRequest;
      approvals.push(r);
      events.push({ type: 'approval', request: r });
      if (answer !== 'manual') queueMicrotask(() => broker.respond(r.id, typeof answer === 'function' ? answer(r) : answer));
    }
  });
  const permissions = new PermissionManager({ load: () => persisted, save: (s) => { persisted = s; } }, audit, broker);
  const guard = new PathGuard(() => permissions.getState().allowedFolders);
  const trashed: string[] = [];
  const fsAgent = new FileSystemAgent(guard, async (p) => { trashed.push(p); fs.rmSync(p, { recursive: true, force: true }); });
  const driver = new FakeDriver();
  const shotPng = Buffer.from('fake-jpeg-bytes');
  let shotN = 0;
  const dynamicScreen = { on: true };
  const screen = new ScreenshotService(async () => ({ jpeg: Buffer.concat([shotPng, Buffer.from(String(shotN))]), width: 1000, height: 500, bounds: { x: 0, y: 0, width: 2000, height: 1000 } }));
  const clip = { text: 'prev', readText() { return this.text; }, writeText(t: string) { this.text = t; } };
  const mouse = new MouseController(driver, { logicalSize: () => ({ width: 2000, height: 1000 }), fallbackScale: 1 });
  const keyboard = new KeyboardController(driver, clip, 'ctrl+v');
  const browser = { } as never;
  const platformCalls: string[] = [];
  const services: Services = {
    fs: fsAgent, term: new TerminalExecutor(), screen, mouse, keyboard, driver, browser,
    memory: { read: () => '', write: () => undefined },
    platform: {
      openApp: async (n) => { platformCalls.push(`open ${n}`); return `Membuka ${n}`; },
      listApps: async () => ['Notes'],
      windowOp: async (op, t) => { platformCalls.push(`${op} ${t}`); return 'ok'; },
      openPath: async () => ''
    },
    sleep: async () => { if (dynamicScreen.on) shotN++; }
  };
  const executor = new ToolExecutor(permissions, audit);
  executor.register(...buildTools(services));
  const ac = new AbortController();
  const ctx = (over: Partial<import('../src/main/tools/types').ToolContext> = {}) => {
    const c: import('../src/main/tools/types').ToolContext = {
      taskId: 't1', mode: 'control', workspace: { id: 'w1', name: 'ws', path: ws }, signal: ac.signal, emit: (e) => events.push(e),
      allowImages: true, tainted: false, setTainted() { c.tainted = true; }, ...over
    };
    return c;
  };
  return { dynamicScreen, dir, ws, events, approvals, audit, permissions, broker, guard, fsAgent, driver, screen, mouse, keyboard, executor, services, ctx, ac, clip, trashed, platformCalls };
}

export class ScriptedProvider implements LLMProvider {
  config = { id: 'x', name: 'Fake', kind: 'openai' as const, baseUrl: 'http://x', model: 'm', supportsTools: true, supportsVision: true, hasKey: true };
  calls: LLMRequest[] = [];
  constructor(private script: (req: LLMRequest, n: number) => LLMResponse | Promise<LLMResponse>, private caps = { chat: true, tools: true, vision: true }) {}
  capabilities() { return this.caps; }
  async chat(req: LLMRequest) {
    this.calls.push(structuredClone({ ...req, signal: undefined, onTextDelta: undefined }) as LLMRequest);
    const r = await this.script(req, this.calls.length);
    if (r.content) req.onTextDelta?.(r.content);
    return r;
  }
}

export function makeManager(h: ReturnType<typeof harness>, provider: LLMProvider, settings: Partial<Settings> = {}) {
  const events: AgentEvent[] = h.events;
  const manager = new AgentTaskManager({
    executor: h.executor, permissions: h.permissions, broker: h.broker, audit: h.audit, getProvider: () => provider,
    getSettings: () => ({ ...DEFAULT_SETTINGS, maxSteps: 10, ...settings }),
    getWorkspace: (id) => (id === 'w1' ? { id: 'w1', name: 'ws', path: h.ws } : undefined),
    memoryRead: () => '', emit: (e) => events.push(e), platform: 'linux'
  });
  return manager;
}

export const call = (name: string, args: unknown, id = `c_${Math.random().toString(36).slice(2, 8)}`) => ({ id, name, arguments: JSON.stringify(args) });
export const waitFor = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) throw new Error('waitFor timeout'); await new Promise((r) => setTimeout(r, 5)); }
};
