import type {
  EventKind,
  NormalizedAntigravityStep,
  NormalizedThread,
} from '../../types/domain';
import {
  buildNormalizedEvent,
  createSimpleBatchBuffer,
  extractTextFromBlocks,
  forEachStreamLine,
  stableShortHash,
} from './streamHelpers';
import { createBatchCollector, type StreamAdapterOptions } from './streamRunner';

export interface ClaudeCodeParseOptions extends StreamAdapterOptions {
  /** Optional file path hint (e.g. `~/.claude/projects/<proj>/<uuid>.jsonl`) for deterministic thread naming. */
  sessionHint?: string;
  onStepBatch?: (steps: NormalizedAntigravityStep[]) => Promise<void> | void;
}

interface RawClaudeCodeUsage {
  input_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  output_tokens?: unknown;
}

interface RawClaudeCodeRecord {
  type?: unknown;
  uuid?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
  isCompactSummary?: unknown;
  isApiErrorMessage?: unknown;
  summary?: unknown;
  message?: {
    id?: unknown;
    role?: unknown;
    content?: unknown;
    usage?: RawClaudeCodeUsage;
  };
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SYSTEM_REMINDER_RE = /<system-reminder>[\s\S]*?<\/system-reminder>/gi;
const COMMAND_TAG_RE = /<(?:local-command-stdout|command-message|command-name)>[\s\S]*?<\/(?:local-command-stdout|command-message|command-name)>/gi;

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

function parseIsoMs(raw: unknown, fallbackMs: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return fallbackMs > 0 ? fallbackMs : Date.now();
}

function deriveSessionMeta(sessionHint = ''): { threadId: string; shortId: string } {
  const uuidMatch = sessionHint.match(UUID_RE);
  if (uuidMatch) {
    const uuid = uuidMatch[0].toLowerCase();
    return { threadId: `cc_${uuid}`, shortId: uuid.slice(0, 8) };
  }
  const shortId = stableShortHash(sessionHint.trim() || 'claude_code_session');
  return { threadId: `cc_${shortId}`, shortId };
}

function cleanUserPromptText(rawText: string): string {
  return rawText
    .replace(SYSTEM_REMINDER_RE, ' ')
    .replace(COMMAND_TAG_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasOnlyToolResults(content: unknown): boolean {
  if (!Array.isArray(content) || content.length === 0) return false;
  let sawToolResult = false;
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    const type = String((item as Record<string, unknown>).type || '');
    if (type === 'tool_result') {
      sawToolResult = true;
    } else if (type === 'text' && typeof (item as Record<string, unknown>).text === 'string') {
      if ((item as Record<string, unknown>).text) {
        return false;
      }
    }
  }
  return sawToolResult;
}

/**
 * Streams Claude Code CLI `~/.claude/projects/<project>/<session>.jsonl` transcripts.
 * Deduplicates streaming API turn fragments that share identical `message.id` usage payloads,
 * and populates `antigravity_steps` using shared step types so Agent Telemetry works identically.
 */
export async function parseClaudeCodeStream(options: ClaudeCodeParseOptions): Promise<void> {
  const batchSize = options.batchSize ?? 5000;
  const collector = createBatchCollector(batchSize, options.onBatch);
  const stepBuffer = createSimpleBatchBuffer<NormalizedAntigravityStep>(
    batchSize,
    async (steps) => {
      if (options.onStepBatch && steps.length > 0) {
        await options.onStepBatch(steps);
      }
    },
  );

  const { threadId, shortId } = deriveSessionMeta(options.sessionHint);
  const seenUsageMessageIds = new Set<string>();

  let lineIndex = 0;
  let lastTsMs = 0;
  let checkpointCount = 0;
  let firstUserPrompt = '';
  let observedSessionSlug = shortId;

  await forEachStreamLine(
    options.stream,
    options.totalBytes,
    async (rawLine, isTrailingPartial) => {
      const line = rawLine.replace(/^\uFEFF/, '').trim();
      if (!line) return;

      let raw: RawClaudeCodeRecord;
      try {
        raw = JSON.parse(line) as RawClaudeCodeRecord;
      } catch (err) {
        if (isTrailingPartial && lineIndex > 0) {
          return;
        }
        throw err instanceof Error ? err : new Error(String(err));
      }

      if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') {
        return;
      }

      const recType = raw.type.trim();
      if (typeof raw.sessionId === 'string' && raw.sessionId.trim()) {
        observedSessionSlug = raw.sessionId.trim().slice(0, 8);
      }

      const rowSeq = lineIndex++;
      const tsMs = parseIsoMs(raw.timestamp, lastTsMs);
      if (tsMs > 0) {
        lastTsMs = tsMs;
      }

      const msgContent = raw.message?.content;
      const blocks = extractTextFromBlocks(msgContent);

      let stepType = 'GENERIC';
      let eventKind: EventKind = 'service';
      let senderId = 'system';
      let senderName = 'System';
      let textContent = '';
      let replyChars = 0;
      let metaSubtype: string = recType;

      if (recType === 'summary' || raw.isCompactSummary) {
        stepType = 'CHECKPOINT';
        checkpointCount++;
        metaSubtype = 'checkpoint';
        if (typeof raw.summary === 'string' && raw.summary.trim() && !firstUserPrompt) {
          firstUserPrompt = raw.summary.trim();
        }
      } else if (raw.isApiErrorMessage) {
        stepType = 'ERROR_MESSAGE';
        senderId = 'claude_code';
        senderName = 'Claude Code';
        metaSubtype = 'error';
      } else if (recType === 'user') {
        const cleaned = cleanUserPromptText(blocks.text);
        const toolResultTurn = hasOnlyToolResults(msgContent);

        if (!toolResultTurn && cleaned.length > 0) {
          stepType = 'USER_INPUT';
          eventKind = 'message';
          senderId = 'user';
          senderName = 'User';
          textContent = cleaned;
          metaSubtype = 'user';
          if (!firstUserPrompt) {
            firstUserPrompt = cleaned;
          }
        } else {
          stepType = 'GENERIC';
          eventKind = 'service';
          senderId = 'claude_code';
          senderName = 'Claude Code';
          metaSubtype = 'tool_result';
        }
      } else if (recType === 'assistant') {
        stepType = 'PLANNER_RESPONSE';
        senderId = 'claude_code';
        senderName = 'Claude Code';
        const cleanedReply = blocks.text.trim();
        replyChars = cleanedReply.length;
        if (replyChars > 0) {
          eventKind = 'message';
          textContent = cleanedReply;
          metaSubtype = 'assistant';
        } else {
          eventKind = 'service';
          metaSubtype = blocks.toolNames.length > 0 ? 'tool_turn' : 'planner_service';
        }
      } else {
        // `system`, `progress`, `queue-operation` remain lightweight service telemetry
        stepType = 'GENERIC';
        eventKind = 'service';
      }

      let inputTokens = 0;
      let cacheReadTokens = 0;
      let outputTokens = 0;
      const usage = raw.message?.usage;
      if (usage && typeof usage === 'object') {
        const msgId = typeof raw.message?.id === 'string' ? raw.message.id : '';
        if (!msgId || !seenUsageMessageIds.has(msgId)) {
          if (msgId) seenUsageMessageIds.add(msgId);
          inputTokens =
            toNonNegInt(usage.input_tokens) + toNonNegInt(usage.cache_creation_input_tokens);
          cacheReadTokens = toNonNegInt(usage.cache_read_input_tokens);
          outputTokens = toNonNegInt(usage.output_tokens);
        }
      }

      const event = buildNormalizedEvent({
        eventId: `${threadId}:e:${rowSeq}`,
        threadId,
        sourceType: 'claude_code',
        eventKind,
        tsMs,
        senderId,
        senderName,
        textContent,
        hasMedia: blocks.hasMedia,
        metaSubtype,
      });

      const step: NormalizedAntigravityStep = {
        step_id: `${threadId}:s:${rowSeq}`,
        thread_id: threadId,
        step_index: rowSeq,
        step_type: stepType,
        ts_ms: tsMs,
        input_tokens: inputTokens,
        cache_read_tokens: cacheReadTokens,
        output_tokens: outputTokens,
        thinking_chars: blocks.thinkingChars,
        reply_chars: replyChars,
        tool_call_count: blocks.toolNames.length,
        tool_names: blocks.toolNames,
      };

      collector.pushEvent(event);
      if (options.onStepBatch) {
        stepBuffer.push(step);
      }

      await collector.flushIfReady();
      await stepBuffer.flushIfReady();
    },
    options.onProgress,
  );

  if (lineIndex > 0) {
    const cleanPreview = firstUserPrompt
      ? firstUserPrompt.replace(/\s+/g, ' ').trim().slice(0, 56) +
        (firstUserPrompt.length > 56 ? '…' : '')
      : 'Claude Code Session';
    const thread: NormalizedThread = {
      thread_id: threadId,
      source_type: 'claude_code',
      title: `[${observedSessionSlug}] ${cleanPreview}`,
      thread_kind: 'antigravity_session',
      extra_count: checkpointCount,
    };
    collector.pushThread(thread);
  }

  await collector.flushAll();
  await stepBuffer.flushAll();
}
