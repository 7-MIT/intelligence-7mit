// Tipe bersama antara main process, preload, dan renderer.

export type PermissionKind = 'screen' | 'input' | 'terminal' | 'filesystem' | 'browser' | 'apps';
export const PERMISSION_KINDS: PermissionKind[] = ['screen', 'input', 'terminal', 'filesystem', 'browser', 'apps'];

export type ExecutionMode = 'readonly' | 'ask' | 'auto';
export type Risk = 'low' | 'medium' | 'high' | 'critical';
export type AgentMode = 'chat' | 'code' | 'web' | 'control';
export type CodeSubmode = 'plan' | 'edit' | 'agent';
export type TaskStatus = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'stopped' | 'done' | 'error';

export interface PermissionState {
  grants: Record<PermissionKind, boolean>;
  mode: ExecutionMode;
  /** Folder yang boleh diakses agen. Kosong = tidak ada akses file/terminal. */
  allowedFolders: string[];
  /** Workspace yang disetujui untuk Auto Execute tindakan berisiko rendah. */
  autoWorkspaces: string[];
  /** Izin eksplisit mengirim screenshot ke penyedia AI. */
  allowScreenshotUpload: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  kind: 'openai' | 'intelligence7mit';
  baseUrl: string;
  model: string;
  supportsTools: boolean;
  supportsVision: boolean;
  hasKey: boolean;
}

export interface ProviderCapabilities {
  chat: boolean;
  tools: boolean;
  vision: boolean;
  reason?: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  attachments?: { name: string; mime: string; size: number }[];
  taskId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: AgentMode;
  workspaceId?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface PlanStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export interface ApprovalRequest {
  id: string;
  taskId?: string;
  tool: string;
  kind: PermissionKind;
  risk: Risk;
  summary: string;
  detail?: string;
  createdAt: number;
}

export type TimelineKind =
  | 'status'
  | 'plan'
  | 'tool_call'
  | 'tool_result'
  | 'approval'
  | 'permission'
  | 'warning'
  | 'error'
  | 'assistant';

export interface TimelineEvent {
  id: string;
  taskId: string;
  at: number;
  kind: TimelineKind;
  title: string;
  detail?: string;
  tool?: string;
  ok?: boolean;
  risk?: Risk;
}

export interface TaskCaps {
  /** Izinkan agen memakai browser terisolasi (Playwright). */
  web: boolean;
  /** Izinkan agen mengontrol komputer (screenshot, mouse, keyboard, jendela, aplikasi). */
  computer: boolean;
}

export interface TaskSummary {
  id: string;
  title: string;
  mode: AgentMode;
  status: TaskStatus;
  startedAt: number;
  endedAt?: number;
  steps: number;
  conversationId?: string;
  caps?: TaskCaps;
}

export type AgentEvent =
  | { type: 'task'; task: TaskSummary }
  | { type: 'timeline'; event: TimelineEvent }
  | { type: 'text_delta'; taskId: string; messageId: string; delta: string }
  | { type: 'text_done'; taskId: string; messageId: string; content: string; at?: number }
  | { type: 'plan'; taskId: string; steps: PlanStep[] }
  | { type: 'approval'; request: ApprovalRequest }
  | { type: 'approval_resolved'; id: string; approved: boolean }
  | { type: 'target'; taskId: string; x: number; y: number; action: string; width: number; height: number }
  | { type: 'frame'; dataUrl: string; width: number; height: number; at: number }
  | { type: 'browser_frame'; dataUrl: string }
  | { type: 'capture_status'; active: boolean; reason?: string };

export interface AuditEntry {
  at: number;
  taskId?: string;
  actor: 'agent' | 'user' | 'system';
  tool: string;
  kind?: PermissionKind;
  risk?: Risk;
  decision: 'allowed' | 'approved' | 'denied' | 'rejected' | 'error' | 'ok';
  summary: string;
  detail?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface GitStatus {
  isRepo: boolean;
  branch?: string;
  files: { path: string; status: string }[];
}

export interface SystemStatus {
  platform: string;
  arch: string;
  version: string;
  safeStorage: boolean;
  input: { available: boolean; reason?: string };
  screen: { available: boolean; reason?: string; macScreenStatus?: string; macAccessibility?: boolean };
  encryptionNote?: string;
}

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  language: 'id' | 'en';
  maxSteps: number;
  activeProviderId: string;
  globalShortcut: string;
  notifications: boolean;
  autoUpdate: boolean;
  controlPreviewFps: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'id',
  maxSteps: 40,
  activeProviderId: 'seven-mit',
  globalShortcut: 'CommandOrControl+Shift+Space',
  notifications: true,
  autoUpdate: true,
  controlPreviewFps: 1
};

export const DEFAULT_PERMISSIONS: PermissionState = {
  grants: { screen: false, input: false, terminal: false, filesystem: false, browser: false, apps: false },
  mode: 'ask',
  allowedFolders: [],
  autoWorkspaces: [],
  allowScreenshotUpload: false
};
