import { JSONParser, type ParsedElementInfo as ParsedElementInfoNs } from '@streamparser/json';
import type { NormalizedEvent, NormalizedThread } from '../../types/domain';

export type StreamParsedElement = ParsedElementInfoNs.ParsedElementInfo;

export interface StreamAdapterOptions {
  stream: ReadableStream<Uint8Array>;
  totalBytes: number;
  batchSize?: number;
  onBatch: (threads: NormalizedThread[], events: NormalizedEvent[]) => Promise<void> | void;
  onProgress?: (bytesRead: number) => void;
}

export interface BatchCollector {
  pushThread(thread: NormalizedThread): void;
  pushEvent(event: NormalizedEvent): void;
  flushIfReady(): Promise<void>;
  flushAll(): Promise<void>;
}

export function createBatchCollector(
  batchSize: number,
  onBatch: (threads: NormalizedThread[], events: NormalizedEvent[]) => Promise<void> | void,
): BatchCollector {
  let pendingThreads: NormalizedThread[] = [];
  let pendingEvents: NormalizedEvent[] = [];

  return {
    pushThread(thread: NormalizedThread) {
      pendingThreads.push(thread);
    },
    pushEvent(event: NormalizedEvent) {
      pendingEvents.push(event);
    },
    async flushIfReady() {
      while (pendingEvents.length >= batchSize || pendingThreads.length >= batchSize) {
        const eventSlice = pendingEvents.splice(0, batchSize);
        const threadSlice = pendingThreads.splice(0, batchSize);
        await onBatch(threadSlice, eventSlice);
      }
    },
    async flushAll() {
      while (pendingEvents.length > 0 || pendingThreads.length > 0) {
        const threadSlice = pendingThreads.splice(0, batchSize);
        const eventSlice = pendingEvents.splice(0, batchSize);
        await onBatch(threadSlice, eventSlice);
      }
    },
  };
}

export async function runStreamingJsonParser(
  options: StreamAdapterOptions,
  paths: string[],
  onElement: (info: StreamParsedElement, collector: BatchCollector) => void,
  onStreamFinished?: (collector: BatchCollector) => void,
): Promise<void> {
  const batchSize = options.batchSize ?? 5000;
  const collector = createBatchCollector(batchSize, options.onBatch);

  const parser = new JSONParser({
    paths,
    keepStack: false,
  });

  let parserError: Error | null = null;

  parser.onValue = (info) => {
    if (info.partial) return;
    onElement(info, collector);
  };

  parser.onError = (err) => {
    parserError = err;
  };

  const reader = options.stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const trailing = decoder.decode();
        if (trailing.length > 0 && !parser.isEnded) {
          parser.write(trailing);
        }
        break;
      }

      if (value && value.byteLength > 0) {
        bytesRead += value.byteLength;
        const decoded = decoder.decode(value, { stream: true });
        if (decoded.length > 0 && !parser.isEnded) {
          parser.write(decoded);
        }
        if (parserError) {
          throw parserError;
        }
        await collector.flushIfReady();
        options.onProgress?.(bytesRead);
      }
    }

    if (parserError) {
      throw parserError;
    }

    if (!parser.isEnded) {
      parser.end();
    }

    if (parserError) {
      throw parserError;
    }

    onStreamFinished?.(collector);
    await collector.flushAll();
  } finally {
    reader.releaseLock();
  }
}
