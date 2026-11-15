import type { ExportFormat, NormalizedEvent, NormalizedThread, ThreadKind } from '../../types/domain';
import {
  countQuestions,
  countWords,
  extractEmojis,
  extractFirstDomain,
  hasCodeBlock,
} from '../../utils/textAnalysis';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

interface RawTextEntity {
  type?: string;
  text?: string;
  href?: string;
}

interface RawTelegramMessage {
  id?: number | string;
  type?: string;
  date?: string;
  date_unixtime?: string | number;
  from?: string;
  from_id?: string;
  actor?: string;
  actor_id?: string;
  action?: string;
  text?: string | Array<string | RawTextEntity>;
  photo?: string;
  file?: string;
  thumbnail?: string;
  media_type?: string;
  sticker_emoji?: string;
}

interface ChatMeta {
  id?: string;
  name?: string;
  type?: string;
  eventCount: number;
}

function normalizeThreadKind(rawType?: string): ThreadKind {
  if (!rawType) return 'personal_chat';
  const lower = rawType.toLowerCase();
  if (lower.includes('group') || lower.includes('supergroup') || lower.includes('channel')) {
    return 'private_group';
  }
  return 'personal_chat';
}

function flattenTelegramText(rawText: RawTelegramMessage['text']): {
  text: string;
  hasEntityCode: boolean;
  entityHref: string | null;
} {
  if (typeof rawText === 'string') {
    return { text: rawText, hasEntityCode: false, entityHref: null };
  }
  if (!Array.isArray(rawText)) {
    return { text: '', hasEntityCode: false, entityHref: null };
  }

  let text = '';
  let hasEntityCode = false;
  let entityHref: string | null = null;

  for (const part of rawText) {
    if (typeof part === 'string') {
      text += part;
    } else if (part && typeof part === 'object') {
      if (typeof part.text === 'string') {
        text += part.text;
      }
      if (part.type === 'pre' || part.type === 'code') {
        hasEntityCode = true;
      }
      if (!entityHref && part.type === 'text_link' && typeof part.href === 'string') {
        entityHref = part.href;
      }
    }
  }

  return { text, hasEntityCode, entityHref };
}

