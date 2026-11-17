import type { EventKind, NormalizedThread } from '../../types/domain';
import {
  buildNormalizedEvent,
  forEachStreamLine,
  stableShortHash,
} from './streamHelpers';
import { createBatchCollector, type StreamAdapterOptions } from './streamRunner';

export interface WhatsAppParseOptions extends StreamAdapterOptions {
  /** Optional file or chat name derived from the dropped `_chat.txt` / `WhatsApp Chat with ...txt` file. */
  chatTitle?: string;
}

type DateOrder = 'YMD' | 'DMY' | 'MDY';

interface RawWhatsAppDraft {
  p1: number;
  p2: number;
  p3: number;
  hour: number;
  min: number;
  sec: number;
  ampm: string;
  body: string;
}

const BIDI_MARKS_RE = /^[\uFEFF\u200E\u200F\u202A-\u202E]+/;
const INLINE_BIDI_RE = /[\u200E\u200F\u202A-\u202E]/g;
const IOS_HEADER_RE =
  /^\[(\d{1,4})([./-])(\d{1,2})\2(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp]\.?[Mm]\.?))?\]\s+([\s\S]*)$/;
const ANDROID_HEADER_RE =
  /^(\d{1,4})([./-])(\d{1,2})\2(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp]\.?[Mm]\.?))?\s+[-–—]\s+([\s\S]*)$/;

const MEDIA_OMITTED_RE =
  /<(?:Media omitted|Медиафайлы не включены|Multimedia omitted|Файл не прикреплен|Medien ausgeschlossen)>|(?:image|video|audio|sticker|GIF|document|Contact card)\s+omitted|<attached:\s*[^>]+>|\(file attached\)/i;

function tryResolveUnambiguousDateOrder(draft: RawWhatsAppDraft): DateOrder | null {
  if (draft.p1 > 999) return 'YMD';
  if (draft.p1 > 12) return 'DMY';
  if (draft.p2 > 12) return 'MDY';
  return null;
}

function resolveDateOrder(drafts: RawWhatsAppDraft[]): DateOrder {
  for (const d of drafts) {
    const order = tryResolveUnambiguousDateOrder(d);
    if (order !== null) return order;
  }
  return 'DMY';
}

function expandYear(rawYear: number): number {
  if (rawYear >= 100) return rawYear;
  return rawYear < 70 ? 2000 + rawYear : 1900 + rawYear;
}

function toTimestampMs(draft: RawWhatsAppDraft, order: DateOrder, fallbackMs: number): number {
  let year: number;
  let month: number;
  let day: number;

  if (order === 'YMD') {
    year = expandYear(draft.p1);
    month = draft.p2;
    day = draft.p3;
  } else if (order === 'MDY') {
    month = draft.p1;
    day = draft.p2;
    year = expandYear(draft.p3);
  } else {
    day = draft.p1;
    month = draft.p2;
    year = expandYear(draft.p3);
  }

  let hour24 = draft.hour;
  const ampm = draft.ampm.replace(/\./g, '').toUpperCase();
  if (ampm === 'PM' && hour24 < 12) hour24 += 12;
  else if (ampm === 'AM' && hour24 === 12) hour24 = 0;

  const safeFallback = fallbackMs > 0 ? fallbackMs + 1 : Date.now();
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour24 > 23 || draft.min > 59) {
    return safeFallback;
  }

  const ts = new Date(year, month - 1, day, hour24, draft.min, draft.sec).getTime();
  return Number.isFinite(ts) && ts > 0 ? ts : safeFallback;
}

function parseHeaderLine(cleanLine: string): RawWhatsAppDraft | null {
  const match = cleanLine.match(IOS_HEADER_RE) || cleanLine.match(ANDROID_HEADER_RE);
  if (!match) return null;

  return {
    p1: Number(match[1]),
    p2: Number(match[3]),
    p3: Number(match[4]),
    hour: Number(match[5]),
    min: Number(match[6]),
    sec: match[7] ? Number(match[7]) : 0,
    ampm: match[8] || '',
    body: (match[9] || '').replace(INLINE_BIDI_RE, ''),
  };
}

function deriveWhatsAppTitle(chatTitle?: string): string {
  if (!chatTitle) return 'WhatsApp Chat';
  const base = chatTitle
    .replace(/^.*[\\/]/, '')
    .replace(/\.txt$/i, '')
    .replace(/^WhatsApp Chat with\s+/i, '')
    .replace(/^Чат WhatsApp с\s+/i, '')
    .trim();
  if (!base || base === '_chat') return 'WhatsApp Chat';
  return base;
}

