import type { NormalizedMediaEvent, NormalizedThread } from '../../types/domain';
import {
  buildNormalizedEvent,
  createSimpleBatchBuffer,
  stableShortHash,
} from './streamHelpers';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

export interface YouTubeParseOptions extends StreamAdapterOptions {
  sessionHint?: string;
  onMediaBatch?: (items: NormalizedMediaEvent[]) => Promise<void> | void;
}

interface RawYouTubeHistoryItem {
  header?: string;
  title?: string;
  titleUrl?: string;
  subtitles?: Array<{ name?: string; url?: string }>;
  time?: string;
  products?: string[];
}

const PREFIX_STRIP_RE =
  /^(?:Watched|Viewed|Listened to|Просмотрено видео|Просмотрено|Прослушано)\s+/i;

/**
 * Streams Google Takeout YouTube `watch-history.json` arrays into `events` and `media_events`.
 */
export async function parseYouTubeStream(options: YouTubeParseOptions): Promise<void> {
  const threadId = 'youtube_watch_history';
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
    ['$.*'],
    (info, collector) => {
      if (info.stack.length !== 1 || !info.value || typeof info.value !== 'object') {
        return;
      }

      const item = info.value as RawYouTubeHistoryItem;
      if (!item.time) return;

      const tsMs = Date.parse(String(item.time).trim());
      if (!Number.isFinite(tsMs) || tsMs <= 0) return;

      const url = String(item.titleUrl || '').trim();
      const rawTitle = String(item.title || '').trim();
      const cleanTitle = rawTitle.replace(PREFIX_STRIP_RE, '').trim() || url || 'YouTube Video';

      const creatorName =
        String(item.subtitles?.[0]?.name || '').trim() ||
        (url ? 'Unknown Channel' : 'Removed / Unavailable');

      const isShort = /youtube\.com\/shorts\//i.test(url);
      const isMusic = /YouTube Music/i.test(String(item.header || '')) || /music\.youtube\.com/i.test(url);
      const kind = isShort ? 'shorts' : isMusic ? 'music' : 'video';

      const rowId = `yt_${filePrefix}_${seq++}`;

      collector.pushEvent(
        buildNormalizedEvent({
          eventId: rowId,
          threadId,
          sourceType: 'youtube',
          eventKind: 'visit',
          tsMs: Math.round(tsMs),
          senderId: `yt_${stableShortHash(creatorName)}`,
          senderName: creatorName,
          textContent: cleanTitle,
          directUrlForDomain: url || 'https://www.youtube.com',
          metaSubtype: kind,
        }),
      );

      mediaBuffer.push({
        media_id: rowId,
        thread_id: threadId,
        source_type: 'youtube',
        ts_ms: Math.round(tsMs),
        creator_name: creatorName,
        item_title: cleanTitle,
        album_or_sub: kind,
        ms_played: 0,
        is_skipped: false,
        is_shuffle: false,
        platform: isMusic ? 'youtube_music' : 'youtube',
      });
    },
    (collector) => {
      if (seq === 0) return;
      const thread: NormalizedThread = {
        thread_id: threadId,
        source_type: 'youtube',
        title: 'YouTube Watch History',
        thread_kind: 'video',
        extra_count: 0,
      };
      collector.pushThread(thread);
    },
  );

  await mediaBuffer.flushAll();
}
