import { useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  Archive,
  AtSign,
  BookOpen,
  Bot,
  Cpu,
  FileJson,
  Film,
  FolderOpen,
  Globe,
  Hash,
  MessageCircle,
  MessageSquare,
  Music,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  Zap,
} from 'lucide-react';
import { EXPORT_GUIDES, type GuideServiceId } from '../i18n/exportGuides';
import { useI18n } from '../i18n/useI18n';
import type { DemoKind, IngestionProgress } from '../types/domain';
import type { IngestFileEntry } from '../types/rpc';
import {
  collectDroppedFiles,
  collectInputFiles,
  prepareIngestSelection,
} from '../utils/antigravityFiles';
import { formatBytes } from '../utils/format';
import { inspectZipArchive, type ZipArchiveGroup } from '../utils/zipExtractor';
import { ExportGuidesModal } from './ExportGuidesModal';

interface DropZoneHeroProps {
  onSelectFiles: (entries: IngestFileEntry[]) => void;
  onSelectDemo: (demo: DemoKind) => void;
  progress: IngestionProgress | null;
  isLoading: boolean;
  errorMessage: string | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function DropZoneHero({
  onSelectFiles,
  onSelectDemo,
  progress,
  isLoading,
  errorMessage,
}: DropZoneHeroProps) {
  const { lang, t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [guideService, setGuideService] = useState<GuideServiceId | null>(null);
  const [inspectingZip, setInspectingZip] = useState(false);
  const [pendingZip, setPendingZip] = useState<{
    archiveName: string;
    groups: ZipArchiveGroup[];
  } | null>(null);

  const busy = isLoading || inspectingZip;

  const processSelection = async (rawEntries: IngestFileEntry[]) => {
    if (busy || rawEntries.length === 0) return;

    if (rawEntries.length === 1 && /\.zip$/i.test(rawEntries[0].file.name)) {
      const zipFile = rawEntries[0].file;
      setInspectingZip(true);
      setPendingZip(null);
      try {
        const groups = await inspectZipArchive(zipFile);
        if (groups.length === 0) {
          onSelectFiles([rawEntries[0]]);
        } else if (groups.length === 1) {
          onSelectFiles(groups[0].entries);
        } else {
          setPendingZip({ archiveName: zipFile.name, groups });
        }
      } catch {
        onSelectFiles([rawEntries[0]]);
      } finally {
        setInspectingZip(false);
      }
      return;
    }

    setPendingZip(null);
    const prepared = prepareIngestSelection(rawEntries);
    if (prepared.length > 0) {
      onSelectFiles(prepared);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (busy) return;
    const rawEntries = await collectDroppedFiles(e.dataTransfer);
    await processSelection(rawEntries);
  };

  const pct =
    progress && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.bytesRead / progress.totalBytes) * 100))
      : 0;

  const rowsPerSec =
    progress && progress.elapsedMs > 50
      ? Math.round((progress.rowsIngested / progress.elapsedMs) * 1000)
      : 0;

  const phaseText = progress
    ? progress.phase === 'detecting'
      ? t.dropzone.phaseDetecting
      : progress.phase === 'streaming'
        ? t.dropzone.phaseStreaming
        : progress.phase === 'indexing'
          ? t.dropzone.phaseIndexing
          : t.dropzone.phaseReady
    : '';

