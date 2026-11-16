import type { EventKind, NormalizedMediaEvent, NormalizedThread } from '../../types/domain';
import {
  buildNormalizedEvent,
  createSimpleBatchBuffer,
  stableShortHash,
} from './streamHelpers';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

export interface TikTokParseOptions extends StreamAdapterOptions {
  sessionHint?: string;
  onMediaBatch?: (items: NormalizedMediaEvent[]) => Promise<void> | void;
}

interface RawTikTokEntry {
  Date?: string;
  date?: string;
  Link?: string;
  link?: string;
  SearchTerm?: string;
  SoundName?: string;
}

const CREATOR_HANDLE_RE = /tiktok\.com\/(@[A-Za-z0-9_.-]+)/i;

function parseTikTokDateMs(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  const normalized = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
}

function classifyTikTokList(listKey: string): 'watch' | 'like' | 'search' | 'sound' | null {
  if (listKey === 'VideoList') return 'watch';
  if (listKey === 'ItemFavoriteList') return 'like';
  if (listKey === 'SearchList') return 'search';
  if (listKey === 'FavoriteSoundList') return 'sound';
  return null;
}

/**
 * Streams TikTok GDPR JSON exports (`user_data_tiktok.json`), extracting watched videos,
 * liked videos, search queries, and creator handles into `events` and `media_events`.
 */
export async function parseTikTokStream(options: TikTokParseOptions): Promise<void> {
  const threadId = 'tiktok_activity';
  const filePrefix = stableShortHash(options.sessionHint || String(options.totalBytes));
  const batchSize = options.batchSize ?? 5000;
  const mediaBuffer = createSimpleBatchBuffer<NormalizedMediaEvent>(batchSize, async (items) => {
    if (options.onMediaBatch && items.length > 0) {
      await options.onMediaBatch(items);
    }
  });

  let seq = 0;

  await runStreamingJsonParser(
    {
      ...options,
      onBatch: async (threads, events) => {
        await options.onBatch(threads, events);
        await mediaBuffer.flushIfReady();
      },
    },
    [
      '$.*.VideoList.*',
      '$.*.*.VideoList.*',
      '$.*.ItemFavoriteList.*',
      '$.*.*.ItemFavoriteList.*',
      '$.*.SearchList.*',
      '$.*.*.SearchList.*',
      '$.*.FavoriteSoundList.*',
      '$.*.*.FavoriteSoundList.*',
    ],
    (info, collector) => {
      if (!info.value || typeof info.value !== 'object') return;
      const listKey = String(info.stack[info.stack.length - 1]?.key ?? '');
      const category = classifyTikTokList(listKey);
      if (!category) return;

      const item = info.value as RawTikTokEntry;
      const tsMs = parseTikTokDateMs(item.Date ?? item.date);
      if (!tsMs) return;

      const link = String(item.Link ?? item.link ?? '').trim();
      const searchTerm = String(item.SearchTerm ?? '').trim();
      const handleMatch = link.match(CREATOR_HANDLE_RE);

      let creatorName = handleMatch ? handleMatch[1] : 'tiktok.com';
      let itemTitle = link || 'TikTok Video';
      let eventKind: EventKind = 'visit';

      if (category === 'search') {
        eventKind = 'service';
        creatorName = 'Search';
        itemTitle = searchTerm || link || 'TikTok Search';
      } else if (category === 'like') {
        eventKind = 'service';
        creatorName = handleMatch ? handleMatch[1] : 'Liked Video';
      } else if (category === 'sound') {
        eventKind = 'service';
        creatorName = 'Favorite Sound';
        itemTitle = String(item.SoundName || link || 'TikTok Sound');
      }

      const rowId = `tt_${filePrefix}_${seq++}`;

      collector.pushEvent(
        buildNormalizedEvent({
          eventId: rowId,
          threadId,
          sourceType: 'tiktok',
          eventKind,
          tsMs,
          senderId: `tt_${stableShortHash(creatorName)}`,
          senderName: creatorName,
          textContent: itemTitle,
          directUrlForDomain: link || 'https://www.tiktok.com',
          metaSubtype: category,
        }),
      );

      mediaBuffer.push({
        media_id: rowId,
        thread_id: threadId,
        source_type: 'tiktok',
        ts_ms: tsMs,
        creator_name: creatorName,
        item_title: itemTitle,
        album_or_sub: category,
        ms_played: 0,
        is_skipped: false,
        is_shuffle: false,
        platform: category,
      });
    },
    (collector) => {
      if (seq === 0) return;
      const thread: NormalizedThread = {
        thread_id: threadId,
        source_type: 'tiktok',
        title: 'TikTok Activity & Watch History',
        thread_kind: 'video',
        extra_count: 0,
      };
      collector.pushThread(thread);
    },
  );

  await mediaBuffer.flushAll();
}
