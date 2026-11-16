import type { ExportFormat } from '../../types/domain';

export class UnsupportedFormatError extends Error {
  readonly code = 'UNSUPPORTED_FORMAT';

  constructor(message = 'Unrecognized personal export JSON format.') {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

const WHATSAPP_PREFIX_RE =
  /^[\s\u200E\u200F\u202A-\u202E]*(?:\[\d{1,4}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}|\d{1,4}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s?[APap]\.?[Mm]\.?)?\s+[-–—])/m;
const CHROME_KEY_RE = /"Browser History"\s*:\s*\[/;
const CHATGPT_ARRAY_ROOT_RE = /^\s*\[\s*\{/;
const CHATGPT_MAPPING_RE = /"mapping"\s*:\s*\{/;
const CHATGPT_NODE_RE = /"(?:current_node|author|create_time)"\s*:/;
const CLAUDE_AI_MESSAGES_RE = /"chat_messages"\s*:\s*\[/;
const CLAUDE_AI_META_RE = /"(?:uuid|sender|created_at|name)"\s*:/;
const SPOTIFY_EXT_RE = /"ms_played"\s*:[\s\S]{0,600}"(?:ts|master_metadata_track_name|spotify_track_uri)"\s*:|"(?:ts|master_metadata_track_name)"\s*:[\s\S]{0,600}"ms_played"\s*:/;
const SPOTIFY_STD_RE = /"msPlayed"\s*:[\s\S]{0,400}"endTime"\s*:|"endTime"\s*:[\s\S]{0,400}"msPlayed"\s*:/;
const YOUTUBE_RE =
  /(?:"header"\s*:\s*"YouTube(?:\s+Music)?"|"products"\s*:\s*\[\s*"YouTube|"titleUrl"\s*:\s*"https:\/\/(?:www\.|music\.)?youtube\.com)/;
const DISCORD_PKG_RE = /"ID"\s*:\s*"?\d+[\s\S]{0,400}"Timestamp"\s*:[\s\S]{0,400}"Contents"\s*:/;
const DISCORD_DCE_RE = /"(?:guild|channel)"\s*:\s*[\s\S]{0,1200}"messages"\s*:\s*\[/;
const TIKTOK_RE =
  /"(?:Video Browsing History|VideoList|Like List|ItemFavoriteList|SearchList|Favorite Sounds)"\s*:|"(?:Activity|Видео|Лайки)"\s*:\s*\{[\s\S]{0,800}"(?:VideoList|SearchList|ItemFavoriteList)"/;
const TIKTOK_WAIT_RE = /^\s*\{\s*"(?:Activity|App Settings|Ads and data|Comment|Direct Message|Income|Location|Profile|Post)"\s*:/;
const TG_ACCOUNT_RE = /"chats"\s*:\s*\{[\s\S]{0,1000}"list"\s*:\s*\[/;
const TG_CHAT_RE = /"messages"\s*:\s*\[/;
const ANTIGRAVITY_HEAD_RE = /^\s*\{[\s\S]{0,512}"step_index"\s*:\s*\d+/;
const ANTIGRAVITY_FIELDS_RE = /"source"\s*:\s*"(?:USER_EXPLICIT|MODEL|SYSTEM)"/;

function detectJsonlObjectFormat(trimmed: string): ExportFormat | null {
  const nlIdx = trimmed.indexOf('\n');
  if (nlIdx !== -1) {
    const lines = trimmed.split('\n').slice(0, 5);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('{')) continue;
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') continue;
        if (
          typeof parsed.step_index === 'number' &&
          typeof parsed.source === 'string' &&
          typeof parsed.type === 'string'
        ) {
          return 'antigravity';
        }
        if (
          typeof parsed.type === 'string' &&
          ['user', 'assistant', 'system', 'summary', 'progress', 'queue-operation'].includes(parsed.type) &&
          (typeof parsed.timestamp === 'string' ||
            typeof parsed.uuid === 'string' ||
            typeof parsed.sessionId === 'string')
        ) {
          return 'claude_code';
        }
      } catch {
        // Ignore truncated chunk line
      }
    }
  }
  if (ANTIGRAVITY_HEAD_RE.test(trimmed) && ANTIGRAVITY_FIELDS_RE.test(trimmed)) {
    return 'antigravity';
  }
  if (
    /^\s*\{[\s\S]{0,512}"type"\s*:\s*"(?:user|assistant|system|summary|progress)"[\s\S]{0,512}"(?:timestamp|sessionId|uuid|message)"\s*:/.test(
      trimmed,
    )
  ) {
    return 'claude_code';
  }
  return null;
}

/**
 * Inspects a prefix of a personal data export to determine its format.
 * Returns null when the prefix looks like a valid JSON header whose
 * identifying array key may appear further into the file.
 */
export function tryDetectExportFormat(sliceText: string): ExportFormat | null {
  const clean = sliceText.replace(/^\uFEFF/, '');
  const trimmed = clean.trimStart();
  if (!trimmed) return null;

  if (CHROME_KEY_RE.test(clean)) {
    return 'chrome_history';
  }

  // Array-rooted JSON formats (ChatGPT, Claude.ai, Spotify, YouTube Takeout, Discord Package)
  if (CHATGPT_ARRAY_ROOT_RE.test(trimmed)) {
    if (CHATGPT_MAPPING_RE.test(clean) && CHATGPT_NODE_RE.test(clean)) {
      return 'chatgpt';
    }
    if (CLAUDE_AI_MESSAGES_RE.test(clean) && CLAUDE_AI_META_RE.test(clean)) {
      return 'claude_ai';
    }
    if (SPOTIFY_EXT_RE.test(clean) || SPOTIFY_STD_RE.test(clean)) {
      return 'spotify';
    }
    if (YOUTUBE_RE.test(clean)) {
      return 'youtube';
    }
    if (DISCORD_PKG_RE.test(clean)) {
      return 'discord';
    }
    // Wait for more bytes if header objects precede nested distinguishing keys
    return null;
  }

  // Plain-text WhatsApp exports (`[DD.MM.YYYY, HH:MM:SS] Name: msg` or `DD/MM/YYYY, HH:MM - Name: msg`)
  // Check before the bare `[` JSON-array guard since iOS WhatsApp lines start with `[`.
  if (WHATSAPP_PREFIX_RE.test(clean)) {
    return 'whatsapp';
  }

  // Plain `[` without `{` could be an empty array `[]` or whitespace before `{`
  if (trimmed.startsWith('[')) {
    return null;
  }

  // Object-rooted JSON & JSONL formats (Antigravity, Claude Code, TikTok, DiscordChatExporter, Telegram)
  if (trimmed.startsWith('{')) {
    const jsonlFmt = detectJsonlObjectFormat(trimmed);
    if (jsonlFmt) {
      return jsonlFmt;
    }
    if (TIKTOK_RE.test(clean)) {
      return 'tiktok';
    }
    if (DISCORD_DCE_RE.test(clean)) {
      return 'discord';
    }
    if (TG_ACCOUNT_RE.test(clean)) {
      return 'tg_account';
    }
    // Wait before classifying as tg_chat if `"chats"` or Discord `"channel"`/"guild" root appears first
    if (
      TG_CHAT_RE.test(clean) &&
      !/"chats"\s*:\s*\{/.test(clean) &&
      !/"(?:guild|channel)"\s*:/.test(clean)
    ) {
      return 'tg_chat';
    }
    if (TIKTOK_WAIT_RE.test(trimmed)) {
      return null;
    }
    return null;
  }

  throw new UnsupportedFormatError();
}

export function detectExportFormat(sliceText: string): ExportFormat {
  const detected = tryDetectExportFormat(sliceText);
  if (detected) return detected;
  throw new UnsupportedFormatError();
}

const DETECTION_WINDOWS = [65536, 524288, 4194304] as const;

export async function detectFileFormat(file: Blob): Promise<ExportFormat> {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let lastText = '';

  for (const windowBytes of DETECTION_WINDOWS) {
    const end = Math.min(file.size, windowBytes);
    const buffer = await file.slice(0, end).arrayBuffer();
    lastText = decoder.decode(buffer);

    const detected = tryDetectExportFormat(lastText);
    if (detected) {
      return detected;
    }

    if (end >= file.size) {
      break;
    }
  }

  if (TIKTOK_RE.test(lastText)) return 'tiktok';
  if (DISCORD_DCE_RE.test(lastText)) return 'discord';
  if (TG_CHAT_RE.test(lastText)) return 'tg_chat';

  throw new UnsupportedFormatError();
}

/**
 * Peeks prefix chunks from an arbitrary ReadableStream (e.g. a streaming ZIP entry)
 * to classify its ExportFormat, then returns a lossless replay stream starting at byte 0.
 */
export async function detectAndWrapStream(
  source: ReadableStream<Uint8Array>,
): Promise<{ format: ExportFormat; replayStream: ReadableStream<Uint8Array> }> {
  const reader = source.getReader();
  const bufferedChunks: Uint8Array[] = [];
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let prefixText = '';
  let bufferedBytes = 0;
  let detected: ExportFormat | null = null;
  let streamEnded = false;

  try {
    while (bufferedBytes < 4 * 1024 * 1024) {
      const { done, value } = await reader.read();
      if (done) {
        streamEnded = true;
        prefixText += decoder.decode();
        detected = tryDetectExportFormat(prefixText);
        break;
      }
      if (value && value.byteLength > 0) {
        bufferedChunks.push(value);
        bufferedBytes += value.byteLength;
        prefixText += decoder.decode(value, { stream: true });
        detected = tryDetectExportFormat(prefixText);
        if (detected) {
          break;
        }
      }
    }

    if (!detected) {
      if (TIKTOK_RE.test(prefixText)) detected = 'tiktok';
      else if (DISCORD_DCE_RE.test(prefixText)) detected = 'discord';
      else if (TG_CHAT_RE.test(prefixText)) detected = 'tg_chat';
    }

    if (!detected) {
      throw new UnsupportedFormatError();
    }
  } catch (err) {
    reader.releaseLock();
    throw err;
  }

  const replayStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (bufferedChunks.length > 0) {
        controller.enqueue(bufferedChunks.shift()!);
        return;
      }
      if (streamEnded) {
        reader.releaseLock();
        controller.close();
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        streamEnded = true;
        reader.releaseLock();
        controller.close();
        return;
      }
      if (value && value.byteLength > 0) {
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason).catch(() => {});
    },
  });

  return { format: detected, replayStream };
}
