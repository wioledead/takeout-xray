/// <reference lib="webworker" />
import * as duckdb from '@duckdb/duckdb-wasm';
import type {
  ExportFormat,
  IngestionProgress,
  NormalizedEvent,
  NormalizedThread,
} from '../types/domain';
import type { WorkerRequest, WorkerResponse } from '../types/rpc';
import { generateDemoDataset } from '../utils/demoGenerators';
import { parseChatGptStream } from './adapters/chatgpt';
import { parseChromeStream } from './adapters/chrome';
import { detectFileFormat, UnsupportedFormatError } from './adapters/detector';
import { parseTelegramStream } from './adapters/telegram';
import { XRayEngine, type DuckDBBackend, type DuckDBTableLike } from './engine';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let connInstance: duckdb.AsyncDuckDBConnection | null = null;
let engineInstance: XRayEngine | null = null;
let initPromise: Promise<XRayEngine> | null = null;

async function createBrowserDuckDBEngine(): Promise<XRayEngine> {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  if (!bundle.mainWorker) {
    throw new Error('DuckDB-Wasm bundle did not provide a mainWorker URL.');
  }

  const workerBlob = new Blob([`importScripts(${JSON.stringify(bundle.mainWorker)});`], {
    type: 'text/javascript',
  });
  const workerUrl = URL.createObjectURL(workerBlob);
  const innerWorker = new Worker(workerUrl);

  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), innerWorker);
  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  } finally {
    URL.revokeObjectURL(workerUrl);
  }

  const conn = await db.connect();
  dbInstance = db;
  connInstance = conn;

  const backend: DuckDBBackend = {
    async registerFileText(name: string, text: string) {
      await db.registerFileText(name, text);
    },
    async dropFile(name: string) {
      await db.dropFile(name);
    },
    async query(sql: string) {
      const table = await conn.query(sql);
      return table as unknown as DuckDBTableLike;
    },
  };

  const engine = new XRayEngine(backend);
  await engine.init();
  engineInstance = engine;
  return engine;
}

