import type { NormalizedMediaEvent, NormalizedThread } from '../../types/domain';
import {
  buildNormalizedEvent,
  createSimpleBatchBuffer,
  stableShortHash,
} from './streamHelpers';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

export interface SpotifyParseOptions extends StreamAdapterOptions {
  sessionHint?: string;
  onMediaBatch?: (items: NormalizedMediaEvent[]) => Promise<void> | void;
}

interface RawSpotifyRecord {
  // Extended Streaming History fields
  ts?: string;
  ms_played?: number;
  platform?: string;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  audiobook_title?: string | null;
  skipped?: boolean | null;
  shuffle?: boolean | null;
  // Standard Account Data StreamingHistory fields
  endTime?: string;
  artistName?: string;
  trackName?: string;
  msPlayed?: number;
}

function parseSpotifyTsMs(raw: RawSpotifyRecord): number | null {
  if (typeof raw.ts === 'string' && raw.ts.trim()) {
    const ms = Date.parse(raw.ts.trim());
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms);
  }
  if (typeof raw.endTime === 'string' && raw.endTime.trim()) {
    const normalized = raw.endTime.trim().replace(' ', 'T');
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
      ? `${normalized}:00Z`
      : normalized.endsWith('Z')
        ? normalized
        : `${normalized}Z`;
    const ms = Date.parse(iso);
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms);
  }
  return null;
}

/**
 * Streams both Spotify Extended Streaming History (`Streaming_History_Audio_*.json`) and
 * Standard Account Data (`StreamingHistory*.json`) arrays into `events` + `media_events`.
 */
export async function parseSpotifyStream(options: SpotifyParseOptions): Promise<void> {
  const threadId = 'spotify_history';
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

      const item = info.value as RawSpotifyRecord;
      const tsMs = parseSpotifyTsMs(item);
      if (!tsMs) return;

      const msPlayedRaw = item.ms_played ?? item.msPlayed ?? 0;
      const msPlayed = Number.isFinite(Number(msPlayedRaw)) ? Math.max(0, Math.round(Number(msPlayedRaw))) : 0;

      const trackTitle = String(
        item.master_metadata_track_name ||
          item.trackName ||
          item.episode_name ||
          item.audiobook_title ||
          'Unknown Track',
      ).trim();

      const creatorName = String(
        item.master_metadata_album_artist_name ||
          item.artistName ||
          item.episode_show_name ||
          'Unknown Artist',
      ).trim();

      const albumOrSub = item.master_metadata_album_album_name
        ? String(item.master_metadata_album_album_name).trim()
        : null;

      const isSkipped = Boolean(item.skipped);
      const isShuffle = Boolean(item.shuffle);
      const platform = item.platform ? String(item.platform).trim() : null;

      const rowId = `sp_${filePrefix}_${seq++}`;
      const textContent = `${trackTitle} — ${creatorName}`;

      collector.pushEvent(
        buildNormalizedEvent({
          eventId: rowId,
          threadId,
          sourceType: 'spotify',
          eventKind: 'visit',
          tsMs,
          senderId: `artist_${stableShortHash(creatorName)}`,
          senderName: creatorName,
          textContent,
          metaSubtype: isSkipped ? 'skipped' : 'played',
        }),
      );

      mediaBuffer.push({
        media_id: rowId,
        thread_id: threadId,
        source_type: 'spotify',
        ts_ms: tsMs,
        creator_name: creatorName,
        item_title: trackTitle,
        album_or_sub: albumOrSub,
        ms_played: msPlayed,
        is_skipped: isSkipped,
        is_shuffle: isShuffle,
        platform,
      });
    },
    (collector) => {
      if (seq === 0) return;
      const thread: NormalizedThread = {
        thread_id: threadId,
        source_type: 'spotify',
        title: 'Spotify Streaming History',
        thread_kind: 'streaming',
        extra_count: 0,
      };
      collector.pushThread(thread);
    },
  );

  await mediaBuffer.flushAll();
}
