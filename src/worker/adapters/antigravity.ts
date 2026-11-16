import type {
  EventKind,
  NormalizedAntigravityStep,
  NormalizedEvent,
  NormalizedThread,
} from '../../types/domain';
import {
  countQuestions,
  countWords,
  extractEmojis,
  extractFirstDomain,
  hasCodeBlock,
} from '../../utils/textAnalysis';
import { createBatchCollector, type StreamAdapterOptions } from './streamRunner';

interface RawAntigravityToolCall {
  name?: unknown;
}

interface RawAntigravityRecord {
  step_index?: unknown;
  source?: unknown;
  type?: unknown;
  status?: unknown;
  created_at?: unknown;
  content?: unknown;
  thinking?: unknown;
  tool_calls?: unknown;
  input_tokens?: unknown;
  cache_read_tokens?: unknown;
  output_tokens?: unknown;
  media?: unknown;
}

export interface AntigravityParseOptions extends StreamAdapterOptions {
  /** Optional relative path or session identifier used to derive thread_id and short label. */
  sessionHint?: string;
  onStepBatch?: (steps: NormalizedAntigravityStep[]) => Promise<void> | void;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const USER_REQUEST_BLOCK_RE = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/;
const TRAILING_METADATA_RE = /<(?:ADDITIONAL_METADATA|USER_SETTINGS_CHANGE|CONTEXT_SUMMARY)>[\s\S]*/;

function toNonNegInt(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, Math.trunc(val));
  }
  if (typeof val === 'string') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return 0;
}

function stableShortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Derives a deterministic thread identifier and compact short ID from a
 * dropped path like `<uuid>/.system_generated/logs/transcript_full.jsonl`.
 */
export function deriveAntigravitySessionMeta(sessionHint = ''): {
  threadId: string;
  shortId: string;
} {
  const uuidMatch = sessionHint.match(UUID_RE);
  if (uuidMatch) {
    const uuid = uuidMatch[0].toLowerCase();
    return {
      threadId: `ag_${uuid}`,
      shortId: uuid.slice(0, 8),
    };
  }

  const normalized = sessionHint.trim() || 'transcript.jsonl';
  const shortId = stableShortHash(normalized);
  return {
    threadId: `ag_${shortId}`,
    shortId,
  };
}

/**
 * Strips Antigravity runtime wrappers (`<ADDITIONAL_METADATA>`, `<USER_SETTINGS_CHANGE>`)
 * and extracts the inner `<USER_REQUEST>` body so vocabulary metrics reflect real prompts.
 */
export function cleanAntigravityUserPrompt(rawContent: string): string {
  if (!rawContent) return '';
  const reqMatch = rawContent.match(USER_REQUEST_BLOCK_RE);
  const base = reqMatch ? reqMatch[1] : rawContent.replace(TRAILING_METADATA_RE, '');
  return base.trim();
}

function formatThreadTitle(shortId: string, firstPrompt: string | null): string {
  if (!firstPrompt) {
    return `Antigravity [${shortId}]`;
  }
  const singleLine = firstPrompt.replace(/\s+/g, ' ').trim();
  if (!singleLine) {
    return `Antigravity [${shortId}]`;
  }
  const clipped = singleLine.length > 52 ? `${singleLine.slice(0, 51)}…` : singleLine;
  return `${shortId} · ${clipped}`;
}

function extractToolNames(rawToolCalls: unknown): string[] {
  if (!Array.isArray(rawToolCalls)) return [];
  const names: string[] = [];
  for (const item of rawToolCalls) {
    if (item && typeof item === 'object') {
      const name = (item as RawAntigravityToolCall).name;
      if (typeof name === 'string' && name.trim()) {
        names.push(name.trim());
      }
    }
  }
  return names;
}

