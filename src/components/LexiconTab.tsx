import { useState } from 'react';
import { Bot, Globe, HelpCircle, Smile, Sparkles, Type } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { LexiconMetrics } from '../types/domain';
import { formatLocalDate } from '../utils/format';

interface LexiconTabProps {
  lexicon: LexiconMetrics;
}

export function LexiconTab({ lexicon }: LexiconTabProps) {
  const { t } = useI18n();
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(
    lexicon.wordsByYear[0]?.year ?? 'ALL',
  );

  const activeYear: number | 'ALL' =
    selectedYear === 'ALL' || lexicon.wordsByYear.some((y) => y.year === selectedYear)
      ? selectedYear
      : (lexicon.wordsByYear[0]?.year ?? 'ALL');

  const displayedWords =
    activeYear === 'ALL'
      ? lexicon.topWords.slice(0, 18)
      : (lexicon.wordsByYear.find((y) => y.year === activeYear)?.words ?? lexicon.topWords.slice(0, 18));

  const maxWordCount = displayedWords.reduce((m, w) => Math.max(m, w.count), 0) || 1;
  const maxEmojiCount = lexicon.topEmojis.reduce((m, e) => Math.max(m, e.count), 0) || 1;

  return (
    <div className="space-y-6">
      {lexicon.chatgptLens && (
        <div className="rounded-lg border border-[#38BDF8]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#38BDF8]">
            <Bot className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">{t.lexicon.gptLensTitle}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.gptLensDesc}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.gptUserVsAssistant}</div>
              <div className="mt-1.5 font-mono text-sm font-bold text-slate-100">
                <span className="text-[#00FF9D]">
                  {lexicon.chatgptLens.userChars.toLocaleString()}
                </span>
                {' / '}
                <span className="text-[#38BDF8]">
                  {lexicon.chatgptLens.assistantChars.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
                <div
                  className="bg-[#00FF9D]"
                  style={{
                    width: `${
                      (lexicon.chatgptLens.userChars /
                        Math.max(1, lexicon.chatgptLens.userChars + lexicon.chatgptLens.assistantChars)) *
                      100
                    }%`,
                  }}
                />
                <div className="flex-1 bg-[#38BDF8]" />
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.gptPoliteness}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#00FF9D]">
                {lexicon.chatgptLens.politePromptPct}%
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.gptCodeDensity}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#38BDF8]">
                {lexicon.chatgptLens.codeBlockPct}%
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.gptRegenBranches}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#F59E0B]">
                {lexicon.chatgptLens.regeneratedBranches.toLocaleString()}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.gptPeakHour}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100">
                {String(lexicon.chatgptLens.peakPromptHour).padStart(2, '0')}:00
              </div>
            </div>
          </div>
        </div>
      )}

      {lexicon.chromeLens && (
        <div className="rounded-lg border border-[#F59E0B]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#F59E0B]">
            <Globe className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">{t.lexicon.chromeLensTitle}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.chromeLensDesc}</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.chromeTopDomains}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.chromeLens.topDomains.slice(0, 10).map((d) => (
                  <div key={d.domain} className="font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="truncate text-slate-200">{d.domain}</span>
                      <span className="text-[#00FF9D]">
                        {d.visits.toLocaleString()} ({d.sharePct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                      <div
                        className="h-full rounded-full bg-[#00FF9D]"
                        style={{ width: `${Math.min(100, d.sharePct * 2.5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.chromeTransitions}
              </h3>
              <div className="mt-3 space-y-2.5">
                {lexicon.chromeLens.transitions.map((tr) => (
                  <div
                    key={tr.transition}
                    className="flex items-center justify-between rounded border border-[#1E293B]/70 bg-[#0D1117] px-3 py-2 font-mono text-xs"
                  >
                    <span className="text-[#38BDF8]">{tr.transition}</span>
                    <span className="text-slate-200">
                      {tr.count.toLocaleString()} <span className="text-slate-500">({tr.sharePct}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.chromeRabbitHoles}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.chromeLens.rabbitHoles.slice(0, 8).map((rh, idx) => (
                  <div
                    key={`${rh.domain}-${rh.startTs}-${idx}`}
                    className="flex items-center justify-between rounded border border-[#1E293B]/70 bg-[#0D1117] px-3 py-2 font-mono text-xs"
                  >
                    <div>
                      <div className="text-slate-200">{rh.domain}</div>
                      <div className="text-[10px] text-slate-500">
                        {formatLocalDate(rh.startTs)}
                      </div>
                    </div>
                    <span className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 text-[#F59E0B]">
                      {rh.streakCount} {t.lexicon.streak}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-[#00FF9D]" />
                <h2 className="font-mono text-sm font-bold text-slate-100">
                  {activeYear === 'ALL' ? t.lexicon.topWordsTitle : t.lexicon.yearlyTitle}
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {activeYear === 'ALL' ? t.lexicon.topWordsDesc : t.lexicon.yearlyDesc}
              </p>
            </div>

            {lexicon.wordsByYear.length > 0 && (
              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedYear('ALL')}
                  className={`rounded border px-2 py-1 transition cursor-pointer ${
                    activeYear === 'ALL'
                      ? 'border-[#00FF9D] bg-[#00FF9D]/15 text-[#00FF9D]'
                      : 'border-[#1E293B] bg-[#07090D] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.lexicon.allYears}
                </button>
                {lexicon.wordsByYear.map((yr) => (
                  <button
                    key={yr.year}
                    type="button"
                    onClick={() => setSelectedYear(yr.year)}
                    className={`rounded border px-2 py-1 transition cursor-pointer ${
                      activeYear === yr.year
                        ? 'border-[#00FF9D] bg-[#00FF9D]/15 text-[#00FF9D]'
                        : 'border-[#1E293B] bg-[#07090D] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {yr.year}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {displayedWords.length === 0 ? (
              <div className="rounded border border-[#1E293B] bg-[#07090D] p-4 font-mono text-xs text-slate-500">
                —
              </div>
            ) : (
              displayedWords.map((item, idx) => {
                const widthPct = Math.max(6, Math.round((item.count / maxWordCount) * 100));
                return (
                  <div key={item.word} className="flex items-center gap-3 font-mono text-xs">
                    <span className="w-5 text-right text-slate-500">{idx + 1}</span>
                    <span className="w-28 truncate text-slate-200 sm:w-36">{item.word}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1E293B]">
                      <div
                        className="h-full bg-gradient-to-r from-[#00FF9D] to-[#38BDF8]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-[#00FF9D]">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
            <div className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-[#F59E0B]" />
              <h2 className="font-mono text-sm font-bold text-slate-100">
                {t.lexicon.emojiTitle}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.emojiDesc}</p>

            {lexicon.topEmojis.length === 0 ? (
              <div className="mt-4 rounded border border-[#1E293B] bg-[#07090D] p-4 font-mono text-xs text-slate-400">
                {t.lexicon.noEmojis}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {lexicon.topEmojis.slice(0, 16).map((e) => (
                  <div
                    key={e.emoji}
                    className="flex flex-col items-center rounded border border-[#1E293B] bg-[#07090D] p-2.5"
                  >
                    <span className="text-2xl">{e.emoji}</span>
                    <span className="mt-1 font-mono text-xs font-bold text-[#00FF9D]">
                      {e.count.toLocaleString()}
                    </span>
                    <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                      <div
                        className="h-full rounded-full bg-[#F59E0B]"
                        style={{ width: `${Math.round((e.count / maxEmojiCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#38BDF8]" />
              <h2 className="font-mono text-sm font-bold text-slate-100">
                {t.lexicon.questionsTitle}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.questionsDesc}</p>

            <div className="mt-4 space-y-2.5">
              {lexicon.questionRateBySender.map((q) => (
                <div
                  key={q.senderName}
                  className="flex items-center justify-between rounded border border-[#1E293B]/70 bg-[#07090D] px-3 py-2 font-mono text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#38BDF8]" />
                    <span className="text-slate-200">{q.senderName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      {q.questionCount.toLocaleString()} / {q.messageCount.toLocaleString()}
                    </span>
                    <span className="font-bold text-[#38BDF8]">
                      {q.questionPct} {t.lexicon.questionsPer100}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
