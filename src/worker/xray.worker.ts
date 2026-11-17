/// <reference lib="webworker" />
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbEhWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import duckdbMvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdbEhWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdbMvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import type {
  DemoKind,
  ExportFormat,
  IngestionProgress,
  NormalizedAntigravityStep,
  NormalizedEvent,
  NormalizedMediaEvent,
  NormalizedThread,
} from '../types/domain';
import type { IngestFileEntry, WorkerRequest, WorkerResponse } from '../types/rpc';
import { generateDemoDataset } from '../utils/demoGenerators';
import { withZipSessions, type ZipEntryStreamConsumer } from '../utils/zipExtractor';
import { parseAntigravityStream } from './adapters/antigravity';
import { parseChatGptStream } from './adapters/chatgpt';
import { parseChromeStream } from './adapters/chrome';
import { parseClaudeAiStream } from './adapters/claudeAi';
import { parseClaudeCodeStream } from './adapters/claudeCode';
import {
  detectAndWrapStream,
  detectFileFormat,
  UnsupportedFormatError,
} from './adapters/detector';
import { parseDiscordStream } from './adapters/discord';
import { parseSpotifyStream } from './adapters/spotify';
import { parseTelegramStream } from './adapters/telegram';
import { parseTikTokStream } from './adapters/tiktok';
import { parseTwitterStream } from './adapters/twitter';
import { parseWhatsAppStream } from './adapters/whatsapp';
import { parseYouTubeStream } from './adapters/youtube';
import { XRayEngine, type DuckDBBackend, type DuckDBTableLike } from './engine';

const MULTI_FILE_FORMATS = new Set<ExportFormat>([
  'antigravity',
  'claude_code',
  'discord',
  'spotify',
  'twitter',
]);

const DISCORD_INDEX_RE = /(?:^|[\\/])messages[\\/]index\.json$/i;

class SkippedZipEntryError extends Error {
  constructor() {
    super('Skipped mismatched archive entry');
  }
}

let engineInstance: XRayEngine | null = null;
let initPromise: Promise<XRayEngine> | null = null;

function isLocalWorkerUrl(rawUrl: string): boolean {
  if (!rawUrl || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:') || rawUrl.startsWith('/')) {
    return true;
  }
  try {
    const parsed = new URL(rawUrl, self.location.href);
    return parsed.origin === self.location.origin;
  } catch {
    return true;
  }
}

function measureWorkerBodyBytes(body: unknown): number {
  if (!body) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return new TextEncoder().encode(body.toString()).byteLength;
  }
  return 0;
}

function installWorkerNetworkGuard(): void {
  if (typeof self.fetch === 'function') {
    const origFetch = self.fetch.bind(self);
    self.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const bytesSent = measureWorkerBodyBytes(init?.body);
      if (!isLocalWorkerUrl(url)) {
        const msg: WorkerResponse = { type: 'NETWORK_EVENT', kind: 'fetch', url, bytesSent };
        self.postMessage(msg);
        throw new Error(`Blocked non-local worker fetch: ${url}`);
      }
      return origFetch(input, init);
    };
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    const urlMap = new WeakMap<XMLHttpRequest, string>();

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      urlMap.set(this, typeof url === 'string' ? url : url.href);
      return origOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const url = urlMap.get(this) ?? 'unknown';
      const bytesSent = measureWorkerBodyBytes(body);
      if (!isLocalWorkerUrl(url)) {
        const msg: WorkerResponse = { type: 'NETWORK_EVENT', kind: 'xhr', url, bytesSent };
        self.postMessage(msg);
        throw new Error(`Blocked non-local worker XHR: ${url}`);
      }
      return origSend.call(this, body as XMLHttpRequestBodyInit | null | undefined);
    };
  }
}

installWorkerNetworkGuard();

async function createBrowserDuckDBEngine(): Promise<XRayEngine> {
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: duckdbMvpWasm, mainWorker: duckdbMvpWorker },
    eh: { mainModule: duckdbEhWasm, mainWorker: duckdbEhWorker },
  });

  if (!bundle.mainWorker) {
    throw new Error('DuckDB-Wasm bundle did not provide a mainWorker URL.');
  }

  const innerWorker = new Worker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), innerWorker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const conn = await db.connect();

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

