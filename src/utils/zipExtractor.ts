import { BlobReader, ZipReader, configure, type Entry } from '@zip.js/zip.js';
import type { IngestFileEntry } from '../types/rpc';

// Strictly disable external web workers inside zip.js to preserve zero-network execution.
configure({
  useWebWorkers: false,
});

export interface ZipArchiveGroup {
  groupId: string;
  label: string;
  entries: IngestFileEntry[];
  totalSizeBytes: number;
}

const IGNORED_PATH_RE = /(?:^|\/)(?:__MACOSX|node_modules|\.git)\/|(?:^|\/)\._/i;
const TRANSCRIPT_RE = /(?:^|\/)transcript(?:_full)?\.jsonl$/i;

function classifyZipPath(path: string): { groupId: string; label: string } | null {
  const lower = path.toLowerCase();
  if (/(?:^|\/)result\.json$/.test(lower)) {
    return { groupId: 'telegram', label: 'Telegram (result.json)' };
  }
  if (/(?:^|\/)watch-history\.json$/.test(lower)) {
    return { groupId: 'youtube', label: 'YouTube (watch-history.json)' };
  }
  if (/(?:^|\/)browserhistory\.json$/.test(lower)) {
    return { groupId: 'chrome', label: 'Chrome (BrowserHistory.json)' };
  }
  if (/(?:^|\/)user_data_tiktok\.json$/.test(lower)) {
    return { groupId: 'tiktok', label: 'TikTok (user_data_tiktok.json)' };
  }
  if (/(?:^|\/)(?:streaming_history_audio_|streaminghistory).*\.json$/.test(lower)) {
    return { groupId: 'spotify', label: 'Spotify Streaming History' };
  }
  if (/(?:^|\/)messages\/(?:c?\d+\/messages\.json|index\.json)$/.test(lower)) {
    return { groupId: 'discord', label: 'Discord Package (messages/)' };
  }
  if (/(?:^|\/)conversations\.json$/.test(lower)) {
    return { groupId: 'ai_conversations', label: 'ChatGPT / Claude.ai (conversations.json)' };
  }
  if (TRANSCRIPT_RE.test(path)) {
    return { groupId: 'antigravity', label: 'Antigravity 2.0 (transcript*.jsonl)' };
  }
  if (/\.jsonl$/i.test(lower)) {
    return { groupId: 'claude_code', label: 'Claude Code CLI (.jsonl)' };
  }
  if (/(?:^|\/)(?:data\/)?(?:tweets?(?:-part\d+)?|likes?|direct-messages(?:-part\d+)?)\.js$/i.test(lower)) {
    return { groupId: 'twitter', label: 'X / Twitter Archive (data/*.js)' };
  }
  if (/(?:^|\/)(?:_chat|whatsapp chat .*)\.txt$/.test(lower)) {
    return { groupId: 'whatsapp', label: 'WhatsApp (_chat.txt)' };
  }
  return null;
}

function deduplicateAntigravityZipEntries(entries: IngestFileEntry[]): IngestFileEntry[] {
  const byDir = new Map<string, { full?: IngestFileEntry; compact?: IngestFileEntry }>();
  for (const entry of entries) {
    const norm = (entry.zipEntryPath || '').replace(/\\/g, '/');
    const lastSlash = norm.lastIndexOf('/');
    const dir = lastSlash >= 0 ? norm.slice(0, lastSlash) : '';
    const isFull = /\/transcript_full\.jsonl$/i.test(norm) || /^transcript_full\.jsonl$/i.test(norm);
    const bucket = byDir.get(dir) ?? {};
    if (isFull) bucket.full = entry;
    else bucket.compact = entry;
    byDir.set(dir, bucket);
  }
  return Array.from(byDir.values())
    .map((b) => b.full ?? b.compact)
    .filter((e): e is IngestFileEntry => Boolean(e));
}

/**
 * Inspects a `.zip` file's central directory in ~5ms without decompressing media assets
 * and groups supported personal export files cleanly by service.
 */
