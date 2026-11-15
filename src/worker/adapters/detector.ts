import type { ExportFormat } from '../../types/domain';

export class UnsupportedFormatError extends Error {
  readonly code = 'UNSUPPORTED_FORMAT';

  constructor(message = 'Unrecognized personal export JSON format.') {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

const CHROME_KEY_RE = /"Browser History"\s*:\s*\[/;
const CHATGPT_ARRAY_ROOT_RE = /^\s*\[\s*\{/;
const CHATGPT_MAPPING_RE = /"mapping"\s*:\s*\{/;
const CHATGPT_NODE_RE = /"(?:current_node|author|create_time)"\s*:/;
const TG_ACCOUNT_RE = /"chats"\s*:\s*\{[\s\S]{0,1000}"list"\s*:\s*\[/;
const TG_CHAT_RE = /"messages"\s*:\s*\[/;

/**
 * Inspects a prefix of a JSON export to determine its format.
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

  // ChatGPT exports are always top-level JSON arrays of conversation objects
  if (CHATGPT_ARRAY_ROOT_RE.test(trimmed)) {
    if (CHATGPT_MAPPING_RE.test(clean) && CHATGPT_NODE_RE.test(clean)) {
      return 'chatgpt';
    }
    // Could be an empty array `[]` or a valid ChatGPT header with long title/metadata
    return null;
  }

  // Telegram exports are top-level JSON objects
  if (trimmed.startsWith('{')) {
    if (TG_ACCOUNT_RE.test(clean)) {
      return 'tg_account';
    }
    // Wait before classifying as tg_chat if `"chats"` root exists without `"list"` yet
    if (TG_CHAT_RE.test(clean) && !/"chats"\s*:\s*\{/.test(clean)) {
      return 'tg_chat';
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

  // Final check for object-root Telegram single-chat where `"chats"` wasn't present
  if (TG_CHAT_RE.test(lastText)) {
    return 'tg_chat';
  }

  throw new UnsupportedFormatError();
}