function getEntryByteSize(entry: IngestFileEntry): number {
  return entry.zipEntrySize ?? entry.file.size;
}

async function readDiscordChannelMap(
  indexEntries: IngestFileEntry[],
  withZipEntry: ZipEntryStreamConsumer,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const entry of indexEntries) {
    try {
      const rawText = entry.zipEntryPath
        ? await withZipEntry(entry.file, entry.zipEntryPath, (stream) =>
            new Response(stream).text(),
          )
        : await entry.file.text();
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) {
            map[k] = v.trim();
          }
        }
      }
    } catch {
      // Ignore malformed optional index sidecars
    }
  }
  return map;
}

interface AdapterDispatchCallbacks {
  onBatch: (threads: NormalizedThread[], events: NormalizedEvent[]) => Promise<void>;
  onStepBatch: (steps: NormalizedAntigravityStep[]) => Promise<void>;
  onMediaBatch: (media: NormalizedMediaEvent[]) => Promise<void>;
  onProgress: (bytesRead: number) => void;
  discordChannelMap: Record<string, string>;
}

async function runAdapterForFormat(
  format: ExportFormat,
  stream: ReadableStream<Uint8Array>,
  totalBytes: number,
  entry: IngestFileEntry,
  callbacks: AdapterDispatchCallbacks,
): Promise<void> {
  const hint = entry.relativePath || entry.file.name;
  const baseOpts = {
    stream,
    totalBytes,
    batchSize: 5000,
    onBatch: callbacks.onBatch,
    onProgress: callbacks.onProgress,
  };

  switch (format) {
    case 'antigravity':
      await parseAntigravityStream({
        ...baseOpts,
        sessionHint: hint,
        onStepBatch: callbacks.onStepBatch,
      });
      return;
    case 'claude_code':
      await parseClaudeCodeStream({
        ...baseOpts,
        sessionHint: hint,
        onStepBatch: callbacks.onStepBatch,
      });
      return;
    case 'tg_chat':
    case 'tg_account':
      await parseTelegramStream(baseOpts, format);
      return;
    case 'chatgpt':
      await parseChatGptStream(baseOpts);
      return;
    case 'claude_ai':
      await parseClaudeAiStream(baseOpts);
      return;
    case 'whatsapp':
      await parseWhatsAppStream({
        ...baseOpts,
        chatTitle: hint,
      });
      return;
    case 'discord':
      await parseDiscordStream({
        ...baseOpts,
        channelIdHint: hint,
        channelTitleMap: callbacks.discordChannelMap,
      });
      return;
    case 'spotify':
      await parseSpotifyStream({
        ...baseOpts,
        sessionHint: hint,
        onMediaBatch: callbacks.onMediaBatch,
      });
      return;
    case 'youtube':
      await parseYouTubeStream({
        ...baseOpts,
        sessionHint: hint,
        onMediaBatch: callbacks.onMediaBatch,
      });
      return;
    case 'tiktok':
      await parseTikTokStream({
        ...baseOpts,
        sessionHint: hint,
        onMediaBatch: callbacks.onMediaBatch,
      });
      return;
    case 'twitter':
      await parseTwitterStream({
        ...baseOpts,
        sessionHint: hint,
        onMediaBatch: callbacks.onMediaBatch,
      });
      return;
    case 'chrome_history':
      await parseChromeStream(baseOpts);
      return;
  }
}

