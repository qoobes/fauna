import { and, eq, inArray, lt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { scans as scansTable } from '@/lib/db/schema';
import { env } from '@/env';
import type { ScanConfig, ScanResult, ScanStatus, SSEEvent, PageResult } from '@/types/scan';
import { computeCriticalCount } from './scorer';

type Subscriber = (eventId: number, event: SSEEvent) => void;

interface ScanState {
  config: ScanConfig;
  status: ScanStatus;
  result: ScanResult;
  abortController: AbortController;
  eventBuffer: SSEEvent[];
  subscribers: Set<Subscriber>;
  startedAt: Date;
  eventCounter: number;
  ownerId: string;
  ownerEmail: string;
}

type ScanRunner = (scanId: string) => Promise<void>;

const MAX_MEM_SCANS = 100;

class ScanManager {
  private store = new Map<string, ScanState>();
  private queue: string[] = [];
  private running = 0;
  private runner: ScanRunner | null = null;
  private reconciled = false;

  // The crawler injects its runner to avoid circular imports.
  setRunner(fn: ScanRunner) {
    this.runner = fn;
  }

  async reconcileOnce() {
    if (this.reconciled) return;
    this.reconciled = true;
    try {
      // Only reconcile scans that are older than 60s — anything younger might have
      // just been inserted by the current POST handler but not yet enqueued here.
      const staleThreshold = new Date(Date.now() - 60_000);
      await db
        .update(scansTable)
        .set({
          status: 'error',
          errorMessage: 'Interrupted by server restart',
          completedAt: new Date(),
        })
        .where(
          and(
            inArray(scansTable.status, ['running', 'queued']),
            lt(scansTable.createdAt, staleThreshold),
          ),
        );
    } catch (err) {
      console.error('[scanManager] reconcile failed:', err);
    }
  }

  async enqueue(
    scanId: string,
    config: ScanConfig,
    owner: { id: string; email: string },
  ) {
    await this.reconcileOnce();

    const startedAt = new Date();
    const result: ScanResult = {
      scanId,
      url: config.url,
      status: 'queued',
      config,
      startedAt: startedAt.toISOString(),
      overallScore: 0,
      totalPages: 0,
      totalIssues: 0,
      pages: [],
    };

    this.store.set(scanId, {
      config,
      status: 'queued',
      result,
      abortController: new AbortController(),
      eventBuffer: [],
      subscribers: new Set(),
      startedAt,
      eventCounter: 0,
      ownerId: owner.id,
      ownerEmail: owner.email,
    });

    this.evictIfOverCapacity();
    this.emit(scanId, { type: 'scan-queued', position: this.queue.length + 1 });
    this.queue.push(scanId);
    void this.pump();
  }

  private evictIfOverCapacity() {
    if (this.store.size <= MAX_MEM_SCANS) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, state] of this.store) {
      if (state.status === 'running' || state.status === 'queued') continue;
      if (state.subscribers.size > 0) continue;
      if (state.startedAt.getTime() < oldestTime) {
        oldestTime = state.startedAt.getTime();
        oldestKey = key;
      }
    }
    if (oldestKey) this.store.delete(oldestKey);
  }

  private async pump() {
    if (!this.runner) return;
    while (this.running < env.MAX_CONCURRENT_SCANS && this.queue.length > 0) {
      const id = this.queue.shift()!;
      const state = this.store.get(id);
      if (!state) continue;
      if (state.abortController.signal.aborted) continue;

      this.running++;
      state.status = 'running';
      state.result.status = 'running';
      state.result.startedAt = new Date().toISOString();

      try {
        await db
          .update(scansTable)
          .set({ status: 'running', startedAt: new Date() })
          .where(eq(scansTable.id, id));
      } catch (err) {
        console.error('[scanManager] failed to mark running:', err);
      }

      this.runner(id)
        .catch((err) => {
          console.error(`[scanManager] scan ${id} fatal:`, err);
          this.emit(id, {
            type: 'scan-error',
            scanId: id,
            error: err instanceof Error ? err.message : String(err),
          });
          this.setStatus(id, 'error').catch(() => {});
        })
        .finally(() => {
          this.running--;
          void this.pump();
        });
    }
  }

  getScan(scanId: string): ScanState | null {
    return this.store.get(scanId) ?? null;
  }

  getAbortSignal(scanId: string): AbortSignal | null {
    return this.store.get(scanId)?.abortController.signal ?? null;
  }

  async cancel(scanId: string) {
    const state = this.store.get(scanId);
    if (!state) return;
    state.abortController.abort();
    state.status = 'cancelled';
    state.result.status = 'cancelled';
    this.queue = this.queue.filter((id) => id !== scanId);
    try {
      await db
        .update(scansTable)
        .set({ status: 'cancelled', completedAt: new Date() })
        .where(eq(scansTable.id, scanId));
    } catch (err) {
      console.error('[scanManager] failed to persist cancel:', err);
    }
  }

  async setStatus(scanId: string, status: ScanStatus, errorMessage?: string) {
    const state = this.store.get(scanId);
    if (state) {
      state.status = status;
      state.result.status = status;
    }
    try {
      const update: Record<string, unknown> = { status };
      if (errorMessage !== undefined) update.errorMessage = errorMessage;
      if (status === 'complete' || status === 'error' || status === 'cancelled') {
        update.completedAt = new Date();
      }
      await db.update(scansTable).set(update).where(eq(scansTable.id, scanId));
    } catch (err) {
      console.error('[scanManager] failed to persist status:', err);
    }
  }

  pushPageResult(scanId: string, pageResult: PageResult) {
    const state = this.store.get(scanId);
    if (!state) return;
    state.result.pages.push(pageResult);
    state.result.totalPages = state.result.pages.length;
    state.result.totalIssues = state.result.pages.reduce(
      (sum, p) => sum + p.axeViolations.length + (p.aiIssues?.length ?? 0),
      0,
    );
    const successScores = state.result.pages
      .filter((p) => p.status === 'success')
      .map((p) => p.score);
    state.result.overallScore = successScores.length
      ? Math.round(successScores.reduce((a, b) => a + b, 0) / successScores.length)
      : 0;
  }

  async persistProgress(scanId: string) {
    const state = this.store.get(scanId);
    if (!state) return;
    try {
      await db
        .update(scansTable)
        .set({
          overallScore: state.result.overallScore,
          totalPages: state.result.totalPages,
          totalIssues: state.result.totalIssues,
          criticalCount: computeCriticalCount(state.result.pages),
          result: state.result,
        })
        .where(eq(scansTable.id, scanId));
    } catch (err) {
      console.error('[scanManager] persistProgress failed:', err);
    }
  }

  async finalize(scanId: string, final: Partial<ScanResult>) {
    const state = this.store.get(scanId);
    if (!state) return;
    Object.assign(state.result, final);
    state.status = state.result.status;
    try {
      await db
        .update(scansTable)
        .set({
          status: state.result.status,
          overallScore: state.result.overallScore,
          totalPages: state.result.totalPages,
          totalIssues: state.result.totalIssues,
          criticalCount: computeCriticalCount(state.result.pages),
          result: state.result,
          errorMessage: state.result.status === 'complete' ? null : undefined,
          completedAt: new Date(),
        })
        .where(eq(scansTable.id, scanId));
    } catch (err) {
      console.error('[scanManager] finalize failed:', err);
    }
    // Free memory after a short grace period so late SSE reconnects still get the buffer
    setTimeout(() => {
      const s = this.store.get(scanId);
      if (s && s.subscribers.size === 0) this.store.delete(scanId);
    }, 60_000);
  }

  emit(scanId: string, event: SSEEvent) {
    const state = this.store.get(scanId);
    if (!state) return;
    state.eventBuffer.push(event);
    const eventId = state.eventCounter++;
    for (const sub of state.subscribers) {
      try {
        sub(eventId, event);
      } catch (err) {
        console.error('[scanManager] subscriber error:', err);
      }
    }
  }

  subscribe(scanId: string, cb: Subscriber): () => void {
    const state = this.store.get(scanId);
    if (!state) return () => {};
    state.subscribers.add(cb);
    return () => {
      state.subscribers.delete(cb);
    };
  }

  getEventBuffer(scanId: string): SSEEvent[] {
    return this.store.get(scanId)?.eventBuffer ?? [];
  }
}

// Module-level singleton — in Next.js dev mode, the module is re-evaluated on file changes,
// so we attach it to globalThis to survive HMR.
declare global {
  // eslint-disable-next-line no-var
  var __faunaScanManager: ScanManager | undefined;
}

export const scanManager: ScanManager =
  globalThis.__faunaScanManager ?? (globalThis.__faunaScanManager = new ScanManager());
