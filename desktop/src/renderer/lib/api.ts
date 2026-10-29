import type {
  Conversation, FileEntry, GitStatus, PermissionState, ProviderConfig, Settings, SystemStatus, TaskSummary, TimelineEvent, Workspace, AuditEntry
} from '@shared/types';
import type { TaskStartInput } from '@shared/ipc';

type Fn<A = void, R = unknown> = (arg?: A) => Promise<R>;
export interface AuthState { status: 'none' | 'guest' | 'user'; profile?: { display_name: string; provider: 'email' | 'akun7mit' | 'guest'; role?: string; account_type?: string }; email?: string; persisted?: boolean }
interface Api {
  auth: {
    status: Fn<void, AuthState>; signIn: Fn<{ email: string; password: string }, { state: AuthState; syncError?: string }>;
    signUp: Fn<{ email: string; password: string }, { signedIn: boolean; state: AuthState; syncError?: string }>; recover: Fn<{ email: string }>;
    sso: Fn<{ username: string; password: string; accountKey?: string }, { requiresSelection: boolean; accounts?: { account_key: string; display_name: string; account_type: string; role: string }[]; state: AuthState; syncError?: string }>;
    signOut: Fn<void, AuthState>; guest: Fn<void, AuthState>;
  };
  history: { sync: Fn<void, { pulled: number; pushed: number }> };
  settings: { get: Fn<void, Settings>; set: Fn<Partial<Settings>, Settings> };
  system: { status: Fn<void, SystemStatus>; info: Fn<void, { version: string; platform: string; arch: string; packaged: boolean; userData: string; crashed: boolean }>; openExternal(url: string): Promise<void>; checkUpdate: Fn<void, string> };
  perm: { get: Fn<void, PermissionState>; set: Fn<Partial<Omit<PermissionState, 'grants'>> & { grants?: Partial<PermissionState['grants']> }, PermissionState>; requestMac: Fn<void, { ok: boolean; message: string }>; respond: Fn<{ id: string; approved: boolean; remember?: boolean }, boolean> };
  provider: { list: Fn<void, ProviderConfig[]>; save: Fn<Record<string, unknown>, ProviderConfig>; remove: Fn<{ id: string }>; setKey: Fn<{ id: string; key: string }, { persisted: boolean }>; test: Fn<{ id: string }, Record<string, string>>; models: Fn<{ id: string }, string[]> };
  conv: { list: Fn<void, Omit<Conversation, 'messages'>[]>; get: Fn<{ id: string }, Conversation | null>; save: Fn<Conversation>; remove: Fn<{ id: string }>; search: Fn<{ query: string }, { id: string; title: string; snippet: string }[]> };
  ws: { list: Fn<void, Workspace[]>; add: Fn<{ name: string; path: string }, Workspace>; remove: Fn<{ id: string }>; pick: Fn<void, string | null> };
  task: { start: Fn<TaskStartInput, TaskSummary>; pause: Fn<{ id: string }>; resume: Fn<{ id: string }>; stop: Fn<{ id: string }>; stopAll: Fn; list: Fn<void, TaskSummary[]>; timeline: Fn<{ id: string }, TimelineEvent[]> };
  fs: { list: Fn<{ path: string }, FileEntry[]>; read: Fn<{ path: string }, { content: string; truncated: boolean; size: number }>; write: Fn<{ path: string; content: string }> };
  git: { status: Fn<{ workspaceId: string }, GitStatus>; diff: Fn<{ workspaceId: string; path?: string }, string>; commit: Fn<{ workspaceId: string; message: string }, string> };
  term: { start: Fn<{ workspaceId: string }, string>; write: Fn<{ id: string; data: string }, boolean>; kill: Fn<{ id: string }>; onData(cb: (p: { id: string; data: string }) => void): () => void };
  browser: { state: Fn<void, { open: boolean; tabs: { index: number; url: string; active: boolean }[] }>; navigate: Fn<{ url: string }, string>; close: Fn };
  audit: { list: Fn<void, AuditEntry[]>; export: Fn<void, { path: string; count: number } | null> };
  onAgentEvent(cb: (e: unknown) => void): () => void;
}

declare global { interface Window { it7: Api } }

export const api: Api = window.it7;

/** Pesan galat IPC Electron berbentuk "Error invoking remote method ...: Error: pesan". */
export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '').replace(/^Error: /, '');
}
