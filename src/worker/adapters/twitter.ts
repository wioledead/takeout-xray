import type { NormalizedMediaEvent, NormalizedThread } from '../../types/domain';
import {
  buildNormalizedEvent,
  createSimpleBatchBuffer,
  stableShortHash,
} from './streamHelpers';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

export interface TwitterParseOptions extends StreamAdapterOptions {
  sessionHint?: string;
  onMediaBatch?: (items: NormalizedMediaEvent[]) => Promise<void> | void;
}

interface RawTwitterMention {
  screen_name?: string;
}

interface RawTwitterUrl {
  expanded_url?: string;
  url?: string;
}

interface RawTweet {
  id_str?: string;
  id?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  retweeted?: boolean;
  favorite_count?: string | number;
  retweet_count?: string | number;
  in_reply_to_screen_name?: string | null;
  source?: string;
  entities?: {
    user_mentions?: RawTwitterMention[];
    urls?: RawTwitterUrl[];
    media?: unknown[];
  };
  extended_entities?: {
    media?: unknown[];
  };
}

interface RawTwitterLike {
  tweetId?: string;
  fullText?: string;
  expandedUrl?: string;
  createdAt?: string;
}

interface RawTwitterDmMessage {
  messageCreate?: {
    id?: string;
    senderId?: string;
    recipientId?: string;
    text?: string;
    createdAt?: string;
    urls?: Array<{ expanded?: string }>;
    mediaUrls?: string[];
  };
}

interface RawTwitterDmConversation {
  conversationId?: string;
  messages?: RawTwitterDmMessage[];
}

const TWITTER_EPOCH_MS = 1288834974657n;
const SNOWFLAKE_ID_RE = /^\d{14,22}$/;
const RT_PREFIX_RE = /^RT\s+@([A-Za-z0-9_]{1,20})/i;
const MENTION_RE = /@([A-Za-z0-9_]{1,20})/;
const URL_AUTHOR_RE = /https?:\/\/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,20})\/status\//i;
const HTML_TAG_RE = /<[^>]*>/g;

/** Decodes a Twitter Snowflake tweet ID into its exact creation UTC timestamp in milliseconds. */
export function decodeTwitterSnowflakeMs(rawId: unknown): number | null {
  if (typeof rawId !== 'string' && typeof rawId !== 'number') return null;
  const s = String(rawId).trim();
  if (!SNOWFLAKE_ID_RE.test(s)) return null;
  try {
    const id = BigInt(s);
    const ms = Number((id >> 22n) + TWITTER_EPOCH_MS);
    if (!Number.isFinite(ms) || ms < Date.UTC(2006, 0, 1) || ms > Date.UTC(2100, 0, 1)) {
      return null;
    }
    return ms;
  } catch {
    return null;
  }
}

function parseTwitterDateMs(raw: unknown, fallbackId?: unknown): number | null {
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return decodeTwitterSnowflakeMs(fallbackId);
}

function cleanTwitterSource(rawSource: unknown): string {
  if (typeof rawSource !== 'string' || !rawSource.trim()) return 'X Web';
  const stripped = rawSource.replace(HTML_TAG_RE, '').trim();
  return stripped || 'X Web';
}

function normalizeHandle(raw: string): string {
  const clean = raw.replace(/^@+/, '').trim();
  return clean ? `@${clean}` : '@self';
}

function parseNonNegativeInt(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Strips `window.YTD.<name>.part<N> = ` prefixes and trailing semicolons from official
 * X / Twitter archive `.js` streams while passing pure JSON arrays through untouched.
 */
export function stripYtdWrapperStream(
  source: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let mode: 'SEEK_START' | 'PASSTHROUGH' | 'STRIP_YTD_TAIL' | 'DRAIN' = 'SEEK_START';
  let sawBomBytes = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          reader.releaseLock();
          controller.close();
          return;
        }
        if (!value || value.byteLength === 0) continue;

        if (mode === 'DRAIN') {
          // Consume trailing YTD wrapper whitespace/semicolons cleanly so upstream ZIP writers never abort.
          continue;
        }

        if (mode === 'PASSTHROUGH') {
          controller.enqueue(value);
          return;
        }

        let startOffset = 0;
        if (mode === 'SEEK_START') {
          let i = 0;
          if (sawBomBytes === 0 && value[0] === 0xef && value[1] === 0xbb && value[2] === 0xbf) {
            i = 3;
            sawBomBytes = 3;
          }
          while (i < value.byteLength) {
            const b = value[i];
            if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) {
              i++;
              continue;
            }
            // Pure JSON starts immediately at '[' or '{' -> no YTD wrapper to strip.
            if (i === sawBomBytes && (b === 0x5b || b === 0x7b)) {
              mode = 'PASSTHROUGH';
              controller.enqueue(value);
              return;
            }
            if (b === 0x5b || b === 0x7b) {
              startOffset = i;
              mode = 'STRIP_YTD_TAIL';
              break;
            }
            i++;
          }
          if (mode === 'SEEK_START') {
            sawBomBytes = -1;
            continue;
          }
        }

        // Track JSON array/object depth to drop any trailing `;` after the root YTD literal closes.
        let endOffset = value.byteLength;
        for (let i = startOffset; i < value.byteLength; i++) {
          const b = value[i];
          if (inString) {
            if (escaped) {
              escaped = false;
            } else if (b === 0x5c) {
              escaped = true;
            } else if (b === 0x22) {
              inString = false;
            }
            continue;
          }
          if (b === 0x22) {
            inString = true;
          } else if (b === 0x5b || b === 0x7b) {
            depth++;
          } else if (b === 0x5d || b === 0x7d) {
            depth--;
            if (depth <= 0) {
              endOffset = i + 1;
              mode = 'DRAIN';
              break;
            }
          }
        }

        if (endOffset > startOffset) {
          const slice =
            startOffset === 0 && endOffset === value.byteLength
              ? value
              : value.subarray(startOffset, endOffset);
          controller.enqueue(slice);
          return;
        }
      }
    },
    cancel(reason) {
      mode = 'DRAIN';
      return reader.cancel(reason).catch(() => {});
    },
  });
}

