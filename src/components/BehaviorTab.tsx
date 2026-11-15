import { Clock, Flame, Moon, Repeat, Zap } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { BehaviorMetrics, ExportFormat } from '../types/domain';
import { formatLatency } from '../utils/format';

interface BehaviorTabProps {
  format: ExportFormat;
  behavior: BehaviorMetrics;
}

export function BehaviorTab({ format, behavior }: BehaviorTabProps) {
  const { t } = useI18n();
  const maxHourly = behavior.hourlyBreakdown.reduce((m, h) => Math.max(m, h.count), 0) || 1;
  const maxLatency = behavior.replyLatency.reduce((m, r) => Math.max(m, r.medianLatencySec), 0) || 1;

  const initiatorColors = ['#00FF9D', '#38BDF8', '#F59E0B', '#A855F7', '#EC4899'];

  return (
    <div className="space-y-6">
      {format === 'chrome_history' && (
        <div className="rounded-lg border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-4 py-3 font-mono text-xs text-[#38BDF8]">
          {t.behavior.chromeBehaviorNote}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#00FF9D]" />
            <h2 className="font-mono text-sm font-bold text-slate-100">
              {t.behavior.initiatorTitle}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.behavior.initiatorDesc}</p>

          {behavior.initiators.length === 0 ? (
            <div className="mt-6 rounded border border-[#1E293B] bg-[#07090D] p-4 font-mono text-xs text-slate-400">
              {t.behavior.noInitiatorData}
            </div>
          ) : (
            <>
              <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full border border-[#1E293B] bg-[#07090D]">
                {behavior.initiators.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.senderName}
                    style={{
                      width: `${item.sharePct}%`,
                      backgroundColor: initiatorColors[idx % initiatorColors.length],
                    }}
                    title={`${item.senderName}: ${item.sharePct}%`}
                    className="h-full transition-all"
                  />
                ))}
              </div>

              <div className="mt-4 space-y-2.5">
                {behavior.initiators.slice(0, 6).map((item, idx) => (
                  <div
                    key={item.senderName}
                    className="flex items-center justify-between rounded border border-[#1E293B]/70 bg-[#07090D] px-3 py-2 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: initiatorColors[idx % initiatorColors.length] }}
                      />
                      <span className="text-slate-200">{item.senderName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400">
                        {item.sessionsStarted.toLocaleString()} {t.behavior.sessionsStarted}
                      </span>
                      <span className="w-12 text-right font-bold text-[#00FF9D]">{item.sharePct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div>
            <div className="flex items-center gap-2 text-[#F59E0B]">
              <Moon className="h-4 w-4" />
              <h2 className="font-mono text-sm font-bold text-slate-100">
                {t.behavior.nightOwlScore}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">{t.behavior.nightOwlDesc}</p>
            <div className="mt-4 font-mono text-4xl font-bold text-[#F59E0B]">
              {behavior.nightOwlPct}%
            </div>
          </div>

          <div className="rounded-lg border border-[#1E293B] bg-[#07090D] p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t.behavior.peakHour}</span>
              <Flame className="h-4 w-4 text-[#00FF9D]" />
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#00FF9D]">
              {String(behavior.peakHour).padStart(2, '0')}:00 –{' '}
              {String((behavior.peakHour + 1) % 24).padStart(2, '0')}:00
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#38BDF8]" />
            <h2 className="font-mono text-sm font-bold text-slate-100">
              {t.behavior.latencyTitle}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.behavior.latencyDesc}</p>

          {behavior.replyLatency.length === 0 ? (
            <div className="mt-6 rounded border border-[#1E293B] bg-[#07090D] p-4 font-mono text-xs text-slate-400">
              {t.behavior.noReplyData}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {behavior.replyLatency.map((item) => {
                const widthPct = Math.max(8, Math.round((item.medianLatencySec / maxLatency) * 100));
                return (
                  <div
                    key={item.senderName}
                    className="rounded border border-[#1E293B]/70 bg-[#07090D] p-3"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-medium text-slate-200">{item.senderName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500">
                          {item.replyCount.toLocaleString()} {t.behavior.repliesCount}
                        </span>
                        <span className="font-bold text-[#38BDF8]">
                          {formatLatency(item.medianLatencySec)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
                      <div
                        className="h-full bg-[#38BDF8]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[#00FF9D]" />
            <h2 className="font-mono text-sm font-bold text-slate-100">
              {t.behavior.monologueTitle}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.behavior.monologueDesc}</p>

          {behavior.monologues.length === 0 ? (
            <div className="mt-6 rounded border border-[#1E293B] bg-[#07090D] p-4 font-mono text-xs text-slate-400">
              {t.behavior.noMonologueData}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-[#1E293B] text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">{t.overview.senderCol}</th>
                    <th className="px-3 py-2 text-right">{t.behavior.maxStreak}</th>
                    <th className="px-3 py-2 text-right">{t.behavior.avgTurn}</th>
                    <th className="py-2 pl-3 text-right">{t.behavior.monologues5Plus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]/60">
                  {behavior.monologues.map((m) => (
                    <tr key={m.senderName} className="hover:bg-[#111822]">
                      <td className="py-2.5 pr-3 text-slate-200">{m.senderName}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-[#00FF9D]">
                        {m.maxStreak}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{m.avgPerTurn}</td>
                      <td className="py-2.5 pl-3 text-right text-[#F59E0B]">
                        {m.monologues5Plus.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
        <div>
          <h2 className="font-mono text-sm font-bold text-slate-100">
            {t.behavior.circadianTitle}
          </h2>
          <p className="text-xs text-slate-400">{t.behavior.circadianDesc}</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox="0 0 740 180"
            className="min-w-[560px] w-full"
            role="img"
            aria-label={t.behavior.circadianTitle}
          >
            <line x1={20} y1={145} x2={720} y2={145} stroke="#1E293B" strokeWidth={1} />
            {behavior.hourlyBreakdown.map((bucket) => {
              const barW = 20;
              const gap = 9;
              const x = 24 + bucket.hour * (barW + gap);
              const h = Math.max(2, (bucket.count / maxHourly) * 120);
              const y = 145 - h;
              const isNight = bucket.hour >= 0 && bucket.hour <= 4;
              const isPeak = bucket.hour === behavior.peakHour;
              const fill = isPeak ? '#00FF9D' : isNight ? '#F59E0B' : '#38BDF8';

              return (
                <g key={bucket.hour}>
                  <title>{`${String(bucket.hour).padStart(2, '0')}:00 — ${bucket.count.toLocaleString()}`}</title>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={3}
                    fill={fill}
                    fillOpacity={isPeak ? 1 : 0.85}
                  />
                  <text
                    x={x + barW / 2}
                    y={163}
                    textAnchor="middle"
                    className="fill-slate-400 font-mono text-[10px]"
                  >
                    {String(bucket.hour).padStart(2, '0')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