  const demos: Array<{
    id: DemoKind;
    title: string;
    desc: string;
    fileHint: string;
    accent: string;
    borderClass: string;
    icon: typeof Terminal;
  }> = [
    {
      id: 'antigravity',
      title: t.dropzone.demoAgTitle,
      desc: t.dropzone.demoAgDesc,
      fileHint: 'brain/ · transcript*.jsonl',
      accent: 'text-[#A855F7]',
      borderClass: 'border-[#A855F7]/40 hover:border-[#A855F7]/80',
      icon: Terminal,
    },
    {
      id: 'claude_code',
      title: t.dropzone.demoClaudeCodeTitle,
      desc: t.dropzone.demoClaudeCodeDesc,
      fileHint: '~/.claude/projects/*.jsonl',
      accent: 'text-[#C084FC]',
      borderClass: 'border-[#C084FC]/40 hover:border-[#C084FC]/80',
      icon: Cpu,
    },
    {
      id: 'chatgpt',
      title: t.dropzone.demoGptTitle,
      desc: t.dropzone.demoGptDesc,
      fileHint: 'conversations.json / .zip',
      accent: 'text-[#38BDF8]',
      borderClass: 'border-[#1E293B] hover:border-[#38BDF8]/60',
      icon: Bot,
    },
    {
      id: 'claude_ai',
      title: t.dropzone.demoClaudeAiTitle,
      desc: t.dropzone.demoClaudeAiDesc,
      fileHint: 'conversations.json / .zip',
      accent: 'text-[#60A5FA]',
      borderClass: 'border-[#1E293B] hover:border-[#60A5FA]/60',
      icon: Sparkles,
    },
    {
      id: 'telegram',
      title: t.dropzone.demoTgTitle,
      desc: t.dropzone.demoTgDesc,
      fileHint: 'result.json / .zip',
      accent: 'text-[#00FF9D]',
      borderClass: 'border-[#1E293B] hover:border-[#00FF9D]/60',
      icon: MessageSquare,
    },
    {
      id: 'whatsapp',
      title: t.dropzone.demoWaTitle,
      desc: t.dropzone.demoWaDesc,
      fileHint: '_chat.txt / .zip',
      accent: 'text-[#22C55E]',
      borderClass: 'border-[#1E293B] hover:border-[#22C55E]/60',
      icon: MessageCircle,
    },
    {
      id: 'discord',
      title: t.dropzone.demoDiscordTitle,
      desc: t.dropzone.demoDiscordDesc,
      fileHint: 'messages/*.json / .zip',
      accent: 'text-[#818CF8]',
      borderClass: 'border-[#1E293B] hover:border-[#818CF8]/60',
      icon: Hash,
    },
    {
      id: 'twitter',
      title: t.dropzone.demoTwitterTitle,
      desc: t.dropzone.demoTwitterDesc,
      fileHint: 'data/tweets.js / .zip',
      accent: 'text-[#38BDF8]',
      borderClass: 'border-[#38BDF8]/40 hover:border-[#38BDF8]/80',
      icon: AtSign,
    },
    {
      id: 'spotify',
      title: t.dropzone.demoSpotifyTitle,
      desc: t.dropzone.demoSpotifyDesc,
      fileHint: 'Streaming_History_*.json',
      accent: 'text-[#10B981]',
      borderClass: 'border-[#10B981]/40 hover:border-[#10B981]/80',
      icon: Music,
    },
    {
      id: 'youtube',
      title: t.dropzone.demoYtTitle,
      desc: t.dropzone.demoYtDesc,
      fileHint: 'watch-history.json / .zip',
      accent: 'text-[#F43F5E]',
      borderClass: 'border-[#F43F5E]/40 hover:border-[#F43F5E]/80',
      icon: PlayCircle,
    },
    {
      id: 'tiktok',
      title: t.dropzone.demoTiktokTitle,
      desc: t.dropzone.demoTiktokDesc,
      fileHint: 'user_data_tiktok.json',
      accent: 'text-[#FB7185]',
      borderClass: 'border-[#FB7185]/40 hover:border-[#FB7185]/80',
      icon: Film,
    },
    {
      id: 'chrome',
      title: t.dropzone.demoChromeTitle,
      desc: t.dropzone.demoChromeDesc,
      fileHint: 'History.json / .zip',
      accent: 'text-[#F59E0B]',
      borderClass: 'border-[#1E293B] hover:border-[#F59E0B]/60',
      icon: Globe,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          void handleDrop(e);
        }}
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
        className={`relative overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all sm:p-12 ${
          busy
            ? 'cursor-wait border-[#00FF9D]/60 bg-[#0D1117]'
            : dragActive
              ? 'cursor-copy border-[#00FF9D] bg-[#00FF9D]/10 shadow-[0_0_40px_rgba(0,255,157,0.12)]'
              : 'cursor-pointer border-[#1E293B] bg-[#0D1117] hover:border-[#00FF9D]/60 hover:bg-[#111822]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.json,.js,.jsonl,.ndjson,.txt,application/zip,application/json,application/javascript,text/javascript,text/plain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const entries = collectInputFiles(e.target.files);
              e.target.value = '';
              void processSelection(entries);
            }
          }}
        />
        <input
          ref={(el) => {
            folderInputRef.current = el;
            if (el) {
              el.setAttribute('webkitdirectory', '');
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const entries = collectInputFiles(e.target.files);
              e.target.value = '';
              void processSelection(entries);
            }
          }}
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[#00FF9D]/40 bg-[#00FF9D]/10 text-[#00FF9D]">
            {busy ? <Cpu className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
          </div>

          <h1 className="font-mono text-lg font-bold tracking-wider text-slate-100 sm:text-2xl">
            {inspectingZip
              ? t.dropzone.zipInspecting
              : dragActive
                ? t.dropzone.dropActive
                : t.dropzone.title}
          </h1>

          <p className="mt-2 max-w-xl text-sm text-slate-400">{t.dropzone.subtitle}</p>

          {!busy && (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-[#00FF9D] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#07090D] transition hover:bg-[#00FF9D]/90 cursor-pointer"
                >
                  <FileJson className="h-4 w-4" />
                  {t.dropzone.browseBtn}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    folderInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-[#38BDF8]/60 bg-[#38BDF8]/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#38BDF8] transition hover:bg-[#38BDF8]/20 cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t.dropzone.browseFolderBtn}
                </button>
              </div>

              <div onClick={(e) => e.stopPropagation()} className="mt-4">
                <button
                  type="button"
                  onClick={() => setGuideService('antigravity')}
                  className="inline-flex items-center gap-2 rounded-md border border-[#1E293B] bg-[#07090D] px-3.5 py-1.5 font-mono text-[11px] text-slate-300 transition hover:border-[#00FF9D]/60 hover:text-[#00FF9D] cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#00FF9D]" />
                  <span>{t.dropzone.openGuidesBtn}</span>
                </button>
              </div>
            </>
          )}

          {isLoading && progress && (
            <div className="mt-6 w-full max-w-lg rounded-lg border border-[#1E293B] bg-[#07090D] p-4 text-left">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-[#00FF9D]">{phaseText}</span>
                <span className="text-slate-300">{pct}%</span>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#1E293B]">
                <div
                  className="h-full bg-gradient-to-r from-[#00FF9D] to-[#38BDF8] transition-all duration-150"
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="rounded border border-[#1E293B] bg-[#0D1117] px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-500">{t.dropzone.rowsProcessed}</div>
                  <div className="text-slate-100">{formatNumber(progress.rowsIngested)}</div>
                </div>
                <div className="rounded border border-[#1E293B] bg-[#0D1117] px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-500">{t.dropzone.throughput}</div>
                  <div className="text-[#38BDF8]">{formatNumber(rowsPerSec)} rows/s</div>
                </div>
                <div className="rounded border border-[#1E293B] bg-[#0D1117] px-2.5 py-1.5">
                  <div className="text-[10px] text-slate-500">{t.dropzone.threadsFound}</div>
                  <div className="text-[#00FF9D]">{formatNumber(progress.threadsFound)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingZip && !busy && (
        <div className="mt-4 rounded-lg border border-[#38BDF8]/50 bg-[#0D1117] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#38BDF8]">
              <Archive className="h-4 w-4" />
              <span>
                {t.dropzone.zipMultiTitle}: {pendingZip.archiveName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPendingZip(null)}
              className="rounded border border-[#1E293B] px-2.5 py-1 font-mono text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {t.dropzone.zipCancel}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">{t.dropzone.zipMultiDesc}</p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {pendingZip.groups.map((grp) => (
              <button
                key={grp.groupId}
                type="button"
                onClick={() => {
                  const chosen = grp.entries;
                  setPendingZip(null);
                  onSelectFiles(chosen);
                }}
                className="flex items-center justify-between rounded border border-[#1E293B] bg-[#07090D] px-3.5 py-2.5 text-left font-mono text-xs transition hover:border-[#00FF9D]/60 hover:bg-[#111822] cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="truncate font-bold text-slate-100">{grp.label}</div>
                  <div className="text-[10px] text-slate-500">
                    {grp.entries.length} {t.dropzone.zipFilesUnit} · {formatBytes(grp.totalSizeBytes)}
                  </div>
                </div>
                <span className="shrink-0 text-[#00FF9D]">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#F59E0B]/50 bg-[#F59E0B]/10 p-4 font-mono text-xs text-[#F59E0B]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-bold">{t.dropzone.errorPrefix}: </span>
            <span className="text-amber-200">{errorMessage}</span>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-1.5 flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-slate-300">
          <Zap className="h-3.5 w-3.5 text-[#00FF9D]" />
          <span>{t.dropzone.demoTitle}</span>
        </div>
        <p className="mb-4 text-xs text-slate-400">{t.dropzone.demoSubtitle}</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {demos.map((demo) => {
            const Icon = demo.icon;
            return (
              <button
                key={demo.id}
                type="button"
                disabled={busy}
                onClick={() => onSelectDemo(demo.id)}
                className={`group flex flex-col items-start rounded-lg border bg-[#0D1117] p-3.5 text-left transition hover:bg-[#111822] disabled:opacity-50 cursor-pointer ${demo.borderClass}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border border-current/30 bg-current/10 ${demo.accent}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold opacity-75 group-hover:opacity-100 ${demo.accent}`}
                  >
                    {t.dropzone.demoRunBadge}
                  </span>
                </div>
                <h3 className="mt-2.5 font-mono text-xs font-bold text-slate-100">{demo.title}</h3>
                <code className="mt-1 rounded border border-[#1E293B] bg-[#07090D] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {demo.fileHint}
                </code>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{demo.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-xs font-bold tracking-wider text-slate-300">
              {t.dropzone.supportedTitle}
            </h2>
            <button
              type="button"
              onClick={() => setGuideService('antigravity')}
              className="inline-flex items-center gap-1.5 rounded border border-[#1E293B] bg-[#07090D] px-2.5 py-1 font-mono text-[10px] text-[#00FF9D] transition hover:border-[#00FF9D]/60 cursor-pointer"
            >
              <BookOpen className="h-3 w-3" />
              <span>{t.dropzone.guidesModalTitle.split('·')[0].trim()}</span>
            </button>
          </div>

          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A855F7]" />
              <span>{t.dropzone.supportedAgents}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00FF9D]" />
              <span>{t.dropzone.supportedChats}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38BDF8]" />
              <span>{t.dropzone.supportedAiChats}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F59E0B]" />
              <span>{t.dropzone.supportedMedia}</span>
            </li>
          </ul>

          <div className="mt-4 border-t border-[#1E293B]/70 pt-3">
            <div className="mb-2 font-mono text-[10px] text-slate-500">
              {t.dropzone.guidesClickHint}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_GUIDES[lang].map((guide) => (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => setGuideService(guide.id)}
                  className="inline-flex items-center gap-1.5 rounded border border-[#1E293B] bg-[#07090D] px-2 py-1 font-mono text-[10px] text-slate-300 transition hover:border-[#00FF9D]/50 hover:text-white cursor-pointer"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: guide.badgeColor }}
                  />
                  <span>{guide.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#00FF9D]/30 bg-[#00FF9D]/5 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-[#00FF9D]">
            <ShieldCheck className="h-4 w-4" />
            <span>{t.dropzone.privacyTitle}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">{t.dropzone.privacyDesc}</p>
        </div>
      </div>

      {guideService && (
        <ExportGuidesModal
          initialService={guideService}
          onClose={() => setGuideService(null)}
        />
      )}
    </div>
  );
}