export async function inspectZipArchive(zipFile: File): Promise<ZipArchiveGroup[]> {
  const reader = new ZipReader(new BlobReader(zipFile));
  try {
    const rawEntries = await reader.getEntries();
    const valid = rawEntries.filter(
      (e): e is Entry =>
        !e.directory &&
        (e.uncompressedSize ?? 0) > 0 &&
        !IGNORED_PATH_RE.test(e.filename.replace(/\\/g, '/')),
    );

    const groups = new Map<string, ZipArchiveGroup>();
    const fallbackEntries: IngestFileEntry[] = [];

    for (const entry of valid) {
      const cleanPath = entry.filename.replace(/\\/g, '/');
      const hit = classifyZipPath(cleanPath);
      const item: IngestFileEntry = {
        file: zipFile,
        relativePath: cleanPath,
        zipEntryPath: entry.filename,
        zipEntrySize: entry.uncompressedSize ?? zipFile.size,
      };

      if (hit) {
        const existing = groups.get(hit.groupId) ?? {
          groupId: hit.groupId,
          label: hit.label,
          entries: [],
          totalSizeBytes: 0,
        };
        existing.entries.push(item);
        existing.totalSizeBytes += entry.uncompressedSize ?? 0;
        groups.set(hit.groupId, existing);
      } else if (/\.(?:json|jsonl|ndjson|txt|js)$/i.test(cleanPath)) {
        fallbackEntries.push(item);
      }
    }

    // Deduplicate Antigravity transcript_full.jsonl vs transcript.jsonl inside ZIPs too.
    const agGroup = groups.get('antigravity');
    if (agGroup) {
      agGroup.entries = deduplicateAntigravityZipEntries(agGroup.entries);
      agGroup.totalSizeBytes = agGroup.entries.reduce(
        (sum, e) => sum + (e.zipEntrySize ?? 0),
        0,
      );
    }

    // Discard standalone Discord `index.json` if no `messages.json` accompanied it.
    const discordGroup = groups.get('discord');
    if (discordGroup && !discordGroup.entries.some((e) => /\/messages\.json$/i.test(e.relativePath ?? ''))) {
      groups.delete('discord');
    }

    if (groups.size > 0) {
      return Array.from(groups.values()).sort((a, b) => b.totalSizeBytes - a.totalSizeBytes);
    }

    if (fallbackEntries.length > 0) {
      return [
        {
          groupId: 'generic',
          label: `${zipFile.name} (${fallbackEntries.length})`,
          entries: fallbackEntries,
          totalSizeBytes: fallbackEntries.reduce((sum, e) => sum + (e.zipEntrySize ?? 0), 0),
        },
      ];
    }

    return [];
  } finally {
    await reader.close().catch(() => {});
  }
}

/**
 * Streams a single entry out of a ZIP Blob into a callback without buffering
 * the entire decompressed payload in memory.
 */
export async function withZipEntryStream<T>(
  zipFile: File,
  entryPath: string,
  consume: (stream: ReadableStream<Uint8Array>, uncompressedBytes: number) => Promise<T>,
): Promise<T> {
  const reader = new ZipReader(new BlobReader(zipFile));
  try {
    const entries = await reader.getEntries();
    const target = entries.find((e) => e.filename === entryPath);
    if (!target || target.directory || !target.getData) {
      throw new Error(`Archive entry not found: ${entryPath}`);
    }

    const ts = new TransformStream<Uint8Array, Uint8Array>();
    let extractError: unknown = null;
    const extractPromise = target.getData(ts.writable).catch((err: unknown) => {
      extractError = err;
      ts.writable.abort(err).catch(() => {});
    });

    try {
      const result = await consume(ts.readable, target.uncompressedSize ?? zipFile.size);
      await extractPromise;
      if (extractError) {
        throw extractError;
      }
      return result;
    } catch (err) {
      await ts.readable.cancel(err).catch(() => {});
      await extractPromise;
      throw err;
    }
  } finally {
    await reader.close().catch(() => {});
  }
}
