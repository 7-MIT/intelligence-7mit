import type { ApprovalRequest, PermissionKind, PermissionState, Risk } from '@shared/types';
import { DEFAULT_PERMISSIONS, PERMISSION_KINDS } from '@shared/types';
import type { AuditLogger } from './audit';
import type { ApprovalBroker } from './approvals';
import { isInside } from './paths';

export interface AuthRequest {
  tool: string;
  kind: PermissionKind;
  risk: Risk;
  summary: string;
  detail?: string;
  /** true bila tindakan hanya mengamati (tidak mengubah apa pun). */
  readOnly: boolean;
  actor: 'agent' | 'user';
  taskId?: string;
  /** Alasan pemblokiran keras (tidak bisa disetujui). */
  blocked?: string;
  /** Workspace tempat tindakan berjalan, untuk Auto Execute. */
  workspacePath?: string;
  /** Konten tak tepercaya dengan pola injection telah terbaca dalam task ini. */
  tainted?: boolean;
}

export type Decision =
  | { allowed: true; by: 'policy' | 'user' | 'task-allowance' }
  | { allowed: false; code: 'not_granted' | 'readonly' | 'blocked' | 'rejected'; reason: string };

export interface PermissionPersistence {
  load(): PermissionState | undefined;
  save(state: PermissionState): void;
}

const RISK_ORDER: Risk[] = ['low', 'medium', 'high', 'critical'];
const rank = (r: Risk) => RISK_ORDER.indexOf(r);

/**
 * Satu-satunya gerbang menuju efek samping pada OS. Semua tool agen wajib lewat authorize().
 */
export class PermissionManager {
  private state: PermissionState;
  private taskAllowances = new Map<string, Set<string>>();
  private listeners = new Set<(s: PermissionState) => void>();

  constructor(
    private persistence: PermissionPersistence,
    private audit: AuditLogger,
    private broker: ApprovalBroker
  ) {
    const saved = persistence.load();
    this.state = {
      ...DEFAULT_PERMISSIONS,
      ...saved,
      grants: { ...DEFAULT_PERMISSIONS.grants, ...(saved?.grants ?? {}) }
    };
  }

  getState(): PermissionState {
    return structuredClone(this.state);
  }

  onChange(fn: (s: PermissionState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(patch: Partial<Omit<PermissionState, 'grants'>> & { grants?: Partial<Record<PermissionKind, boolean>> }): PermissionState {
    const before = this.state;
    // Nilai undefined tidak boleh menimpa state yang ada.
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as typeof patch;
    const next: PermissionState = {
      ...before,
      ...defined,
      grants: { ...before.grants, ...(patch.grants ?? {}) }
    };
    this.state = next;
    for (const k of PERMISSION_KINDS) {
      if (before.grants[k] !== next.grants[k]) {
        this.audit.log({ actor: 'user', tool: 'permission', kind: k, decision: 'ok', summary: `Izin "${k}" ${next.grants[k] ? 'diberikan' : 'dicabut'}` });
        if (!next.grants[k]) this.broker.rejectAll();
      }
    }
    if (before.mode !== next.mode) this.audit.log({ actor: 'user', tool: 'permission', decision: 'ok', summary: `Mode eksekusi: ${before.mode} → ${next.mode}` });
    this.persistence.save(next);
    this.listeners.forEach((l) => l(this.getState()));
    return this.getState();
  }

  clearTask(taskId: string): void {
    this.taskAllowances.delete(taskId);
  }

  isAutoWorkspace(p?: string): boolean {
    return !!p && this.state.autoWorkspaces.some((w) => isInside(w, p));
  }

  async authorize(req: AuthRequest, signal?: AbortSignal): Promise<Decision> {
    const log = (decision: 'allowed' | 'approved' | 'denied' | 'rejected') =>
      this.audit.log({ actor: req.actor, taskId: req.taskId, tool: req.tool, kind: req.kind, risk: req.risk, decision, summary: req.summary, detail: req.detail });

    if (req.blocked) {
      log('denied');
      return { allowed: false, code: 'blocked', reason: `Diblokir oleh kebijakan keamanan: ${req.blocked}` };
    }
    if (!this.state.grants[req.kind]) {
      log('denied');
      return { allowed: false, code: 'not_granted', reason: `Izin "${req.kind}" belum diberikan. Aktifkan di Permission Center.` };
    }
    if (this.state.mode === 'readonly' && !req.readOnly && req.actor === 'agent') {
      log('denied');
      return { allowed: false, code: 'readonly', reason: 'Mode Read Only aktif: AI tidak boleh melakukan tindakan yang mengubah sesuatu.' };
    }

    const mode = this.state.mode;
    let needsApproval: boolean;
    if (req.readOnly && !req.tainted) {
      needsApproval = false;
    } else if (req.actor === 'user') {
      needsApproval = rank(req.risk) >= rank('high');
    } else if (rank(req.risk) >= rank('high')) {
      needsApproval = true; // tindakan destruktif/berisiko tinggi selalu meminta konfirmasi
    } else if (mode === 'auto' && !req.tainted && req.risk === 'low' && this.isAutoWorkspace(req.workspacePath)) {
      needsApproval = false;
    } else {
      needsApproval = true;
    }

    if (!needsApproval) {
      log('allowed');
      return { allowed: true, by: 'policy' };
    }

    if (req.taskId && !req.tainted && rank(req.risk) <= rank('medium') && this.taskAllowances.get(req.taskId)?.has(req.tool)) {
      log('allowed');
      return { allowed: true, by: 'task-allowance' };
    }

    const { approved, remember } = await this.broker.request(
      { taskId: req.taskId, tool: req.tool, kind: req.kind, risk: req.risk, summary: req.summary, detail: req.detail } satisfies Omit<ApprovalRequest, 'id' | 'createdAt'>,
      signal
    );
    if (!approved) {
      log('rejected');
      return { allowed: false, code: 'rejected', reason: 'Pengguna menolak tindakan ini.' };
    }
    if (remember && req.taskId && !req.tainted && rank(req.risk) <= rank('medium')) {
      const set = this.taskAllowances.get(req.taskId) ?? new Set();
      set.add(req.tool);
      this.taskAllowances.set(req.taskId, set);
    }
    log('approved');
    return { allowed: true, by: 'user' };
  }
}
