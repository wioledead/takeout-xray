import { useState } from 'react';
import { Calendar, GitBranch, Hash, Image, Layers, MessageCircle } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { ExportFormat, OverviewMetrics } from '../types/domain';
import { formatLocalDate } from '../utils/format';

interface OverviewTabProps {
  format: ExportFormat;
  overview: OverviewMetrics;
}

function getHeatmapColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return '#111822';
  const ratio = count / maxCount;
  if (ratio < 0.25) return '#064E3B';
  if (ratio < 0.5) return '#059669';
  if (ratio < 0.75) return '#10B981';
  return '#00FF9D';
}

export function OverviewTab({ format, overview }: OverviewTabProps) {
  const { t } = useI18n();
  const [hoveredCell, setHoveredCell] = useState<{
    dow: number;
    hour: number;
    count: number;
  } | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<{ bucket: string; count: number } | null>(null);

  const cellLookup = new Map<string, number>();
  let maxHeat = 0;
  for (const cell of overview.heatmap) {
    cellLookup.set(`${cell.dow}-${cell.hour}`, cell.count);
    if (cell.count > maxHeat) maxHeat = cell.count;
  }

  const maxTimeline = overview.timeline.reduce((m, b) => Math.max(m, b.count), 0) || 1;
  const firstDateStr = formatLocalDate(overview.firstEventTs);
  const lastDateStr = formatLocalDate(overview.lastEventTs);

  const kpiCards = [
    {
      label: format === 'chrome_history' ? t.overview.totalVisits : t.overview.totalEvents,
      value: overview.totalEvents.toLocaleString(),
      accent: 'text-[#00FF9D]',
      icon: MessageCircle,
    },
    {
      label: t.overview.activeDays,
      value: overview.activeDays.toLocaleString(),
      accent: 'text-[#38BDF8]',
      icon: Calendar,
    },
    {
      label: t.overview.totalWords,
      value: overview.totalWords.toLocaleString(),
      accent: 'text-slate-100',
      icon: Hash,
    },
    {
      label:
        format === 'chatgpt'
          ? t.overview.regeneratedBranches
          : format === 'tg_chat' || format === 'tg_account'
            ? t.overview.serviceEvents
            : t.overview.mediaAttachments,
      value: (
        format === 'chatgpt'
          ? overview.extraBranchCount
          : format === 'tg_chat' || format === 'tg_account'
            ? overview.totalServiceEvents
            : overview.totalMedia
      ).toLocaleString(),
      accent: 'text-[#F59E0B]',
      icon: format === 'chatgpt' ? GitBranch : Image,
    },
    {
      label: t.overview.threadsCount,
      value: overview.totalThreads.toLocaleString(),
      accent: 'text-slate-100',
      icon: Layers,
    },
    {
      label: t.overview.dateSpan,
      value: (
        <span className="flex flex-wrap items-baseline gap-x-1.5 leading-snug">
          <span className="whitespace-nowrap">{firstDateStr}</span>
          <span className="text-slate-500">→</span>
          <span className="whitespace-nowrap">{lastDateStr}</span>
        </span>
      ),
      accent: 'text-slate-200 text-xs sm:text-sm',
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-4 transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="truncate">{card.label}</span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              </div>
              <div className={`mt-2 font-mono text-xl font-bold ${card.accent}`}>{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-mono text-sm font-bold text-slate-100">{t.overview.heatmapTitle}</h2>
            <p className="text-xs text-slate-400">{t.overview.heatmapDesc}</p>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            {hoveredCell && (
              <span className="rounded border border-[#00FF9D]/40 bg-[#00FF9D]/10 px-2.5 py-1 text-[#00FF9D]">
                {t.overview.daysShort[hoveredCell.dow - 1]} ·{' '}
                {String(hoveredCell.hour).padStart(2, '0')}:00 —{' '}
                {hoveredCell.count.toLocaleString()}
              </span>
            )}
            <div className="flex items-center gap-1 text-slate-400">
              <span>{t.overview.less}</span>
              {['#111822', '#064E3B', '#059669', '#10B981', '#00FF9D'].map((color) => (
                <span
                  key={color}
                  className="inline-block h-3 w-3 rounded-xs border border-[#1E293B]"
                  style={{ backgroundColor: color }}
                />
              ))}
              <span>{t.overview.more}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <svg
            viewBox="0 0 780 218"
            className="min-w-[640px] w-full select-none"
            role="img"
            aria-label={t.overview.heatmapTitle}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <text
                key={`h-${hour}`}
                x={56 + hour * 30 + 12}
                y={14}
                textAnchor="middle"
                className="fill-slate-500 font-mono text-[10px]"
              >
                {String(hour).padStart(2, '0')}
              </text>
            ))}

            {t.overview.daysShort.map((dayLabel, dayIdx) => {
              const dow = dayIdx + 1;
              const y = 24 + dayIdx * 27;
              return (
                <g key={dayLabel}>
                  <text
                    x={42}
                    y={y + 16}
                    textAnchor="end"
                    className="fill-slate-400 font-mono text-[11px]"
                  >
                    {dayLabel}
                  </text>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = cellLookup.get(`${dow}-${hour}`) ?? 0;
                    const x = 56 + hour * 30;
                    const fill = getHeatmapColor(count, maxHeat);
                    const isHovered =
                      hoveredCell?.dow === dow && hoveredCell?.hour === hour;
                    return (
                      <rect
                        key={`${dow}-${hour}`}
                        x={x}
                        y={y}
                        width={25}
                        height={22}
                        rx={3}
                        fill={fill}
                        stroke={isHovered ? '#38BDF8' : '#1E293B'}
                        strokeWidth={isHovered ? 1.5 : 0.75}
                        className="cursor-pointer transition-opacity hover:opacity-90"
                        onMouseEnter={() => setHoveredCell({ dow, hour, count })}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-mono text-sm font-bold text-slate-100">
                {t.overview.timelineTitle}
              </h2>
              <p className="text-xs text-slate-400">{t.overview.timelineDesc}</p>
            </div>
            {hoveredBucket && (
              <span className="rounded border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-2.5 py-1 font-mono text-xs text-[#38BDF8]">
                {hoveredBucket.bucket}: {hoveredBucket.count.toLocaleString()}
              </span>
            )}
          </div>

          <div className="mt-4">
            {overview.timeline.length === 0 ? (
              <div className="py-12 text-center font-mono text-xs text-slate-500">—</div>
            ) : (
              <svg viewBox="0 0 600 190" className="w-full" role="img" aria-label={t.overview.timelineTitle}>
                <line x1={32} y1={155} x2={588} y2={155} stroke="#1E293B" strokeWidth={1} />
                {overview.timeline.map((item, idx) => {
                  const plotWidth = 550;
                  const step = plotWidth / overview.timeline.length;
                  const barWidth = Math.max(3, Math.min(28, step * 0.72));
                  const barHeight = Math.max(2, (item.count / maxTimeline) * 135);
                  const x = 35 + idx * step + (step - barWidth) / 2;
                  const y = 155 - barHeight;
                  const showLabel =
                    overview.timeline.length <= 12 ||
                    idx === 0 ||
                    idx === overview.timeline.length - 1 ||
                    idx % Math.ceil(overview.timeline.length / 6) === 0;

                  return (
                    <g key={item.bucket}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx={2}
                        fill={hoveredBucket?.bucket === item.bucket ? '#00FF9D' : '#38BDF8'}
                        fillOpacity={hoveredBucket?.bucket === item.bucket ? 1 : 0.8}
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredBucket(item)}
                        onMouseLeave={() => setHoveredBucket(null)}
                      />
                      {showLabel && (
                        <text
                          x={x + barWidth / 2}
                          y={174}
                          textAnchor="middle"
                          className="fill-slate-500 font-mono text-[9px]"
                        >
                          {item.bucket}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div>
            <h2 className="font-mono text-sm font-bold text-slate-100">
              {t.overview.participantsTitle}
            </h2>
            <p className="text-xs text-slate-400">{t.overview.participantsDesc}</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-[#1E293B] text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-3">{t.overview.senderCol}</th>
                  <th className="px-3 py-2 text-right">{t.overview.eventsCol}</th>
                  <th className="px-3 py-2 text-right">{t.overview.wordsCol}</th>
                  <th className="py-2 pl-3 text-right">{t.overview.shareCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60">
                {overview.topSenders.map((sender, idx) => (
                  <tr key={sender.senderName} className="hover:bg-[#111822]">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              idx === 0 ? '#00FF9D' : idx === 1 ? '#38BDF8' : '#F59E0B',
                          }}
                        />
                        <span className="max-w-[160px] truncate text-slate-200">
                          {sender.senderName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-200">
                      {sender.eventCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      {sender.wordCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[#1E293B] sm:block">
                          <div
                            className="h-full bg-[#00FF9D]"
                            style={{ width: `${Math.min(100, sender.sharePct)}%` }}
                          />
                        </div>
                        <span className="w-11 text-right text-[#00FF9D]">{sender.sharePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
