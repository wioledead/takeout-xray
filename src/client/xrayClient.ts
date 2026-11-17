import type {
  DashboardSnapshot,
  DemoKind,
  ExportFormat,
  IngestionProgress,
  SqlQueryResult,
} from '../types/domain';
import type { IngestFileEntry, WorkerPayloadMap, WorkerRequest, WorkerResponse } from '../types/rpc';
import { networkGuard } from '../utils/networkGuard';

interface PendingRpc {
  resolve: (payload: WorkerPayloadMap[WorkerRequest['type']]) => void;
  reject: (err: Error) => void;
}

export class WorkerRpcError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkerRpcError';
    this.code = code;
  }
}

export function getLocalTzOffsetMs(): number {
  return -new Date().getTimezoneOffset() * 60000;
}

export function getLocalTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export class XRayClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRpc>();
  private progressListeners = new Set<(progress: IngestionProgress) => void>();
  private reqCounter = 1;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('../worker/xray.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'PROGRESS_EVENT') {
        for (const listener of this.progressListeners) {
          listener(msg.progress);
        }
        return;
      }

      if (msg.type === 'NETWORK_EVENT') {
        networkGuard.recordWorkerEvent(msg.kind, msg.url, msg.bytesSent);
        return;
      }

      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);

      if (msg.type === 'RPC_ERROR') {
        pending.reject(new WorkerRpcError(msg.code, msg.message));
        return;
      }

      pending.resolve(msg.payload);
    };

    worker.onerror = (err) => {
      const error = new Error(err.message || 'Web Worker crashed');
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
    };

    this.worker = worker;
    return worker;
  }

  onProgress(listener: (progress: IngestionProgress) => void): () => void {
    this.progressListeners.add(listener);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private call<T extends WorkerRequest['type']>(
    request: Omit<Extract<WorkerRequest, { type: T }>, 'id'>,
  ): Promise<WorkerPayloadMap[T]> {
    const worker = this.ensureWorker();
    const id = `rpc_${this.reqCounter++}`;

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as PendingRpc['resolve'],
        reject,
      });
      worker.postMessage({ ...request, id });
    });
  }

  async init(): Promise<void> {
    await this.call<'INIT'>({ type: 'INIT' });
  }

  async ingestFile(file: File): Promise<{ format: ExportFormat; snapshot: DashboardSnapshot }> {
    return this.call<'INGEST_FILE'>({
      type: 'INGEST_FILE',
      file,
      tzOffsetMs: getLocalTzOffsetMs(),
      timeZone: getLocalTimeZone(),
    });
  }

  async ingestFiles(
    entries: IngestFileEntry[],
  ): Promise<{ format: ExportFormat; snapshot: DashboardSnapshot }> {
    if (entries.length === 1 && !entries[0].relativePath) {
      return this.ingestFile(entries[0].file);
    }
    return this.call<'INGEST_FILES'>({
      type: 'INGEST_FILES',
      entries,
      tzOffsetMs: getLocalTzOffsetMs(),
      timeZone: getLocalTimeZone(),
    });
  }

  async loadDemo(demo: DemoKind): Promise<{ format: ExportFormat; snapshot: DashboardSnapshot }> {
    return this.call<'LOAD_DEMO'>({
      type: 'LOAD_DEMO',
      demo,
      tzOffsetMs: getLocalTzOffsetMs(),
      timeZone: getLocalTimeZone(),
    });
  }

  async getDashboard(threadId: string): Promise<DashboardSnapshot> {
    const res = await this.call<'GET_DASHBOARD'>({
      type: 'GET_DASHBOARD',
      threadId,
      tzOffsetMs: getLocalTzOffsetMs(),
      timeZone: getLocalTimeZone(),
    });
    return res.snapshot;
  }

  async runSql(sql: string): Promise<SqlQueryResult> {
    const res = await this.call<'RUN_SQL'>({
      type: 'RUN_SQL',
      sql,
    });
    return res.result;
  }

  async reset(): Promise<void> {
    await this.call<'RESET'>({ type: 'RESET' });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
    this.progressListeners.clear();
  }
}

export const xrayClient = new XRayClient();
