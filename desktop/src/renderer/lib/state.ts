import type {
  AgentEvent, AgentMode, ApprovalRequest, TaskCaps, ChatMessage, CodeSubmode, Conversation, PermissionState, PlanStep, ProviderConfig, Settings, SystemStatus, TaskSummary, TimelineEvent, Workspace
} from '@shared/types';
import { DEFAULT_PERMISSIONS, DEFAULT_SETTINGS } from '@shared/types';
import type { TaskStartInput } from '@shared/ipc';
import { api, errMsg, type AuthState } from './api';
import { createStore } from './mini-store';

export type Page = 'chat' | 'code' | 'permissions' | 'history' | 'settings';
export type PanelTab = 'files' | 'changes' | 'terminal' | 'browser' | 'screen';
export interface Toast { id: string; kind: 'info' | 'error' | 'success'; text: string }
export interface Attachment { name: string; mime: string; size: number; data: string }

export interface AppState {
  ready: boolean;
  page: Page;
  settings: Settings;
  permissions: PermissionState;
  providers: ProviderConfig[];
  workspaces: Workspace[];
  workspaceId?: string;
  convList: Omit<Conversation, 'messages'>[];
  conv: Conversation | null;
  streams: Record<string, { taskId: string; content: string }>;
  tasks: Record<string, TaskSummary>;
  taskConv: Record<string, string>;
  timelines: Record<string, TimelineEvent[]>;
  plans: Record<string, PlanStep[]>;
  approvals: ApprovalRequest[];
  frame: { dataUrl: string; width: number; height: number; at: number } | null;
  target: { x: number; y: number; action: string; width: number; height: number; at: number } | null;
  browserFrame: string | null;
  capture: { active: boolean; reason?: string };
  toasts: Toast[];
  system: SystemStatus | null;
  info: { version: string; platform: string; arch: string; packaged: boolean; userData: string; crashed: boolean } | null;
  submode: CodeSubmode;
  caps: TaskCaps;
  panelOpen: boolean;
  panelTab: PanelTab;
  sidebarOpen: boolean;
  auth: AuthState | null;
}

export const store = createStore<AppState>({
  ready: false, page: 'chat', settings: DEFAULT_SETTINGS, permissions: DEFAULT_PERMISSIONS, providers: [], workspaces: [], convList: [], conv: null,
  streams: {}, tasks: {}, taskConv: {}, timelines: {}, plans: {}, approvals: [], frame: null, target: null, browserFrame: null, capture: { active: false },
  toasts: [], system: null, info: null, submode: 'agent', caps: { web: false, computer: false }, panelOpen: false, panelTab: 'files', sidebarOpen: true, auth: null
});

const uid = () => crypto.randomUUID();

export function toast(kind: Toast['kind'], text: string) {
  const t = { id: uid(), kind, text };
  store.set((s) => ({ toasts: [...s.toasts, t].slice(-4) }));
  setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), kind === 'error' ? 8000 : 4000);
}
export const guard = async <T,>(p: Promise<T>): Promise<T | undefined> => { try { return await p; } catch (e) { toast('error', errMsg(e)); return undefined; } };