function parseTelegramTimestampMs(msg: RawTelegramMessage): number | null {
  if (msg.date_unixtime !== undefined && msg.date_unixtime !== null) {
    const num = Number(msg.date_unixtime);
    if (Number.isFinite(num) && num > 0) {
      return Math.round(num * 1000);
    }
  }
  if (typeof msg.date === 'string' && msg.date.length > 0) {
    const parsed = Date.parse(msg.date);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeTelegramMessage(
  msg: RawTelegramMessage,
  threadId: string,
  sourceType: ExportFormat,
  fallbackSeq: number,
): NormalizedEvent | null {
  if (!msg || typeof msg !== 'object') return null;

  const tsMs = parseTelegramTimestampMs(msg);
  if (tsMs === null) return null;

  const isService = msg.type === 'service';
  const eventKind = isService ? 'service' : 'message';
  const { text, hasEntityCode, entityHref } = flattenTelegramText(msg.text);

  const senderName = String(
    msg.from || msg.actor || msg.from_id || msg.actor_id || 'Unknown',
  ).trim() || 'Unknown';
  const senderId = String(msg.from_id || msg.actor_id || senderName);

  const hasMedia = Boolean(
    msg.photo || msg.file || msg.media_type || msg.sticker_emoji || msg.thumbnail,
  );
  const emojis = extractEmojis(text);
  if (msg.sticker_emoji && typeof msg.sticker_emoji === 'string' && emojis.length === 0) {
    emojis.push(...extractEmojis(msg.sticker_emoji));
  }

  const domain = extractFirstDomain(text, false) ?? (entityHref ? extractFirstDomain(entityHref, true) : null);
  const metaSubtype = isService
    ? String(msg.action || 'service')
    : msg.media_type
      ? String(msg.media_type)
      : null;

  return {
    event_id: `${threadId}_${String(msg.id ?? fallbackSeq)}`,
    thread_id: threadId,
    source_type: sourceType,
    event_kind: eventKind,
    ts_ms: tsMs,
    sender_id: senderId,
    sender_name: senderName,
    text_content: text,
    char_count: text.length,
    word_count: isService ? 0 : countWords(text),
    question_count: isService ? 0 : countQuestions(text),
    has_code: hasEntityCode || hasCodeBlock(text),
    has_media: hasMedia,
    emojis,
    domain,
    meta_subtype: metaSubtype,
  };
}

export async function parseTelegramStream(
  options: StreamAdapterOptions,
  mode: 'tg_chat' | 'tg_account',
): Promise<void> {
  if (mode === 'tg_chat') {
    const threadId = 'tg_chat_primary';
    const chatMeta: ChatMeta = { eventCount: 0 };
    let seq = 0;

    await runStreamingJsonParser(
      options,
      ['$.name', '$.type', '$.id', '$.messages.*'],
      (info, collector) => {
        if (info.stack.length === 1) {
          if (info.key === 'name' && info.value !== undefined) {
            chatMeta.name = String(info.value);
          } else if (info.key === 'type' && info.value !== undefined) {
            chatMeta.type = String(info.value);
          } else if (info.key === 'id' && info.value !== undefined) {
            chatMeta.id = String(info.value);
          }
          return;
        }

        if (info.stack.length === 2 && info.stack[1]?.key === 'messages' && info.value && typeof info.value === 'object') {
          const event = normalizeTelegramMessage(info.value as RawTelegramMessage, threadId, 'tg_chat', seq++);
          if (event) {
            chatMeta.eventCount++;
            collector.pushEvent(event);
          }
        }
      },
      (collector) => {
        const thread: NormalizedThread = {
          thread_id: threadId,
          source_type: 'tg_chat',
          title: chatMeta.name || (chatMeta.id ? `Chat #${chatMeta.id}` : 'Telegram Chat'),
          thread_kind: normalizeThreadKind(chatMeta.type),
          extra_count: 0,
        };
        collector.pushThread(thread);
      },
    );
    return;
  }

  // Full account export: $.chats.list.*
  const chats = new Map<number, ChatMeta>();
  let seq = 0;

  const getChatMeta = (idx: number): ChatMeta => {
    let meta = chats.get(idx);
    if (!meta) {
      meta = { eventCount: 0 };
      chats.set(idx, meta);
    }
    return meta;
  };

  await runStreamingJsonParser(
    options,
    [
      '$.chats.list.*.name',
      '$.chats.list.*.type',
      '$.chats.list.*.id',
      '$.chats.list.*.messages.*',
    ],
    (info, collector) => {
      if (info.stack[1]?.key !== 'chats' || info.stack[2]?.key !== 'list') {
        return;
      }

      const chatIdxRaw = info.stack[3]?.key;
      if (typeof chatIdxRaw !== 'number') {
        return;
      }

      const meta = getChatMeta(chatIdxRaw);

      if (info.stack.length === 4) {
        if (info.key === 'name' && info.value !== undefined) {
          meta.name = String(info.value);
        } else if (info.key === 'type' && info.value !== undefined) {
          meta.type = String(info.value);
        } else if (info.key === 'id' && info.value !== undefined) {
          meta.id = String(info.value);
        }
        return;
      }

      if (
        info.stack.length === 5 &&
        info.stack[4]?.key === 'messages' &&
        info.value &&
        typeof info.value === 'object'
      ) {
        const threadId = `tg_chat_${chatIdxRaw}`;
        const event = normalizeTelegramMessage(
          info.value as RawTelegramMessage,
          threadId,
          'tg_account',
          seq++,
        );
        if (event) {
          meta.eventCount++;
          collector.pushEvent(event);
        }
      }
    },
    (collector) => {
      for (const [chatIdx, meta] of chats.entries()) {
        if (meta.eventCount === 0) continue;
        const fallbackTitle = meta.type?.toLowerCase().includes('saved')
          ? 'Saved Messages'
          : meta.id
            ? `Chat #${meta.id}`
            : `Chat #${chatIdx + 1}`;
        collector.pushThread({
          thread_id: `tg_chat_${chatIdx}`,
          source_type: 'tg_account',
          title: meta.name || fallbackTitle,
          thread_kind: normalizeThreadKind(meta.type),
          extra_count: 0,
        });
      }
    },
  );
}