/**
 * Streams WhatsApp plain-text exports (`_chat.txt` iOS bracketed or Android dash-separated),
 * automatically inferring DMY vs MDY date ordering from the opening messages.
 */
export async function parseWhatsAppStream(options: WhatsAppParseOptions): Promise<void> {
  const collector = createBatchCollector(options.batchSize ?? 5000, options.onBatch);
  const title = deriveWhatsAppTitle(options.chatTitle);
  const threadId = `wa_${stableShortHash(options.chatTitle || title)}`;

  let resolvedOrder: DateOrder | null = null;
  const headerBuffer: RawWhatsAppDraft[] = [];
  let activeDraft: RawWhatsAppDraft | null = null;
  let seq = 0;
  let lastTsMs = 0;
  let mediaOmittedCount = 0;

  const emitDraft = (draft: RawWhatsAppDraft, order: DateOrder) => {
    const tsMs = toTimestampMs(draft, order, lastTsMs);
    if (tsMs > lastTsMs) {
      lastTsMs = tsMs;
    }

    const body = draft.body.trim();
    if (!body) return;

    const colonIdx = body.indexOf(': ');
    const isUrlBeforeColon = colonIdx > 0 && /^https?$/i.test(body.slice(0, colonIdx));

    let eventKind: EventKind = 'service';
    let senderId = 'system';
    let senderName = 'System';
    let textContent = body;
    let metaSubtype: string | null = 'system_notice';

    if (colonIdx > 0 && !isUrlBeforeColon) {
      eventKind = 'message';
      senderName = body.slice(0, colonIdx).trim() || 'Unknown';
      senderId = `wa_u_${stableShortHash(senderName)}`;
      textContent = body.slice(colonIdx + 2).trim();
      metaSubtype = null;
    }

    const hasMedia = MEDIA_OMITTED_RE.test(textContent);
    if (hasMedia) {
      mediaOmittedCount++;
    }

    const event = buildNormalizedEvent({
      eventId: `${threadId}_${seq++}`,
      threadId,
      sourceType: 'whatsapp',
      eventKind,
      tsMs,
      senderId,
      senderName,
      textContent,
      hasMedia,
      metaSubtype,
    });

    collector.pushEvent(event);
  };

  const finalizeDraft = async (draft: RawWhatsAppDraft) => {
    if (resolvedOrder !== null) {
      emitDraft(draft, resolvedOrder);
      await collector.flushIfReady();
      return;
    }

    headerBuffer.push(draft);
    const immediate = tryResolveUnambiguousDateOrder(draft);
    if (immediate !== null || headerBuffer.length >= 1000) {
      resolvedOrder = immediate ?? resolveDateOrder(headerBuffer);
      while (headerBuffer.length > 0) {
        emitDraft(headerBuffer.shift()!, resolvedOrder);
      }
      await collector.flushIfReady();
    }
  };

  await forEachStreamLine(
    options.stream,
    options.totalBytes,
    async (rawLine) => {
      const line = rawLine.replace(/\r$/, '').replace(BIDI_MARKS_RE, '');
      const parsed = parseHeaderLine(line);
      if (parsed) {
        if (activeDraft) {
          await finalizeDraft(activeDraft);
        }
        activeDraft = parsed;
      } else if (activeDraft) {
        const cleanContinuation = line.replace(INLINE_BIDI_RE, '');
        activeDraft.body = activeDraft.body
          ? `${activeDraft.body}\n${cleanContinuation}`
          : cleanContinuation;
      }
    },
    options.onProgress,
  );

  if (activeDraft) {
    await finalizeDraft(activeDraft);
  }

  if (headerBuffer.length > 0) {
    resolvedOrder = resolvedOrder ?? resolveDateOrder(headerBuffer);
    while (headerBuffer.length > 0) {
      emitDraft(headerBuffer.shift()!, resolvedOrder);
    }
  }

  if (seq > 0) {
    const thread: NormalizedThread = {
      thread_id: threadId,
      source_type: 'whatsapp',
      title,
      thread_kind: 'personal_chat',
      extra_count: mediaOmittedCount,
    };
    collector.pushThread(thread);
  }

  await collector.flushAll();
}