export function applyTheme(theme: Settings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export async function refreshAll() {
  const [settings, permissions, providers, workspaces, convList, system, info] = await Promise.all([
    api.settings.get(), api.perm.get(), api.provider.list(), api.ws.list(), api.conv.list(), api.system.status(), api.system.info()
  ]);
  applyTheme(settings!.theme);
  store.set({ settings: settings!, permissions: permissions!, providers: providers!, workspaces: workspaces!, convList: convList!, system: system!, info: info!, workspaceId: store.get().workspaceId ?? workspaces![0]?.id });
}

const UI_KEY = 'it7.ui.v1';
function loadUi(): { page?: string; workspaceId?: string; submode?: CodeSubmode; caps?: TaskCaps; panelOpen?: boolean; panelTab?: PanelTab; sidebarOpen?: boolean } {
  try { return JSON.parse(localStorage.getItem(UI_KEY) ?? '{}'); } catch { return {}; }
}

let off: (() => void) | undefined;
export async function init() {
  await refreshAll();
  // Pemulihan sesi: halaman, workspace, dan sub-mode terakhir (konvensi per-perangkat, bukan data penting).
  const ui = loadUi();
  const ws = store.get().workspaces;
  store.set({
    // 'web'/'control' adalah mode lama; sekarang menjadi kemampuan di dalam Code.
    page: ui.page === 'web' || ui.page === 'control' ? 'code' : ['chat', 'code', 'permissions', 'history', 'settings'].includes(ui.page ?? '') ? (ui.page as Page) : 'chat',
    caps: { web: !!ui.caps?.web, computer: !!ui.caps?.computer },
    panelOpen: !!ui.panelOpen, panelTab: ui.panelTab ?? 'files', sidebarOpen: ui.sidebarOpen !== false,
    submode: ui.submode && ['plan', 'edit', 'agent'].includes(ui.submode) ? ui.submode : 'agent',
    workspaceId: ws.some((w) => w.id === ui.workspaceId) ? ui.workspaceId : ws[0]?.id
  });
  store.subscribe(() => {
    const { page, workspaceId, submode, caps, panelOpen, panelTab, sidebarOpen } = store.get();
    try { localStorage.setItem(UI_KEY, JSON.stringify({ page, workspaceId, submode, caps, panelOpen, panelTab, sidebarOpen })); } catch { /* penyimpanan tidak tersedia */ }
  });
  const tasks = await api.task.list();
  store.set({ tasks: Object.fromEntries((tasks ?? []).map((t) => [t.id, t])), taskConv: Object.fromEntries((tasks ?? []).filter((t) => t.conversationId).map((t) => [t.id, t.conversationId!])), ready: true });
  off?.();
  off = api.onAgentEvent((e) => handleEvent(e as AgentEvent));
  const auth = await api.auth.status();
  store.set({ auth: auth ?? { status: 'none' } });
  if (auth?.status === 'user') void syncHistory(true);
  if (store.get().info?.crashed) toast('info', 'Aplikasi dipulihkan setelah penutupan tidak normal. Percakapan Anda aman; task yang berjalan sebelumnya tidak dilanjutkan.');
  const last = (await api.conv.list())?.[0];
  if (last) {
    const keep = store.get().page;
    await openConversation(last.id);
    store.set({ page: keep }); // openConversation dapat berpindah halaman; pulihkan pilihan pengguna
  }
}

function pushTimeline(ev: TimelineEvent) {
  store.set((s) => {
    const list = s.timelines[ev.taskId] ?? [];
    if (list.some((x) => x.id === ev.id)) return {};
    return { timelines: { ...s.timelines, [ev.taskId]: [...list, ev].slice(-500) } };
  });
}

async function appendAssistant(taskId: string, content: string, messageId: string, at: number) {
  const convId = store.get().taskConv[taskId];
  if (!convId) return;
  const msg: ChatMessage = { id: messageId, role: 'assistant', content, createdAt: at, taskId };
  const s = store.get();
  if (s.conv?.id === convId) {
    const conv = { ...s.conv, messages: [...s.conv.messages.filter((m) => m.id !== messageId), msg], updatedAt: Date.now() };
    store.set({ conv });
    await api.conv.save(conv);
  } else {
    const c = await api.conv.get({ id: convId });
    if (c) await api.conv.save({ ...c, messages: [...c.messages, msg], updatedAt: Date.now() });
  }
  store.set({ convList: (await api.conv.list()) ?? [] });
}

export function handleEvent(e: AgentEvent) {
  switch (e.type) {
    case 'task': store.set((s) => ({ tasks: { ...s.tasks, [e.task.id]: e.task }, taskConv: e.task.conversationId ? { ...s.taskConv, [e.task.id]: e.task.conversationId } : s.taskConv })); break;
    case 'timeline': pushTimeline(e.event); break;
    case 'text_delta': store.set((s) => ({ streams: { ...s.streams, [e.messageId]: { taskId: e.taskId, content: (s.streams[e.messageId]?.content ?? '') + e.delta } } })); break;
    case 'text_done': {
      store.set((s) => { const { [e.messageId]: _x, ...rest } = s.streams; return { streams: rest }; });
      void appendAssistant(e.taskId, e.content, e.messageId, e.at ?? Date.now());
      break;
    }
    case 'plan': store.set((s) => ({ plans: { ...s.plans, [e.taskId]: e.steps } })); break;
    case 'approval': store.set((s) => ({ approvals: [...s.approvals, e.request] })); break;
    case 'approval_resolved': store.set((s) => ({ approvals: s.approvals.filter((a) => a.id !== e.id) })); break;
    case 'target': store.set({ target: { x: e.x, y: e.y, action: e.action, width: e.width, height: e.height, at: Date.now() } }); break;
    case 'frame': store.set({ frame: { dataUrl: e.dataUrl, width: e.width, height: e.height, at: e.at } }); break;
    case 'browser_frame': store.set((s) => ({ browserFrame: e.dataUrl, ...(s.browserFrame ? {} : { panelOpen: true, panelTab: 'browser' as PanelTab }) })); break;
    case 'capture_status': store.set({ capture: { active: e.active, reason: e.reason } }); break;
  }
}

export async function syncHistory(silent = false) {
  try {
    const r = await api.history.sync();
    store.set({ convList: (await api.conv.list()) ?? [] });
    if (!silent) toast('success', `Riwayat disinkronkan (${r?.pulled ?? 0} diterima, ${r?.pushed ?? 0} dikirim)`);
  } catch (e) { toast('error', errMsg(e)); }
}
/** Dipanggil setelah login berhasil: perbarui status, daftar percakapan, dan pesan sinkron. */
export async function onSignedIn(state: AuthState, syncError?: string) {
  store.set({ auth: state, conv: null });
  store.set({ convList: (await api.conv.list()) ?? [] });
  if (syncError) toast('error', syncError);
  else toast('success', state.profile?.provider === 'guest' ? 'Mode tamu' : `Masuk sebagai ${state.profile?.display_name ?? state.email ?? 'akun'}`);
}

export function setPage(page: Page) { store.set({ page }); }

export async function openConversation(id: string) {
  const c = await guard(api.conv.get({ id }));
  if (c) store.set({ conv: c, page: c.mode === 'chat' ? 'chat' : 'code' });
}
export function newConversation(mode: 'chat' | 'code') {
  store.set({ conv: null, page: mode });
}
export const isCodeConv = (m: AgentMode) => m !== 'chat';
export async function deleteConversation(id: string) {
  await guard(api.conv.remove({ id }));
  if (store.get().conv?.id === id) store.set({ conv: null });
  store.set({ convList: (await api.conv.list()) ?? [] });
}
export async function renameConversation(id: string, title: string) {
  const c = await api.conv.get({ id });
  if (c) { await api.conv.save({ ...c, title: title.slice(0, 120) }); if (store.get().conv?.id === id) store.set({ conv: { ...c, title } }); store.set({ convList: (await api.conv.list()) ?? [] }); }
}

export function activeTaskFor(convId?: string): TaskSummary | undefined {
  const s = store.get();
  return Object.values(s.tasks).filter((t) => (!convId || s.taskConv[t.id] === convId) && ['running', 'paused', 'waiting_approval'].includes(t.status)).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function send(mode: AgentMode, text: string, attachments: Attachment[] = []) {
  const s = store.get();
  const prompt = text.trim();
  if (!prompt) return;
  if (activeTaskFor(s.conv?.id)) { toast('info', 'Masih ada task berjalan di percakapan ini. Hentikan atau tunggu selesai.'); return; }
  const now = Date.now();
  let conv = s.conv && isCodeConv(s.conv.mode) === isCodeConv(mode) ? s.conv : null;
  if (!conv) conv = { id: uid(), title: prompt.slice(0, 48), mode, workspaceId: s.workspaceId, messages: [], createdAt: now, updatedAt: now };
  const history = conv.messages.filter((m) => m.role !== 'system').slice(-30).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 20000) }));
  const userMsg: ChatMessage = { id: uid(), role: 'user', content: prompt, createdAt: now, attachments: attachments.map(({ name, mime, size }) => ({ name, mime, size })) };
  conv = { ...conv, messages: [...conv.messages, userMsg], updatedAt: now };
  store.set({ conv });
  await api.conv.save(conv);
  const input: TaskStartInput = { mode, prompt, conversationId: conv.id, workspaceId: mode === 'chat' ? undefined : s.workspaceId, history, attachments, ...(mode === 'code' ? { submode: s.submode, capabilities: s.caps } : {}) };
  const task = await guard(api.task.start(input));
  if (task) {
    store.set((st) => ({ taskConv: { ...st.taskConv, [task.id]: conv!.id }, tasks: { ...st.tasks, [task.id]: task } }));
    if (task.caps?.computer) store.set({ panelOpen: true, panelTab: 'screen' });
    const marked = { ...conv, messages: conv.messages.map((m) => (m.id === userMsg.id ? { ...m, taskId: task.id } : m)) };
    if (store.get().conv?.id === marked.id) store.set({ conv: { ...store.get().conv!, messages: store.get().conv!.messages.map((m) => (m.id === userMsg.id ? { ...m, taskId: task.id } : m)) } });
    await api.conv.save(marked);
  }
  store.set({ convList: (await api.conv.list()) ?? [] });
}

export const stopTask = (id: string) => guard(api.task.stop({ id }));
export const pauseTask = (id: string) => guard(api.task.pause({ id }));
export const resumeTask = (id: string) => guard(api.task.resume({ id }));
export const stopAll = async () => { await guard(api.task.stopAll()); toast('info', 'Semua tugas AI dihentikan.'); };
export const respondApproval = (id: string, approved: boolean, remember = false) => guard(api.perm.respond({ id, approved, remember }));

export async function updatePermissions(patch: Parameters<typeof api.perm.set>[0]) {
  const p = await guard(api.perm.set(patch));
  if (p) store.set({ permissions: p });
  return p;
}
export async function updateSettings(patch: Partial<Settings>) {
  const st = await guard(api.settings.set(patch));
  if (st) { store.set({ settings: st }); applyTheme(st.theme); }
}