/**
 * Streams X / Twitter archive exports (`tweets.js`, `tweet.js`, `like.js`, `direct-messages.js`,
 * or plain JSON arrays), emitting tweets, replies, retweets, likes, and DMs into DuckDB.
 */
export async function parseTwitterStream(options: TwitterParseOptions): Promise<void> {
  const filePrefix = stableShortHash(options.sessionHint || String(options.totalBytes));
  const batchSize = options.batchSize ?? 5000;

  const mediaBuffer = createSimpleBatchBuffer<NormalizedMediaEvent>(batchSize, async (items) => {
    if (options.onMediaBatch && items.length > 0) {
      await options.onMediaBatch(items);
    }
  });

  const emittedThreads = new Map<string, NormalizedThread>();
  const ensureThread = (
    collector: Parameters<Parameters<typeof runStreamingJsonParser>[2]>[1],
    threadId: string,
    title: string,
    threadKind: NormalizedThread['thread_kind'],
  ) => {
    if (emittedThreads.has(threadId)) return;
    const thread: NormalizedThread = {
      thread_id: threadId,
      source_type: 'twitter',
      title,
      thread_kind: threadKind,
      extra_count: 0,
    };
    emittedThreads.set(threadId, thread);
    collector.pushThread(thread);
  };

  let seq = 0;

  const handleTweet = (
    tweet: RawTweet,
    collector: Parameters<Parameters<typeof runStreamingJsonParser>[2]>[1],
  ) => {
    const tsMs = parseTwitterDateMs(tweet.created_at, tweet.id_str ?? tweet.id);
    if (!tsMs) return;

    const text = String(tweet.full_text ?? tweet.text ?? '').trim();
    const rtMatch = text.match(RT_PREFIX_RE);
    const replyTo = typeof tweet.in_reply_to_screen_name === 'string'
      ? tweet.in_reply_to_screen_name.trim()
      : '';
    const isRetweet = Boolean(rtMatch) || Boolean(tweet.retweeted);
    const subtype: 'tweet' | 'reply' | 'retweet' = isRetweet
      ? 'retweet'
      : replyTo
        ? 'reply'
        : 'tweet';

    const firstMention = tweet.entities?.user_mentions?.[0]?.screen_name?.trim() || '';
    const textMention = text.match(MENTION_RE)?.[1] || '';
    const targetHandle = rtMatch
      ? normalizeHandle(rtMatch[1])
      : replyTo
        ? normalizeHandle(replyTo)
        : firstMention
          ? normalizeHandle(firstMention)
          : textMention
            ? normalizeHandle(textMention)
            : '@self';

    const expandedUrl = tweet.entities?.urls?.[0]?.expanded_url?.trim() || '';
    const hasMedia = Boolean(
      (tweet.extended_entities?.media?.length ?? 0) > 0 ||
        (tweet.entities?.media?.length ?? 0) > 0,
    );
    const likesReceived = parseNonNegativeInt(tweet.favorite_count);
    const sourceClient = cleanTwitterSource(tweet.source);

    const threadId = 'twitter_posts';
    ensureThread(collector, threadId, 'X / Twitter Posts & Replies', 'social');

    const rowId = `tw_${filePrefix}_${seq++}`;
    const senderLabel =
      subtype === 'tweet'
        ? targetHandle === '@self'
          ? 'Original Posts'
          : targetHandle
        : targetHandle;

    collector.pushEvent(
      buildNormalizedEvent({
        eventId: rowId,
        threadId,
        sourceType: 'twitter',
        // Treat retweets as service events so someone else's text doesn't dominate user's personal vocabulary
        eventKind: subtype === 'retweet' ? 'service' : 'message',
        tsMs,
        senderId: `tw_${stableShortHash(senderLabel)}`,
        senderName: senderLabel,
        textContent: text,
        hasMedia,
        directUrlForDomain: expandedUrl || undefined,
        metaSubtype: subtype,
      }),
    );

    mediaBuffer.push({
      media_id: rowId,
      thread_id: threadId,
      source_type: 'twitter',
      ts_ms: tsMs,
      creator_name: targetHandle,
      item_title: text.replace(/\s+/g, ' ').trim().slice(0, 360) || '(Tweet)',
      album_or_sub: sourceClient,
      ms_played: likesReceived,
      is_skipped: subtype === 'retweet',
      is_shuffle: hasMedia,
      platform: subtype,
    });
  };

  const handleLike = (
    like: RawTwitterLike,
    collector: Parameters<Parameters<typeof runStreamingJsonParser>[2]>[1],
  ) => {
    const expandedUrl = String(like.expandedUrl ?? '').trim();
    const text = String(like.fullText ?? expandedUrl ?? 'Liked Tweet').trim();
    const tsMs = parseTwitterDateMs(like.createdAt, like.tweetId) ?? Date.UTC(2010, 0, 1);
    if (!like.tweetId && !like.fullText && !like.expandedUrl) return;

    const urlAuthor = expandedUrl.match(URL_AUTHOR_RE)?.[1];
    const targetHandle =
      urlAuthor && urlAuthor.toLowerCase() !== 'i' ? normalizeHandle(urlAuthor) : '@liked';

    const threadId = 'twitter_likes';
    ensureThread(collector, threadId, 'X / Twitter Likes', 'social');

    const rowId = `tw_like_${filePrefix}_${seq++}`;

    collector.pushEvent(
      buildNormalizedEvent({
        eventId: rowId,
        threadId,
        sourceType: 'twitter',
        eventKind: 'service',
        tsMs,
        senderId: `tw_${stableShortHash(targetHandle)}`,
        senderName: targetHandle,
        textContent: text,
        directUrlForDomain: expandedUrl || 'https://x.com',
        metaSubtype: 'like',
      }),
    );

    mediaBuffer.push({
      media_id: rowId,
      thread_id: threadId,
      source_type: 'twitter',
      ts_ms: tsMs,
      creator_name: targetHandle,
      item_title: text.replace(/\s+/g, ' ').trim().slice(0, 360) || '(Liked Post)',
      album_or_sub: 'Like',
      ms_played: 0,
      is_skipped: false,
      is_shuffle: false,
      platform: 'like',
    });
  };

  const handleDmConversation = (
    conv: RawTwitterDmConversation,
    collector: Parameters<Parameters<typeof runStreamingJsonParser>[2]>[1],
  ) => {
    const convId = String(conv.conversationId ?? `dm_${seq}`);
    const messages = conv.messages ?? [];
    if (messages.length === 0) return;

    const threadId = `tw_dm_${stableShortHash(convId)}`;
    ensureThread(collector, threadId, `X DM · ${convId.slice(0, 16)}`, 'personal_chat');

    for (const entry of messages) {
      const mc = entry.messageCreate;
      if (!mc) continue;
      const tsMs = parseTwitterDateMs(mc.createdAt, mc.id);
      if (!tsMs) continue;
      const text = String(mc.text ?? '').trim();
      const sender = mc.senderId ? `ID:${mc.senderId}` : 'DM User';
      const rowId = `tw_dm_${filePrefix}_${seq++}`;

      collector.pushEvent(
        buildNormalizedEvent({
          eventId: rowId,
          threadId,
          sourceType: 'twitter',
          eventKind: 'message',
          tsMs,
          senderId: `tw_u_${stableShortHash(sender)}`,
          senderName: sender,
          textContent: text,
          hasMedia: (mc.mediaUrls?.length ?? 0) > 0,
          directUrlForDomain: mc.urls?.[0]?.expanded,
          metaSubtype: 'dm',
        }),
      );

      mediaBuffer.push({
        media_id: rowId,
        thread_id: threadId,
        source_type: 'twitter',
        ts_ms: tsMs,
        creator_name: sender,
        item_title: text.replace(/\s+/g, ' ').trim().slice(0, 360) || '(DM)',
        album_or_sub: 'Direct Message',
        ms_played: 0,
        is_skipped: false,
        is_shuffle: (mc.mediaUrls?.length ?? 0) > 0,
        platform: 'dm',
      });
    }
  };

  await runStreamingJsonParser(
    {
      ...options,
      stream: stripYtdWrapperStream(options.stream),
      onBatch: async (threads, events) => {
        await options.onBatch(threads, events);
        await mediaBuffer.flushIfReady();
      },
    },
    ['$.*'],
    (info, collector) => {
      if (!info.value || typeof info.value !== 'object') return;
      const obj = info.value as Record<string, unknown>;

      if (obj.tweet && typeof obj.tweet === 'object') {
        handleTweet(obj.tweet as RawTweet, collector);
      } else if (obj.like && typeof obj.like === 'object') {
        handleLike(obj.like as RawTwitterLike, collector);
      } else if (obj.dmConversation && typeof obj.dmConversation === 'object') {
        handleDmConversation(obj.dmConversation as RawTwitterDmConversation, collector);
      } else if (
        typeof obj.created_at === 'string' &&
        (typeof obj.full_text === 'string' || typeof obj.text === 'string')
      ) {
        handleTweet(obj as unknown as RawTweet, collector);
      }
    },
  );

  await mediaBuffer.flushAll();
}
