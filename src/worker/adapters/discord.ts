import type { EventKind, NormalizedThread, ThreadKind } from '../../types/domain';
import { buildNormalizedEvent, stableShortHash } from './streamHelpers';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

export interface DiscordParseOptions extends StreamAdapterOptions {
  /** Channel ID derived from file path like `messages/c123456/messages.json`. */
  channelIdHint?: string;
  /** Optional channel-ID -> display title mapping loaded from Discord's `messages/index.json`. */
  channelTitleMap?: Record<string, string>;
}

interface RawDiscordPackageMsg {
  ID?: string | number;
  Timestamp?: string;
  Contents?: string;
  Attachments?: string | unknown[];
}

interface RawDiscordDceMsg {
  id?: string | number;
  type?: string;
  timestamp?: string;
  content?: string;
  author?: {
    id?: string;
    name?: string;
    nickname?: string;
  };
  attachments?: unknown[];
  embeds?: unknown[];
  stickers?: unknown[];
}

function parseDiscordTsMs(raw: unknown, fallbackMs: number): number {
  if (typeof raw === 'string' && raw.trim()) {
    let s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(s) && !s.includes('T')) {
      s = `${s.replace(' ', 'T')}Z`;
    }
    const parsed = Date.parse(s);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return fallbackMs > 0 ? fallbackMs + 1 : Date.now();
}

function normalizeChannelKey(hint?: string): string {
  if (!hint) return '';
  const m = hint.match(/(?:^|[\\/])c?(\d+)[\\/]messages\.json$/i);
  if (m) return m[1];
  return hint.replace(/^c/i, '').trim();
}

/**
 * Streams both Discord Official Data Package (`messages/c*\/messages.json`) and
 * `DiscordChatExporter` single-channel JSON files into normalized threads and events.
 */
export async function parseDiscordStream(options: DiscordParseOptions): Promise<void> {
  const hintKey = normalizeChannelKey(options.channelIdHint);
  const threadId = `dc_${stableShortHash(hintKey || options.channelIdHint || 'discord_channel')}`;

  let guildName = '';
  let dceChannelId = '';
  let dceChannelName = '';
  let dceChannelType = '';
  let lastTsMs = 0;
  let seq = 0;

  await runStreamingJsonParser(
    options,
    ['$.guild', '$.channel', '$.messages.*', '$.*'],
    (info, collector) => {
      if (!info.value || typeof info.value !== 'object') return;

      // Branch 1: DiscordChatExporter root metadata
      if (info.stack.length === 1 && info.key === 'guild') {
        const g = info.value as { name?: string };
        if (g.name) guildName = String(g.name).trim();
        return;
      }
      if (info.stack.length === 1 && info.key === 'channel') {
        const ch = info.value as { id?: string; name?: string; type?: string };
        if (ch.id) dceChannelId = String(ch.id);
        if (ch.name) dceChannelName = String(ch.name).trim();
        if (ch.type) dceChannelType = String(ch.type).trim();
        return;
      }

      // Branch 2: DiscordChatExporter `$.messages.*`
      if (info.stack.length === 2 && info.stack[1]?.key === 'messages') {
        const msg = info.value as RawDiscordDceMsg;
        let tsMs = parseDiscordTsMs(msg.timestamp, lastTsMs);
        if (lastTsMs > 0 && tsMs < lastTsMs) tsMs = lastTsMs + 1;
        lastTsMs = tsMs;

        const text = String(msg.content ?? '').trim();
        const hasMedia =
          (Array.isArray(msg.attachments) && msg.attachments.length > 0) ||
          (Array.isArray(msg.embeds) && msg.embeds.length > 0) ||
          (Array.isArray(msg.stickers) && msg.stickers.length > 0);
        const msgType = String(msg.type || 'Default');
        const isRegular = msgType === 'Default' || msgType === 'Reply' || msgType === 'ThreadStarterMessage';
        const eventKind: EventKind = isRegular && (text || hasMedia) ? 'message' : 'service';

        const senderName =
          String(msg.author?.nickname || msg.author?.name || 'Discord User').trim() || 'Discord User';
        const senderId = String(msg.author?.id || stableShortHash(senderName));

        const event = buildNormalizedEvent({
          eventId: `${threadId}_${String(msg.id || seq)}`,
          threadId,
          sourceType: 'discord',
          eventKind,
          tsMs,
          senderId,
          senderName,
          textContent: text,
          hasMedia,
          metaSubtype: eventKind === 'service' ? msgType.toLowerCase() : null,
        });

        collector.pushEvent(event);
        seq++;
        return;
      }

      // Branch 3: Discord Data Package array root `[{ ID, Timestamp, Contents, Attachments }]`
      if (info.stack.length === 1 && typeof info.key === 'number') {
        const msg = info.value as RawDiscordPackageMsg;
        if (!('Timestamp' in msg) && !('Contents' in msg) && !('ID' in msg)) {
          return;
        }

        let tsMs = parseDiscordTsMs(msg.Timestamp, lastTsMs);
        if (tsMs < lastTsMs) tsMs = lastTsMs + 1;
        lastTsMs = tsMs;

        const text = String(msg.Contents ?? '').trim();
        const hasMedia = Array.isArray(msg.Attachments)
          ? msg.Attachments.length > 0
          : typeof msg.Attachments === 'string' && msg.Attachments.trim().length > 0;

        if (!text && !hasMedia) return;

        const event = buildNormalizedEvent({
          eventId: `${threadId}_${String(msg.ID || seq)}`,
          threadId,
          sourceType: 'discord',
          eventKind: 'message',
          tsMs,
          senderId: 'discord_self',
          senderName: 'You',
          textContent: text,
          hasMedia,
          metaSubtype: 'user',
        });

        collector.pushEvent(event);
        seq++;
      }
    },
    (collector) => {
      if (seq === 0) return;

      const lookupId = dceChannelId || hintKey;
      const mappedTitle = lookupId
        ? options.channelTitleMap?.[lookupId] || options.channelTitleMap?.[`c${lookupId}`]
        : undefined;

      let title = 'Discord Messages';
      if (dceChannelName) {
        title = guildName ? `${guildName} / #${dceChannelName}` : `#${dceChannelName}`;
      } else if (mappedTitle) {
        title = mappedTitle;
      } else if (lookupId) {
        title = `Channel ${lookupId}`;
      }

      const threadKind: ThreadKind = /direct|dm/i.test(`${dceChannelType} ${title}`)
        ? 'personal_chat'
        : 'channel';

      const thread: NormalizedThread = {
        thread_id: threadId,
        source_type: 'discord',
        title,
        thread_kind: threadKind,
        extra_count: 0,
      };
      collector.pushThread(thread);
    },
  );
}
