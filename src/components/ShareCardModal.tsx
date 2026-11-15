import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, EyeOff, ShieldCheck, Terminal, X } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { DashboardSnapshot } from '../types/domain';
import { formatLatency, formatLocalDate } from '../utils/format';

interface ShareCardModalProps {
  snapshot: DashboardSnapshot;
  onClose: () => void;
}

export function ShareCardModal({ snapshot, onClose }: ShareCardModalProps) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [anonymize, setAnonymize] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { format, selectedThreadId, overview, behavior, lexicon } = snapshot;

  // Build deterministic anonymization lookup
  const aliasMap = new Map<string, string>();
  let seq = 1;
  const anonymizeName = (name: string): string => {
    if (!anonymize) return name;
    const existing = aliasMap.get(name);
    if (existing) return existing;
    const alias = `Subject_${String(seq++).padStart(2, '0')}`;
    aliasMap.set(name, alias);
    return alias;
  };

  const activeThreadTitle =
    selectedThreadId === 'ALL'
      ? t.app.allThreads
      : (overview.threads.find((th) => th.thread_id === selectedThreadId)?.title ?? selectedThreadId);

  const displayThread = anonymize ? 'Thread_REDACTED' : activeThreadTitle;
  const topInitiator = behavior.initiators[0];
  const fastestResponder = [...behavior.replyLatency].sort(
    (a, b) => a.medianLatencySec - b.medianLatencySec,
  )[0];

  // Mini 24x7 heatmap lookup
  const heatLookup = new Map<string, number>();
  let maxHeat = 0;
  for (const cell of overview.heatmap) {
    heatLookup.set(`${cell.dow}-${cell.hour}`, cell.count);
    if (cell.count > maxHeat) maxHeat = cell.count;
  }

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#07090D',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `takeout-xray-${format}-${anonymize ? 'anon' : 'wrapped'}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError(t.shareModal.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#1E293B] bg-[#0D1117] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] px-5 py-3.5">
          <div>
            <h2 className="font-mono text-sm font-bold text-slate-100">{t.shareModal.title}</h2>
            <p className="text-xs text-slate-400">{t.shareModal.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAnonymize((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-xs transition cursor-pointer ${
                anonymize
                  ? 'border-[#00FF9D] bg-[#00FF9D]/15 text-[#00FF9D]'
                  : 'border-[#1E293B] bg-[#07090D] text-slate-300 hover:border-slate-500'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              {t.shareModal.anonymize}
            </button>

            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-1.5 rounded bg-[#00FF9D] px-3.5 py-1.5 font-mono text-xs font-bold text-[#07090D] transition hover:bg-[#00FF9D]/90 disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? t.shareModal.exporting : t.shareModal.downloadPng}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.shareModal.close}
              className="rounded border border-[#1E293B] p-1.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {exportError && (
          <div className="border-b border-[#F59E0B]/40 bg-[#F59E0B]/10 px-5 py-2 font-mono text-xs text-[#F59E0B]">
            {exportError}
          </div>
        )}

        <div className="overflow-auto bg-[#05070A] p-4 sm:p-6">
          <div className="mx-auto w-fit overflow-hidden rounded-lg border border-[#1E293B] shadow-2xl">
            {/* Fixed 540x675 canvas -> exports cleanly at 1080x1350 with pixelRatio: 2 */}
            <div
              ref={cardRef}
              style={{ width: 540, height: 675 }}
              className="relative flex flex-col justify-between bg-[#07090D] p-7 text-slate-100"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded border border-[#00FF9D]/40 bg-[#00FF9D]/10 text-[#00FF9D]">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold tracking-widest text-[#00FF9D]">
                        TAKEOUT // X-RAY
                      </div>
                      <div className="font-mono text-[10px] tracking-wider text-slate-400">
                        {t.shareModal.cardHeader}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="rounded border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-2 py-0.5 text-[10px] font-bold text-[#38BDF8]">
                      {t.formats[format]}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {formatLocalDate(overview.firstEventTs)} → {formatLocalDate(overview.lastEventTs)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-400">{t.app.threadLabel}:</span>
                  <span className="max-w-[360px] truncate font-bold text-slate-100">
                    {displayThread}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] uppercase text-slate-400">
                      {format === 'chrome_history' ? t.overview.totalVisits : t.overview.totalEvents}
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-[#00FF9D]">
                      {overview.totalEvents.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] uppercase text-slate-400">
                      {t.overview.totalWords}
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-[#38BDF8]">
                      {overview.totalWords.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] uppercase text-slate-400">
                      {t.overview.activeDays}
                    </div>
                    <div className="mt-1 font-mono text-xl font-bold text-[#F59E0B]">
                      {overview.activeDays.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 font-mono">
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] text-slate-400">{t.shareModal.topInitiator}</div>
                    <div className="mt-1 truncate text-sm font-bold text-slate-100">
                      {topInitiator
                        ? `${anonymizeName(topInitiator.senderName)} (${topInitiator.sharePct}%)`
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] text-slate-400">{t.shareModal.replySpeed}</div>
                    <div className="mt-1 truncate text-sm font-bold text-[#38BDF8]">
                      {fastestResponder
                        ? `${anonymizeName(fastestResponder.senderName)} · ${formatLatency(fastestResponder.medianLatencySec)}`
                        : '—'}
                    </div>
                  </div>
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] text-slate-400">{t.shareModal.nightOwl}</div>
                    <div className="mt-1 text-sm font-bold text-[#F59E0B]">
                      {behavior.nightOwlPct}%
                    </div>
                  </div>
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] text-slate-400">{t.shareModal.peakHour}</div>
                    <div className="mt-1 text-sm font-bold text-[#00FF9D]">
                      {String(behavior.peakHour).padStart(2, '0')}:00
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded border border-[#1E293B] bg-[#0D1117] p-3">
                  <svg viewBox="0 0 480 84" className="w-full">
                    {Array.from({ length: 7 }, (_, dIdx) =>
                      Array.from({ length: 24 }, (_, h) => {
                        const c = heatLookup.get(`${dIdx + 1}-${h}`) ?? 0;
                        const ratio = maxHeat > 0 ? c / maxHeat : 0;
                        const fill =
                          c === 0
                            ? '#111822'
                            : ratio < 0.25
                              ? '#064E3B'
                              : ratio < 0.55
                                ? '#059669'
                                : '#00FF9D';
                        return (
                          <rect
                            key={`${dIdx}-${h}`}
                            x={h * 20}
                            y={dIdx * 12}
                            width={17}
                            height={9}
                            rx={2}
                            fill={fill}
                          />
                        );
                      }),
                    )}
                  </svg>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] uppercase text-slate-400">
                      {t.shareModal.topWords}
                    </div>
                    <div className="mt-2 space-y-1">
                      {lexicon.topWords.length > 0 ? (
                        lexicon.topWords.slice(0, 5).map((w, idx) => (
                          <div key={w.word} className="flex justify-between">
                            <span className="truncate text-slate-200">
                              {idx + 1}. {w.word}
                            </span>
                            <span className="text-[#00FF9D]">{w.count.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500">—</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded border border-[#1E293B] bg-[#0D1117] p-3">
                    <div className="text-[10px] uppercase text-slate-400">
                      {lexicon.chromeLens
                        ? t.shareModal.topDomains
                        : t.shareModal.topEmojis}
                    </div>
                    {lexicon.chromeLens ? (
                      <div className="mt-2 space-y-1">
                        {lexicon.chromeLens.topDomains.slice(0, 5).map((d, idx) => (
                          <div key={d.domain} className="flex justify-between">
                            <span className="truncate text-slate-200">
                              {idx + 1}. {d.domain}
                            </span>
                            <span className="text-[#F59E0B]">{d.visits}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {lexicon.topEmojis.length > 0 ? (
                          <div className="flex flex-wrap gap-2 text-lg">
                            {lexicon.topEmojis.slice(0, 6).map((e) => (
                              <span
                                key={e.emoji}
                                className="inline-flex items-center gap-1 rounded border border-[#1E293B] bg-[#07090D] px-2 py-0.5 text-xs"
                              >
                                <span>{e.emoji}</span>
                                <span className="text-[#00FF9D]">{e.count}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-500">—</div>
                        )}
                        {lexicon.chatgptLens && (
                          <div className="pt-1 text-[11px] text-[#38BDF8]">
                            {t.shareModal.gptPolite}: {lexicon.chatgptLens.politePromptPct}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1E293B] pt-3 font-mono text-[10px] text-[#00FF9D]">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{t.shareModal.cardFooter}</span>
                </div>
                <span className="text-slate-500">1080×1350</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