function parseIsoTimestampMs(createdAt: unknown, fallbackMs: number): number {
  if (typeof createdAt === 'string' && createdAt) {
    const parsed = Date.parse(createdAt);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallbackMs;
}

/**
 * Streams newline-delimited Antigravity 2.0 `transcript.jsonl` / `transcript_full.jsonl`
 * data in UTF-8 byte chunks without loading the full file into memory.
 */
export async function parseAntigravityStream(options: AntigravityParseOptions): Promise<void> {
  const batchSize = options.batchSize ?? 5000;
  const collector = createBatchCollector(batchSize, options.onBatch);
  const { threadId, shortId } = deriveAntigravitySessionMeta(options.sessionHint);

  let pendingSteps: NormalizedAntigravityStep[] = [];
  const flushStepsIfReady = async (force = false) => {
    if (!options.onStepBatch) {
      pendingSteps = [];
      return;
    }
    while (pendingSteps.length >= batchSize || (force && pendingSteps.length > 0)) {
      const slice = pendingSteps.splice(0, batchSize);
      await options.onStepBatch(slice);
    }
  };

  let lastTsMs = 0;
  let lineIndex = 0;
  let checkpointCount = 0;
  let firstUserPrompt: string | null = null;
  let carry = '';
  let bytesRead = 0;

  const processLine = (rawLine: string, allowMalformedSkip: boolean) => {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (!line) return;

    let raw: RawAntigravityRecord;
    try {
      raw = JSON.parse(line) as RawAntigravityRecord;
    } catch (err) {
      if (allowMalformedSkip && lineIndex > 0) {
        return;
      }
      throw err instanceof Error ? err : new Error(String(err));
    }

    if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') {
      return;
    }

    const rowSeq = lineIndex++;
    const stepIndex = toNonNegInt(raw.step_index ?? rowSeq);
    const stepType = raw.type.trim() || 'UNKNOWN';
    const tsMs = parseIsoTimestampMs(raw.created_at, lastTsMs);
    if (tsMs > 0) {
      lastTsMs = tsMs;
    }

    const rawContent = typeof raw.content === 'string' ? raw.content : '';
    const thinkingText = typeof raw.thinking === 'string' ? raw.thinking : '';
    const toolNames = extractToolNames(raw.tool_calls);

    const isUser = stepType === 'USER_INPUT';
    const isPlanner = stepType === 'PLANNER_RESPONSE';
    if (stepType === 'CHECKPOINT') {
      checkpointCount++;
    }

    let senderId = 'system';
    let senderName = 'System';
    let eventKind: EventKind = 'service';
    let textContent = '';
    let metaSubtype = stepType.toLowerCase();

    if (isUser) {
      senderId = 'user';
      senderName = 'User';
      textContent = cleanAntigravityUserPrompt(rawContent);
      eventKind = textContent.length > 0 ? 'message' : 'service';
      metaSubtype = 'user';
      if (firstUserPrompt === null && textContent.length > 0) {
        firstUserPrompt = textContent;
      }
    } else if (isPlanner) {
      senderId = 'antigravity';
      senderName = 'Antigravity';
      const cleanedReply = rawContent.trim();
      if (cleanedReply.length > 0) {
        textContent = cleanedReply;
        eventKind = 'message';
        metaSubtype = 'assistant';
      } else {
        eventKind = 'service';
        metaSubtype = toolNames.length > 0 ? 'tool_turn' : 'planner_service';
      }
    } else if (stepType === 'GENERIC') {
      senderId = 'antigravity';
      senderName = 'Antigravity';
      eventKind = 'service';
      metaSubtype = 'tool_result';
    } else if (stepType === 'CHECKPOINT') {
      metaSubtype = 'checkpoint';
    } else if (stepType === 'ERROR_MESSAGE') {
      metaSubtype = 'error';
    }

    const normalizedEvent: NormalizedEvent = {
      event_id: `${threadId}:e:${rowSeq}`,
      thread_id: threadId,
      source_type: 'antigravity',
      event_kind: eventKind,
      ts_ms: tsMs,
      sender_id: senderId,
      sender_name: senderName,
      text_content: textContent,
      char_count: textContent.length,
      word_count: countWords(textContent),
      question_count: countQuestions(textContent),
      has_code: hasCodeBlock(textContent),
      has_media: Array.isArray(raw.media) && raw.media.length > 0,
      emojis: extractEmojis(textContent),
      domain: extractFirstDomain(textContent, false),
      meta_subtype: metaSubtype,
    };

    const stepRecord: NormalizedAntigravityStep = {
      step_id: `${threadId}:s:${rowSeq}`,
      thread_id: threadId,
      step_index: stepIndex,
      step_type: stepType,
      ts_ms: tsMs,
      input_tokens: toNonNegInt(raw.input_tokens),
      cache_read_tokens: toNonNegInt(raw.cache_read_tokens),
      output_tokens: toNonNegInt(raw.output_tokens),
      thinking_chars: thinkingText.length,
      reply_chars: isPlanner ? rawContent.trim().length : 0,
      tool_call_count: toolNames.length,
      tool_names: toolNames,
    };

    collector.pushEvent(normalizedEvent);
    if (options.onStepBatch) {
      pendingSteps.push(stepRecord);
    }
  };

  const drainLines = async () => {
    let nlPos = carry.indexOf('\n');
    while (nlPos !== -1) {
      const line = carry.slice(0, nlPos);
      carry = carry.slice(nlPos + 1);
      processLine(line, false);
      await collector.flushIfReady();
      await flushStepsIfReady(false);
      nlPos = carry.indexOf('\n');
    }
  };

  const reader = options.stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const trailing = decoder.decode();
        if (trailing) {
          carry += trailing;
          await drainLines();
        }
        if (carry.trim()) {
          // Tolerate a truncated trailing line when reading an active live transcript
          processLine(carry, true);
          carry = '';
        }
        break;
      }

      if (value && value.byteLength > 0) {
        bytesRead += value.byteLength;
        carry += decoder.decode(value, { stream: true });
        await drainLines();
        options.onProgress?.(Math.min(bytesRead, options.totalBytes));
      }
    }

    if (lineIndex > 0) {
      const thread: NormalizedThread = {
        thread_id: threadId,
        source_type: 'antigravity',
        title: formatThreadTitle(shortId, firstUserPrompt),
        thread_kind: 'antigravity_session',
        extra_count: checkpointCount,
      };
      collector.pushThread(thread);
    }

    await collector.flushAll();
    await flushStepsIfReady(true);
    options.onProgress?.(options.totalBytes);
  } finally {
    reader.releaseLock();
  }
}