async function ingestEntriesInWorker(
  engine: XRayEngine,
  entries: IngestFileEntry[],
  tzOffsetMs: number,
  timeZone?: string,
): Promise<{ format: ExportFormat; snapshot: Awaited<ReturnType<XRayEngine['getDashboardSnapshot']>> }> {
  const startTime = performance.now();
  const nonEmptyEntries = entries.filter((e) => getEntryByteSize(e) > 0);
  if (nonEmptyEntries.length === 0) {
    throw new UnsupportedFormatError();
  }

  const indexEntries = nonEmptyEntries.filter((e) =>
    DISCORD_INDEX_RE.test(e.relativePath || e.file.name),
  );
  const candidateEntries = nonEmptyEntries.filter(
    (e) => !DISCORD_INDEX_RE.test(e.relativePath || e.file.name),
  );
  if (candidateEntries.length === 0) {
    throw new UnsupportedFormatError();
  }

  const totalBytes = candidateEntries.reduce((sum, e) => sum + getEntryByteSize(e), 0);

  postProgress({
    phase: 'detecting',
    bytesRead: 0,
    totalBytes,
    rowsIngested: 0,
    threadsFound: 0,
    elapsedMs: 0,
  });

  const zipFiles = nonEmptyEntries
    .filter((e) => Boolean(e.zipEntryPath))
    .map((e) => e.file);

  let detectedFormat: ExportFormat | null = null;
  let activeTotalBytes = totalBytes;
  let rowsIngested = 0;
  let threadsFound = 0;
  let completedBytes = 0;
  let currentFileBytes = 0;
  let lastProgressEmit = 0;

  const emitProgress = (phase: IngestionProgress['phase'], force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressEmit < 120) return;
    lastProgressEmit = now;
    postProgress({
      phase,
      format: detectedFormat ?? undefined,
      bytesRead: Math.min(completedBytes + currentFileBytes, activeTotalBytes),
      totalBytes: activeTotalBytes,
      rowsIngested,
      threadsFound,
      elapsedMs: Math.round(now - startTime),
    });
  };

  await withZipSessions(zipFiles, async (withZipEntry) => {
    const discordChannelMap =
      indexEntries.length > 0 ? await readDiscordChannelMap(indexEntries, withZipEntry) : {};

    const callbacks: AdapterDispatchCallbacks = {
      onBatch: async (threads, events) => {
        await engine.ingestBatch(threads, events);
        threadsFound += threads.length;
        rowsIngested += events.length;
        emitProgress('streaming', true);
      },
      onStepBatch: async (steps) => {
        await engine.ingestBatch([], [], steps);
      },
      onMediaBatch: async (media) => {
        await engine.ingestBatch([], [], [], media);
      },
      onProgress: (bytesRead) => {
        currentFileBytes = bytesRead;
        emitProgress('streaming', false);
      },
      discordChannelMap,
    };

    const hasZipEntries = candidateEntries.some((e) => Boolean(e.zipEntryPath));

    if (!hasZipEntries) {
      // Fast header-slice detection before resetting DuckDB or opening full file streams.
      const matchedEntries: Array<{ entry: IngestFileEntry; format: ExportFormat }> = [];
      for (const entry of candidateEntries) {
        try {
          const fmt = await detectFileFormat(entry.file);
          if (!detectedFormat) {
            detectedFormat = fmt;
          }
          if (fmt === detectedFormat) {
            matchedEntries.push({ entry, format: fmt });
          }
        } catch (err) {
          if (candidateEntries.length === 1 || !(err instanceof UnsupportedFormatError)) {
            throw err;
          }
        }
      }

      if (!detectedFormat || matchedEntries.length === 0) {
        throw new UnsupportedFormatError();
      }

      const entriesToProcess = MULTI_FILE_FORMATS.has(detectedFormat)
        ? matchedEntries
        : [matchedEntries[0]];
      activeTotalBytes = entriesToProcess.reduce((sum, item) => sum + getEntryByteSize(item.entry), 0);

      await engine.resetSession(detectedFormat);

      for (const { entry, format } of entriesToProcess) {
        currentFileBytes = 0;
        const totalFileBytes = entry.file.size;
        await runAdapterForFormat(format, entry.file.stream(), totalFileBytes, entry, callbacks);
        completedBytes += totalFileBytes;
        currentFileBytes = 0;
      }
    } else {
      // Single-pass streaming decompression directly from cached ZIP central directories.
      let sessionInitialized = false;

      for (const entry of candidateEntries) {
        if (sessionInitialized && detectedFormat && !MULTI_FILE_FORMATS.has(detectedFormat)) {
          break;
        }
        currentFileBytes = 0;
        const entrySize = getEntryByteSize(entry);

        try {
          if (entry.zipEntryPath) {
            await withZipEntry(entry.file, entry.zipEntryPath, async (rawStream, uncompressedBytes) => {
              const { format, replayStream } = await detectAndWrapStream(rawStream);
              if (!sessionInitialized) {
                detectedFormat = format;
                if (!MULTI_FILE_FORMATS.has(format)) {
                  activeTotalBytes = uncompressedBytes || entrySize;
                }
                await engine.resetSession(format);
                sessionInitialized = true;
              } else if (format !== detectedFormat) {
                throw new SkippedZipEntryError();
              }

              await runAdapterForFormat(
                format,
                replayStream,
                uncompressedBytes || entrySize,
                entry,
                callbacks,
              );
              completedBytes += uncompressedBytes || entrySize;
            });
          } else {
            const fmt = await detectFileFormat(entry.file);
            if (!sessionInitialized) {
              detectedFormat = fmt;
              if (!MULTI_FILE_FORMATS.has(fmt)) {
                activeTotalBytes = entrySize;
              }
              await engine.resetSession(fmt);
              sessionInitialized = true;
            } else if (fmt !== detectedFormat) {
              continue;
            }
            await runAdapterForFormat(fmt, entry.file.stream(), entry.file.size, entry, callbacks);
            completedBytes += entry.file.size;
          }
        } catch (err) {
          if (err instanceof SkippedZipEntryError) {
            continue;
          }
          if (candidateEntries.length > 1 && err instanceof UnsupportedFormatError) {
            continue;
          }
          throw err;
        } finally {
          currentFileBytes = 0;
        }
      }

      if (!detectedFormat || !sessionInitialized) {
        throw new UnsupportedFormatError();
      }
    }
  });

  if (!detectedFormat) {
    throw new UnsupportedFormatError();
  }

  emitProgress('indexing', true);

  const snapshot = await engine.getDashboardSnapshot('ALL', tzOffsetMs, timeZone);
  emitProgress('ready', true);

  return { format: detectedFormat, snapshot };
}

