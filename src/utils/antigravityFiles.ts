import type { IngestFileEntry } from '../types/rpc';

interface WebkitFileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (success: (file: File) => void, error?: (err: DOMException) => void) => void;
  createReader?: () => WebkitDirectoryReader;
}

interface WebkitDirectoryReader {
  readEntries: (
    success: (entries: WebkitFileSystemEntry[]) => void,
    error?: (err: DOMException) => void,
  ) => void;
}

const ANTIGRAVITY_TRANSCRIPT_RE = /(?:^|[\\/])(transcript(?:_full)?)\.jsonl$/i;
const SUPPORTED_EXT_RE = /\.(?:json|jsonl|ndjson|txt|js|zip)$/i;
const IGNORED_PATH_RE = /(?:^|[\\/])(?:__MACOSX|node_modules|\.git)(?:[\\/]|$)/i;

function readEntryFile(entry: WebkitFileSystemEntry): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) {
      resolve(null);
      return;
    }
    entry.file(
      (file) => resolve(file),
      () => resolve(null),
    );
  });
}

function readAllDirectoryEntries(reader: WebkitDirectoryReader): Promise<WebkitFileSystemEntry[]> {
  return new Promise((resolve) => {
    const collected: WebkitFileSystemEntry[] = [];
    const step = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(collected);
            return;
          }
          collected.push(...batch);
          step();
        },
        () => resolve(collected),
      );
    };
    step();
  });
}

async function walkEntry(
  entry: WebkitFileSystemEntry,
  out: IngestFileEntry[],
): Promise<void> {
  if (entry.isFile) {
    const file = await readEntryFile(entry);
    if (file) {
      out.push({
        file,
        relativePath: entry.fullPath.replace(/^\/+/, '') || file.name,
      });
    }
    return;
  }

  if (entry.isDirectory && entry.createReader) {
    const children = await readAllDirectoryEntries(entry.createReader());
    for (const child of children) {
      await walkEntry(child, out);
    }
  }
}

/**
 * Collects files from a drop event, walking nested folders when `webkitGetAsEntry()`
 * is available (such as dragging `~/.gemini/antigravity/brain`).
 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<IngestFileEntry[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .map((item): WebkitFileSystemEntry | null => {
      const withEntry = item as unknown as {
        webkitGetAsEntry?: () => WebkitFileSystemEntry | null;
      };
      return typeof withEntry.webkitGetAsEntry === 'function' ? withEntry.webkitGetAsEntry() : null;
    })
    .filter((entry): entry is WebkitFileSystemEntry => entry !== null);

  if (entries.some((e) => e.isDirectory)) {
    const walked: IngestFileEntry[] = [];
    for (const entry of entries) {
      await walkEntry(entry, walked);
    }
    return walked;
  }

  return Array.from(dataTransfer.files ?? []).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

/** Converts an `<input type="file">` FileList (single, multi-file, or `webkitdirectory`) into entries. */
export function collectInputFiles(fileList: FileList | File[]): IngestFileEntry[] {
  return Array.from(fileList).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

/**
 * Filters a file/folder selection down to ingestible archives and deduplicates Antigravity's
 * `transcript_full.jsonl` vs `transcript.jsonl` pairs inside the same conversation directory.
 */
export function prepareIngestSelection(rawEntries: IngestFileEntry[]): IngestFileEntry[] {
  const nonEmpty = rawEntries.filter(
    (e) => e.file.size > 0 && !IGNORED_PATH_RE.test(e.relativePath || e.file.name),
  );
  if (nonEmpty.length === 0) return [];

  if (nonEmpty.length === 1) {
    return nonEmpty;
  }

  // Prioritize Antigravity transcripts when present (e.g. a dropped `brain/` folder),
  // deduplicating `transcript_full.jsonl` vs `transcript.jsonl` in each conversation directory.
  const transcriptEntries = nonEmpty.filter((e) => {
    const p = e.relativePath || e.file.name;
    return ANTIGRAVITY_TRANSCRIPT_RE.test(p);
  });

  if (transcriptEntries.length > 0) {
    const byDir = new Map<string, { full?: IngestFileEntry; compact?: IngestFileEntry }>();

    for (const entry of transcriptEntries) {
      const normPath = (entry.relativePath || entry.file.name).replace(/\\/g, '/');
      const lastSlash = normPath.lastIndexOf('/');
      const dirKey = lastSlash >= 0 ? normPath.slice(0, lastSlash) : '';
      const isFull = /\/transcript_full\.jsonl$/i.test(normPath) || /^transcript_full\.jsonl$/i.test(normPath);

      const bucket = byDir.get(dirKey) ?? {};
      if (isFull) {
        bucket.full = entry;
      } else {
        bucket.compact = entry;
      }
      byDir.set(dirKey, bucket);
    }

    return Array.from(byDir.values())
      .map((b) => b.full ?? b.compact)
      .filter((e): e is IngestFileEntry => Boolean(e))
      .sort((a, b) => (a.relativePath || a.file.name).localeCompare(b.relativePath || b.file.name));
  }

  // Handle dropped Discord Data Package folders (`messages/c*/messages.json` + `messages/index.json`).
  const discordMessages = nonEmpty.filter((e) =>
    /(?:^|[\\/])messages[\\/]c?\d+[\\/]messages\.json$/i.test(e.relativePath || e.file.name),
  );
  if (discordMessages.length > 0) {
    const indexEntry = nonEmpty.find((e) =>
      /(?:^|[\\/])messages[\\/]index\.json$/i.test(e.relativePath || e.file.name),
    );
    return indexEntry ? [indexEntry, ...discordMessages] : discordMessages;
  }

  // Fallback for multiple arbitrary supported files selected/dropped together (Spotify, WhatsApp, Claude Code, etc.)
  const supported = nonEmpty.filter((e) => SUPPORTED_EXT_RE.test(e.file.name));
  return supported.length > 0 ? supported : nonEmpty;
}
