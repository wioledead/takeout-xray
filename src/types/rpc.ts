import type {
  DashboardSnapshot,
  DemoKind,
  ExportFormat,
  IngestionProgress,
  SqlQueryResult,
} from './domain';

export interface IngestFileEntry {
  file: File;
  relativePath?: string;
  zipEntryPath?: string;
  zipEntrySize?: number;
}

export type WorkerRequest =
  | { id: string; type: 'INIT' }
  | { id: string; type: 'INGEST_FILE'; file: File; tzOffsetMs: number; timeZone?: string }
  | { id: string; type: 'INGEST_FILES'; entries: IngestFileEntry[]; tzOffsetMs: number; timeZone?: string }
  | { id: string; type: 'LOAD_DEMO'; demo: DemoKind; tzOffsetMs: number; timeZone?: string }
  | { id: string; type: 'GET_DASHBOARD'; threadId: string; tzOffsetMs: number; timeZone?: string }
  | { id: string; type: 'RUN_SQL'; sql: string }
  | { id: string; type: 'RESET' };

export type WorkerPayloadMap = {
  INIT: { ready: true };
  INGEST_FILE: { format: ExportFormat; snapshot: DashboardSnapshot };
  INGEST_FILES: { format: ExportFormat; snapshot: DashboardSnapshot };
  LOAD_DEMO: { format: ExportFormat; snapshot: DashboardSnapshot };
  GET_DASHBOARD: { snapshot: DashboardSnapshot };
  RUN_SQL: { result: SqlQueryResult };
  RESET: { ok: true };
};

export type WorkerResponse =
  | {
      id: string;
      type: 'RPC_SUCCESS';
      requestType: WorkerRequest['type'];
      payload: WorkerPayloadMap[WorkerRequest['type']];
    }
  | {
      id: string;
      type: 'RPC_ERROR';
      code: string;
      message: string;
    }
  | {
      id: string;
      type: 'PROGRESS_EVENT';
      progress: IngestionProgress;
    }
  | {
      type: 'NETWORK_EVENT';
      kind: 'fetch' | 'xhr';
      url: string;
      bytesSent: number;
    };
