import type { EventKind, ExportFormat, NormalizedEvent } from '../../types/domain';
import {
  countQuestions,
  countWords,
  extractEmojis,
  extractFirstDomain,
  hasCodeBlock,
} from '../../utils/textAnalysis';

export interface SimpleBatchBuffer<T> {
  push(item: T): void;
  flushIfReady(): Promise<void>;
  flushAll(): Promise<void>;
}

/** Buffers rows into fixed-size batches before writing into DuckDB-Wasm. */
export function createSimpleBatchBuffer<T>(
  batchSize: number,
  onBatch: (items: T[]) => Promise<void> | void,
): SimpleBatchBuffer<T> {
  let pending: T[] = [];
  return {
    push(item: T) {
      pending.push(item);
    },
    async flushIfReady() {
      while (pending.length >= batchSize) {
        await onBatch(pending.splice(0, batchSize));
      }
    },
    async flushAll() {
      while (pending.length > 0) {
        await onBatch(pending.splice(0, batchSize));
      }
    },
  };
}

/**
 * Streams UTF-8 text lines across arbitrary chunk boundaries without retaining
 * the whole file in memory.
 */
export async function forEachStreamLine(
  stream: ReadableStream<Uint8Array>,
  totalBytes: number,
  onLine: (line: string, isTrailingPartial: boolean) => Promise<void> | void,
  onProgress?: (bytesRead: number) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let carry = '';
  let bytesRead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const trailing = decoder.decode();
        if (trailing) {
          carry += trailing;
        }
        let nlPos = carry.indexOf('\n');
        while (nlPos !== -1) {
          await onLine(carry.slice(0, nlPos), false);
          carry = carry.slice(nlPos + 1);
          nlPos = carry.indexOf('\n');
        }
        if (carry.length > 0) {
          await onLine(carry, true);
          carry = '';
        }
        onProgress?.(totalBytes);
        break;
      }

      if (value && value.byteLength > 0) {
        bytesRead += value.byteLength;
        carry += decoder.decode(value, { stream: true });
        let nlPos = carry.indexOf('\n');
        while (nlPos !== -1) {
          await onLine(carry.slice(0, nlPos), false);
          carry = carry.slice(nlPos + 1);
          nlPos = carry.indexOf('\n');
        }
        onProgress?.(totalBytes > 0 ? Math.min(bytesRead, totalBytes) : bytesRead);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface BuildEventInput {
  eventId: string;
  threadId: string;
  sourceType: ExportFormat;
  eventKind: EventKind;
  tsMs: number;
  senderId: string;
  senderName: string;
  textContent: string;
  hasMedia?: boolean;
  directUrlForDomain?: string;
  metaSubtype?: string | null;
}

/** Normalizes text/domain/emoji/code metrics uniformly across adapters. */
export function buildNormalizedEvent(input: BuildEventInput): NormalizedEvent {
  const text = input.textContent;
  return {
    event_id: input.eventId,
    thread_id: input.threadId,
    source_type: input.sourceType,
    event_kind: input.eventKind,
    ts_ms: input.tsMs,
    sender_id: input.senderId,
    sender_name: input.senderName,
    text_content: text,
    char_count: text.length,
    word_count: countWords(text),
    question_count: countQuestions(text),
    has_code: input.eventKind === 'message' ? hasCodeBlock(text) : false,
    has_media: Boolean(input.hasMedia),
    emojis: extractEmojis(text),
    domain: input.directUrlForDomain
      ? extractFirstDomain(input.directUrlForDomain, true)
      : extractFirstDomain(text, false),
    meta_subtype: input.metaSubtype ?? null,
  };
}

/** Deterministic FNV-1a 32-bit hex hash for stable IDs across runs. */
export function stableShortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Extracts text array/string payloads uniformly from multi-block AI message payloads. */
export function extractTextFromBlocks(raw: unknown): {
  text: string;
  thinkingChars: number;
  toolNames: string[];
  hasMedia: boolean;
} {
  if (typeof raw === 'string') {
    return { text: raw, thinkingChars: 0, toolNames: [], hasMedia: false };
  }
  if (!Array.isArray(raw)) {
    return { text: '', thinkingChars: 0, toolNames: [], hasMedia: false };
  }

  const textParts: string[] = [];
  let thinkingChars = 0;
  const toolNames: string[] = [];
  let hasMedia = false;

  for (const block of raw) {
    if (typeof block === 'string') {
      if (block) textParts.push(block);
      continue;
    }
    if (!block || typeof block !== 'object') continue;
    const obj = block as Record<string, unknown>;
    const type = typeof obj.type === 'string' ? obj.type : '';

    if (type === 'thinking') {
      const th = typeof obj.thinking === 'string' ? obj.thinking : typeof obj.text === 'string' ? obj.text : '';
      thinkingChars += th.length;
    } else if (type === 'tool_use') {
      if (typeof obj.name === 'string' && obj.name.trim()) {
        toolNames.push(obj.name.trim());
      }
    } else if (type === 'image' || obj.imageUrl) {
      hasMedia = true;
    } else if (typeof obj.text === 'string' && obj.text) {
      textParts.push(obj.text);
    }
  }

  return {
    text: textParts.join('\n'),
    thinkingChars,
    toolNames,
    hasMedia,
  };
}
