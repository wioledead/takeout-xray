import { useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  Cpu,
  FileJson,
  Globe,
  MessageSquare,
  ShieldCheck,
  Upload,
  Zap,
} from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { DemoKind, IngestionProgress } from '../types/domain';

interface DropZoneHeroProps {
  onSelectFile: (file: File) => void;
  onSelectDemo: (demo: DemoKind) => void;
  progress: IngestionProgress | null;
  isLoading: boolean;
  errorMessage: string | null;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function DropZoneHero({
  onSelectFile,
  onSelectDemo,
  progress,
  isLoading,
  errorMessage,
}: DropZoneHeroProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onSelectFile(file);
    }
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isLoading) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!isLoading) inputRef.current?.click();
        }}
        className={`relative overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all sm:p-12 ${
          isLoading
            ? 'cursor-wait border-[#00FF9D]/60 bg-[#0D1117]'
            : dragActive
              ? 'cursor-copy border-[#00FF9D] bg-[#00FF9D]/10 shadow-[0_0_40px_rgba(0,255,157,0.12)]'
              : 'cursor-pointer border-[#1E293B] bg-[#0D1117] hover:border-[#00FF9D]/60 hover:bg-[#111822]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onSelectFile(file);
              e.target.value = '';
            }
          }}
        />

        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[#00FF9D]/40 bg-[#00FF9D]/10 text-[#00FF9D]">
            {isLoading ? (
              <Cpu className="h-7 w-7 animate-spin" />
            ) : (
              <Upload className="h-7 w-7" />
            )}
          </div>

          <h1 className="font-mono text-lg font-bold tracking-wider text-slate-100 sm:text-2xl">
            {dragActive ? t.dropzone.dropActive : t.dropzone.title}
          </h1>

          <p className="mt-2 max-w-xl text-sm text-slate-400">{t.dropzone.subtitle}</p>

          {!isLoading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#00FF9D] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#07090D] transition hover:bg-[#00FF9D]/90 cursor-pointer"
            >
              <FileJson className="h-4 w-4" />
              {t.dropzone.browseBtn}
            </button>
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
        <div className="mb-3 flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-slate-400">
          <Zap className="h-3.5 w-3.5 text-[#00FF9D]" />
          <span>{t.dropzone.demoTitle}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onSelectDemo('telegram')}
            className="group flex flex-col items-start rounded-lg border border-[#1E293B] bg-[#0D1117] p-4 text-left transition hover:border-[#00FF9D]/60 hover:bg-[#111822] disabled:opacity-50 cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded border border-[#00FF9D]/30 bg-[#00FF9D]/10 text-[#00FF9D]">
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="font-mono text-[10px] text-[#00FF9D] opacity-75 group-hover:opacity-100">
                1-CLICK RUN →
              </span>
            </div>
            <h3 className="mt-3 font-mono text-sm font-bold text-slate-100">
              {t.dropzone.demoTgTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{t.dropzone.demoTgDesc}</p>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onSelectDemo('chatgpt')}
            className="group flex flex-col items-start rounded-lg border border-[#1E293B] bg-[#0D1117] p-4 text-left transition hover:border-[#38BDF8]/60 hover:bg-[#111822] disabled:opacity-50 cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded border border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]">
                <Bot className="h-4 w-4" />
              </span>
              <span className="font-mono text-[10px] text-[#38BDF8] opacity-75 group-hover:opacity-100">
                1-CLICK RUN →
              </span>
            </div>
            <h3 className="mt-3 font-mono text-sm font-bold text-slate-100">
              {t.dropzone.demoGptTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{t.dropzone.demoGptDesc}</p>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onSelectDemo('chrome')}
            className="group flex flex-col items-start rounded-lg border border-[#1E293B] bg-[#0D1117] p-4 text-left transition hover:border-[#F59E0B]/60 hover:bg-[#111822] disabled:opacity-50 cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]">
                <Globe className="h-4 w-4" />
              </span>
              <span className="font-mono text-[10px] text-[#F59E0B] opacity-75 group-hover:opacity-100">
                1-CLICK RUN →
              </span>
            </div>
            <h3 className="mt-3 font-mono text-sm font-bold text-slate-100">
              {t.dropzone.demoChromeTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{t.dropzone.demoChromeDesc}</p>
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <h2 className="font-mono text-xs font-bold tracking-wider text-slate-300">
            {t.dropzone.supportedTitle}
          </h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00FF9D]" />
              <span>{t.dropzone.supportedTg}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38BDF8]" />
              <span>{t.dropzone.supportedGpt}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F59E0B]" />
              <span>{t.dropzone.supportedChrome}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-[#00FF9D]/30 bg-[#00FF9D]/5 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-[#00FF9D]">
            <ShieldCheck className="h-4 w-4" />
            <span>{t.dropzone.privacyTitle}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">{t.dropzone.privacyDesc}</p>
        </div>
      </div>
    </div>
  );
}