async function ensureEngine(): Promise<XRayEngine> {
  if (engineInstance) return engineInstance;
  if (!initPromise) {
    initPromise = createBrowserDuckDBEngine().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

function postProgress(progress: IngestionProgress): void {
  const msg: WorkerResponse = {
    id: 'progress',
    type: 'PROGRESS_EVENT',
    progress,
  };
  self.postMessage(msg);
}

async function ingestFileInWorker(
  engine: XRayEngine,
  file: File,
  tzOffsetMs: number,
): Promise<{ format: ExportFormat; snapshot: Awaited<ReturnType<XRayEngine['getDashboardSnapshot']>> }> {
  const startTime = performance.now();
  const totalBytes = file.size;

  postProgress({
    phase: 'detecting',
    bytesRead: 0,
    totalBytes,
    rowsIngested: 0,
    threadsFound: 0,
    elapsedMs: 0,
  });

  const format = await detectFileFormat(file);
  await engine.resetSession(format);

  let rowsIngested = 0;
  let threadsFound = 0;
  let latestBytes = 0;
  let lastProgressEmit = 0;

  const emitProgress = (phase: IngestionProgress['phase'], force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressEmit < 120) return;
    lastProgressEmit = now;
    postProgress({
      phase,
      format,
      bytesRead: latestBytes,
      totalBytes,
      rowsIngested,
      threadsFound,
      elapsedMs: Math.round(now - startTime),
    });
  };

  const onBatch = async (threads: NormalizedThread[], events: NormalizedEvent[]) => {
    await engine.ingestBatch(threads, events);
    threadsFound += threads.length;
    rowsIngested += events.length;
    emitProgress('streaming', true);
  };

  const onProgress = (bytesRead: number) => {
    latestBytes = bytesRead;
    emitProgress('streaming', false);
  };

  const stream = file.stream();

  if (format === 'tg_chat' || format === 'tg_account') {
    await parseTelegramStream({ stream, totalBytes, batchSize: 5000, onBatch, onProgress }, format);
  } else if (format === 'chatgpt') {
    await parseChatGptStream({ stream, totalBytes, batchSize: 5000, onBatch, onProgress });
  } else {
    await parseChromeStream({ stream, totalBytes, batchSize: 5000, onBatch, onProgress });
  }

  latestBytes = totalBytes;
  emitProgress('indexing', true);

  const snapshot = await engine.getDashboardSnapshot('ALL', tzOffsetMs);
  emitProgress('ready', true);

  return { format, snapshot };
}

async function loadDemoInWorker(
  engine: XRayEngine,
  demo: 'telegram' | 'chatgpt' | 'chrome',
  tzOffsetMs: number,
) {
  const startTime = performance.now();
  const dataset = generateDemoDataset(demo);
  const totalEvents = dataset.events.length;

  await engine.resetSession(dataset.format);
  postProgress({
    phase: 'streaming',
    format: dataset.format,
    bytesRead: 0,
    totalBytes: totalEvents,
    rowsIngested: 0,
    threadsFound: dataset.threads.length,
    elapsedMs: 0,
  });

  const batchSize = 5000;
  for (let i = 0; i < dataset.events.length; i += batchSize) {
    const eventSlice = dataset.events.slice(i, i + batchSize);
    const threadSlice = i === 0 ? dataset.threads : [];
    await engine.ingestBatch(threadSlice, eventSlice);

    postProgress({
      phase: 'streaming',
      format: dataset.format,
      bytesRead: Math.min(i + eventSlice.length, totalEvents),
      totalBytes: totalEvents,
      rowsIngested: Math.min(i + eventSlice.length, totalEvents),
      threadsFound: dataset.threads.length,
      elapsedMs: Math.round(performance.now() - startTime),
    });
  }

  if (dataset.events.length === 0 && dataset.threads.length > 0) {
    await engine.ingestBatch(dataset.threads, []);
  }

  postProgress({
    phase: 'indexing',
    format: dataset.format,
    bytesRead: totalEvents,
    totalBytes: totalEvents,
    rowsIngested: totalEvents,
    threadsFound: dataset.threads.length,
    elapsedMs: Math.round(performance.now() - startTime),
  });

  const snapshot = await engine.getDashboardSnapshot('ALL', tzOffsetMs);
  postProgress({
    phase: 'ready',
    format: dataset.format,
    bytesRead: totalEvents,
    totalBytes: totalEvents,
    rowsIngested: totalEvents,
    threadsFound: dataset.threads.length,
    elapsedMs: Math.round(performance.now() - startTime),
  });

  return { format: dataset.format, snapshot };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    const engine = await ensureEngine();

    switch (req.type) {
      case 'INIT': {
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'INIT',
          payload: { ready: true },
        };
        self.postMessage(res);
        return;
      }
      case 'INGEST_FILE': {
        const payload = await ingestFileInWorker(engine, req.file, req.tzOffsetMs);
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'INGEST_FILE',
          payload,
        };
        self.postMessage(res);
        return;
      }
      case 'LOAD_DEMO': {
        const payload = await loadDemoInWorker(engine, req.demo, req.tzOffsetMs);
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'LOAD_DEMO',
          payload,
        };
        self.postMessage(res);
        return;
      }
      case 'GET_DASHBOARD': {
        const snapshot = await engine.getDashboardSnapshot(req.threadId, req.tzOffsetMs);
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'GET_DASHBOARD',
          payload: { snapshot },
        };
        self.postMessage(res);
        return;
      }
      case 'RUN_SQL': {
        const result = await engine.runSql(req.sql);
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'RUN_SQL',
          payload: { result },
        };
        self.postMessage(res);
        return;
      }
      case 'RESET': {
        await engine.resetSession();
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'RESET',
          payload: { ok: true },
        };
        self.postMessage(res);
        return;
      }
    }
  } catch (err) {
    const code = err instanceof UnsupportedFormatError ? err.code : 'WORKER_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    const res: WorkerResponse = {
      id: req.id,
      type: 'RPC_ERROR',
      code,
      message,
    };
    self.postMessage(res);
  }
};

export { dbInstance, connInstance };