async function loadDemoInWorker(
  engine: XRayEngine,
  demo: DemoKind,
  tzOffsetMs: number,
  timeZone?: string,
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
  const steps = dataset.antigravitySteps ?? [];
  const media = dataset.mediaEvents ?? [];

  for (let i = 0; i < dataset.events.length; i += batchSize) {
    const eventSlice = dataset.events.slice(i, i + batchSize);
    const threadSlice = i === 0 ? dataset.threads : [];
    const stepSlice = steps.slice(i, i + batchSize);
    const mediaSlice = media.slice(i, i + batchSize);
    await engine.ingestBatch(threadSlice, eventSlice, stepSlice, mediaSlice);

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

  for (let i = dataset.events.length; i < steps.length; i += batchSize) {
    await engine.ingestBatch([], [], steps.slice(i, i + batchSize));
  }
  for (let i = dataset.events.length; i < media.length; i += batchSize) {
    await engine.ingestBatch([], [], [], media.slice(i, i + batchSize));
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

  const snapshot = await engine.getDashboardSnapshot('ALL', tzOffsetMs, timeZone);
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

async function handleWorkerRequest(req: WorkerRequest): Promise<void> {
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
        const payload = await ingestEntriesInWorker(
          engine,
          [{ file: req.file, relativePath: req.file.name }],
          req.tzOffsetMs,
          req.timeZone,
        );
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'INGEST_FILE',
          payload,
        };
        self.postMessage(res);
        return;
      }
      case 'INGEST_FILES': {
        const payload = await ingestEntriesInWorker(
          engine,
          req.entries,
          req.tzOffsetMs,
          req.timeZone,
        );
        const res: WorkerResponse = {
          id: req.id,
          type: 'RPC_SUCCESS',
          requestType: 'INGEST_FILES',
          payload,
        };
        self.postMessage(res);
        return;
      }
      case 'LOAD_DEMO': {
        const payload = await loadDemoInWorker(engine, req.demo, req.tzOffsetMs, req.timeZone);
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
        const snapshot = await engine.getDashboardSnapshot(
          req.threadId,
          req.tzOffsetMs,
          req.timeZone,
        );
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
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const code =
      err instanceof UnsupportedFormatError ? err.code : 'WORKER_EXECUTION_ERROR';

    const res: WorkerResponse = {
      id: req.id,
      type: 'RPC_ERROR',
      code,
      message: errorObj.message,
    };
    self.postMessage(res);
  }
}

let rpcQueue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  rpcQueue = rpcQueue
    .catch(() => {})
    .then(() => handleWorkerRequest(req));
};
