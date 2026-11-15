import { useState } from 'react';
import {
  Activity,
  Download,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { ExportFormat, NormalizedThread } from '../types/domain';
import type { NetworkTelemetryState } from '../utils/networkGuard';

interface HeaderTelemetryProps {
  format: ExportFormat | null;
  threads: NormalizedThread[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
  onReset: () => void;
  onOpenWrapped: () => void;
  networkState: NetworkTelemetryState;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function HeaderTelemetry({
  format,
  threads,
  selectedThreadId,
  onSelectThread,
  onReset,
  onOpenWrapped,
  networkState,
}: HeaderTelemetryProps) {
  const { lang, setLang, t } = useI18n();
  const [auditOpen, setAuditOpen] = useState(false);

  const isClean = networkState.isZeroExfiltration;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#1E293B] bg-[#07090D]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#00FF9D]/40 bg-[#00FF9D]/10 text-[#00FF9D]">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-slate-100 sm:text-base">
                  {t.app.brand}
                </span>
                <span className="hidden rounded border border-[#1E293B] bg-[#0D1117] px-1.5 py-0.5 font-mono text-[10px] text-[#38BDF8] sm:inline-block">
                  {t.app.localBadge}
                </span>
              </div>
              <p className="hidden text-xs text-slate-400 md:block">{t.app.tagline}</p>
            </div>
          </div>

          {format && (
            <div className="order-3 flex w-full flex-wrap items-center gap-2 border-t border-[#1E293B]/70 pt-2 lg:order-2 lg:w-auto lg:border-t-0 lg:pt-0">
              <span className="inline-flex items-center gap-1.5 rounded border border-[#00FF9D]/30 bg-[#00FF9D]/10 px-2.5 py-1 font-mono text-xs font-medium text-[#00FF9D]">
                <Activity className="h-3.5 w-3.5" />
                {t.formats[format]}
              </span>

              {threads.length > 1 && (
                <label className="flex items-center gap-1.5 rounded border border-[#1E293B] bg-[#0D1117] px-2 py-1 text-xs">
                  <span className="font-mono text-[10px] uppercase text-slate-400">
                    {t.app.threadLabel}:
                  </span>
                  <select
                    aria-label={t.app.threadLabel}
                    value={selectedThreadId}
                    onChange={(e) => onSelectThread(e.target.value)}
                    className="max-w-[180px] bg-transparent font-mono text-xs text-slate-100 outline-none sm:max-w-[240px]"
                  >
                    <option value="ALL" className="bg-[#0D1117] text-slate-100">
                      {t.app.allThreads} ({threads.length})
                    </option>
                    {threads.map((th) => (
                      <option key={th.thread_id} value={th.thread_id} className="bg-[#0D1117] text-slate-100">
                        {th.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={onOpenWrapped}
                className="inline-flex items-center gap-1.5 rounded border border-[#38BDF8]/50 bg-[#38BDF8]/10 px-2.5 py-1 font-mono text-xs font-medium text-[#38BDF8] transition hover:bg-[#38BDF8]/20 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                {t.app.wrappedBtn}
              </button>

              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded border border-[#1E293B] bg-[#0D1117] px-2.5 py-1 font-mono text-xs text-slate-300 transition hover:border-slate-500 hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t.app.loadNewBtn}
              </button>
            </div>
          )}

          <div className="order-2 flex items-center gap-2 lg:order-3">
            <button
              type="button"
              onClick={() => setAuditOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium transition cursor-pointer ${
                isClean
                  ? 'border-[#00FF9D]/40 bg-[#00FF9D]/10 text-[#00FF9D] hover:bg-[#00FF9D]/20'
                  : 'border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#F59E0B] hover:bg-[#F59E0B]/25'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isClean ? 'bg-[#00FF9D] animate-pulse' : 'bg-[#F59E0B]'
                }`}
              />
              <Lock className="h-3 w-3 hidden sm:inline" />
              <span>
                {isClean
                  ? t.app.zeroBytesSent
                  : networkState.bytesSentAfterLoad > 0
                    ? `${formatBytes(networkState.bytesSentAfterLoad)} ${t.app.bytesSentLabel}`
                    : `${networkState.externalRequestsCount} ${t.app.extReqAlert}`}
              </span>
            </button>

            <div
              role="group"
              aria-label="Language switch"
              className="inline-flex rounded border border-[#1E293B] bg-[#0D1117] p-0.5 font-mono text-xs"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded px-2 py-0.5 transition cursor-pointer ${
                  lang === 'en'
                    ? 'bg-[#00FF9D] font-bold text-[#07090D]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ru')}
                className={`rounded px-2 py-0.5 transition cursor-pointer ${
                  lang === 'ru'
                    ? 'bg-[#00FF9D] font-bold text-[#07090D]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                RU
              </button>
            </div>
          </div>
        </div>
      </header>

      {auditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setAuditOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg border border-[#1E293B] bg-[#0D1117] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#1E293B] px-5 py-4">
              <div>
                <h2 className="font-mono text-sm font-bold tracking-wide text-slate-100">
                  {t.networkModal.title}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">{t.networkModal.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setAuditOpen(false)}
                className="rounded border border-[#1E293B] p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div
                className={`flex items-center gap-3 rounded-md border px-4 py-3 font-mono text-xs ${
                  isClean
                    ? 'border-[#00FF9D]/40 bg-[#00FF9D]/10 text-[#00FF9D]'
                    : 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]'
                }`}
              >
                {isClean ? (
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                ) : (
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                )}
                <span>{isClean ? t.networkModal.statusClean : t.networkModal.statusAlert}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border border-[#1E293B] bg-[#07090D] p-3">
                  <div className="text-[11px] text-slate-400">{t.networkModal.bytesSent}</div>
                  <div className="mt-1 font-mono text-lg font-bold text-[#00FF9D]">
                    {formatBytes(networkState.bytesSentAfterLoad)}
                  </div>
                </div>
                <div className="rounded border border-[#1E293B] bg-[#07090D] p-3">
                  <div className="text-[11px] text-slate-400">{t.networkModal.externalRequests}</div>
                  <div className="mt-1 font-mono text-lg font-bold text-[#38BDF8]">
                    {networkState.externalRequestsCount}
                  </div>
                </div>
                <div className="rounded border border-[#1E293B] bg-[#07090D] p-3">
                  <div className="text-[11px] text-slate-400">{t.networkModal.observedCount}</div>
                  <div className="mt-1 font-mono text-lg font-bold text-slate-200">
                    {networkState.logEntries.length}
                  </div>
                </div>
              </div>

              <div className="max-h-64 overflow-auto rounded border border-[#1E293B] bg-[#07090D]">
                {networkState.logEntries.length === 0 ? (
                  <div className="p-6 text-center font-mono text-xs text-slate-400">
                    {t.networkModal.emptyLog}
                  </div>
                ) : (
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="sticky top-0 border-b border-[#1E293B] bg-[#0D1117] text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">{t.networkModal.colTime}</th>
                        <th className="px-3 py-2">{t.networkModal.colKind}</th>
                        <th className="px-3 py-2">{t.networkModal.colUrl}</th>
                        <th className="px-3 py-2 text-right">{t.networkModal.colBytes}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]/60">
                      {networkState.logEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#111822]">
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">
                            {entry.timestamp}
                          </td>
                          <td className="px-3 py-1.5 uppercase text-[#38BDF8]">{entry.kind}</td>
                          <td className="max-w-[260px] truncate px-3 py-1.5 text-slate-300">
                            {entry.url}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right text-[#00FF9D]">
                            {formatBytes(entry.bytesSent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setAuditOpen(false)}
                  className="rounded border border-[#1E293B] bg-[#111822] px-4 py-1.5 font-mono text-xs text-slate-200 hover:border-slate-500 cursor-pointer"
                >
                  {t.networkModal.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
