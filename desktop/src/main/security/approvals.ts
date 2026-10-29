import { randomUUID } from 'node:crypto';
import type { ApprovalRequest } from '@shared/types';

interface Pending {
  req: ApprovalRequest;
  resolve: (r: { approved: boolean; remember: boolean }) => void;
}

/** Menunggu keputusan pengguna. Satu-satunya jalan menuju "approved" adalah respond() dari UI. */
export class ApprovalBroker {
  private pending = new Map<string, Pending>();
  constructor(private emit: (type: 'request' | 'resolved', payload: ApprovalRequest | { id: string; approved: boolean }) => void) {}

  request(
    base: Omit<ApprovalRequest, 'id' | 'createdAt'>,
    signal?: AbortSignal
  ): Promise<{ approved: boolean; remember: boolean }> {
    const req: ApprovalRequest = { ...base, id: randomUUID(), createdAt: Date.now() };
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve({ approved: false, remember: false });
      const done = (r: { approved: boolean; remember: boolean }) => {
        if (!this.pending.delete(req.id)) return;
        signal?.removeEventListener('abort', onAbort);
        this.emit('resolved', { id: req.id, approved: r.approved });
        resolve(r);
      };
      const onAbort = () => done({ approved: false, remember: false });
      signal?.addEventListener('abort', onAbort, { once: true });
      this.pending.set(req.id, { req, resolve: done });
      this.emit('request', req);
    });
  }

  respond(id: string, approved: boolean, remember = false): boolean {
    const p = this.pending.get(id);
    if (!p) return false;
    p.resolve({ approved, remember });
    return true;
  }

  rejectAll(taskId?: string): void {
    for (const p of [...this.pending.values()]) {
      if (!taskId || p.req.taskId === taskId) p.resolve({ approved: false, remember: false });
    }
  }

  list(): ApprovalRequest[] {
    return [...this.pending.values()].map((p) => p.req);
  }
}
