import { useState } from 'react';
import {
  AtSign,
  Bot,
  Film,
  Globe,
  HelpCircle,
  Music,
  PlayCircle,
  Smile,
  Sparkles,
  Terminal,
  Type,
} from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import type { ExportFormat, LexiconMetrics } from '../types/domain';
import { formatLocalDate } from '../utils/format';
import { getFormatProfile } from '../utils/formatProfile';

interface LexiconTabProps {
  format?: ExportFormat;
  lexicon: LexiconMetrics;
}

export function LexiconTab({ format, lexicon }: LexiconTabProps) {
  const { t } = useI18n();
  const profile = format ? getFormatProfile(format) : null;
  const showEmojis = lexicon.topEmojis.length > 0 || profile?.archetype === 'messenger';
  const showQuestions =
    (profile ? profile.hasQuestionRate : true) && lexicon.questionRateBySender.length > 0;
  const hasRightCol = showEmojis || showQuestions;
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
            <h2 className="font-mono text-sm font-bold">
              {format === 'claude_ai' ? t.lexicon.claudeAiLensTitle : t.lexicon.gptLensTitle}
            </h2>
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

      {lexicon.antigravityLens && (
        <div className="rounded-lg border border-[#A855F7]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#A855F7]">
            <Terminal className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">
              {format === 'claude_code' ? t.lexicon.claudeCodeLensTitle : t.lexicon.agLensTitle}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.agLensDesc}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.agPromptTokens}</div>
              <div className="mt-1.5 font-mono text-lg font-bold text-[#38BDF8]">
                {lexicon.antigravityLens.totalInputTokens.toLocaleString()}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.agCacheRead}</div>
              <div className="mt-1.5 font-mono text-lg font-bold text-[#00FF9D]">
                {lexicon.antigravityLens.totalCacheReadTokens.toLocaleString()}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.agOutputTokens}</div>
              <div className="mt-1.5 font-mono text-lg font-bold text-slate-100">
                {lexicon.antigravityLens.totalOutputTokens.toLocaleString()}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.agCacheHit}</div>
              <div className="mt-1.5 font-mono text-xl font-bold text-[#00FF9D]">
                {lexicon.antigravityLens.cacheHitPct}%
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
                <div
                  className="h-full bg-[#00FF9D]"
                  style={{ width: `${Math.min(100, lexicon.antigravityLens.cacheHitPct)}%` }}
                />
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.agToolsExecuted}</div>
              <div className="mt-1.5 font-mono text-xl font-bold text-[#A855F7]">
                {lexicon.antigravityLens.toolExecutions.toLocaleString()}
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                {lexicon.antigravityLens.plannerSteps.toLocaleString()} steps ·{' '}
                {lexicon.antigravityLens.checkpoints}/{lexicon.antigravityLens.errors}{' '}
                {t.lexicon.agCompactions}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.agThinkingVsReply}</div>
              <div className="mt-1.5 font-mono text-xs font-bold text-slate-100">
                <span className="text-[#A855F7]">
                  {lexicon.antigravityLens.thinkingChars.toLocaleString()}
                </span>
                {' / '}
                <span className="text-[#00FF9D]">
                  {lexicon.antigravityLens.replyChars.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
                <div
                  className="bg-[#A855F7]"
                  style={{
                    width: `${
                      (lexicon.antigravityLens.thinkingChars /
                        Math.max(
                          1,
                          lexicon.antigravityLens.thinkingChars +
                            lexicon.antigravityLens.replyChars,
                        )) *
                      100
                    }%`,
                  }}
                />
                <div className="flex-1 bg-[#00FF9D]" />
              </div>
            </div>
          </div>

          {lexicon.antigravityLens.topTools.length > 0 && (
            <div className="mt-5 rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.agTopTools}
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {lexicon.antigravityLens.topTools.map((tool) => (
                  <div key={tool.toolName} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="truncate text-slate-200">{tool.toolName}</span>
                      <span className="text-[#A855F7]">
                        {tool.calls.toLocaleString()} {t.lexicon.agCallsUnit} ({tool.sharePct}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1E293B]">
                      <div
                        className="h-full bg-gradient-to-r from-[#A855F7] to-[#38BDF8]"
                        style={{
                          width: `${
                            (tool.calls /
                              Math.max(1, lexicon.antigravityLens?.topTools[0]?.calls ?? 1)) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {lexicon.spotifyLens && (
        <div className="rounded-lg border border-[#10B981]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#10B981]">
            <Music className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">{t.lexicon.spotifyLensTitle}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.spotifyLensDesc}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.spotifyHours}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#10B981]">
                {lexicon.spotifyLens.totalHours.toLocaleString()}h
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.spotifyPlays}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#38BDF8]">
                {lexicon.spotifyLens.totalPlays.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.spotifyUniqueArtists}</div>
              <div className="mt-1.5 font-mono text-lg font-bold text-slate-100">
                {lexicon.spotifyLens.uniqueArtists.toLocaleString()} /{' '}
                {lexicon.spotifyLens.uniqueTracks.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.spotifySkipRate}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#F59E0B]">
                {lexicon.spotifyLens.skipPct}%
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.spotifyShuffleRate}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100">
                {lexicon.spotifyLens.shufflePct}%
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.spotifyTopArtists}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.spotifyLens.topArtists.slice(0, 10).map((artist) => {
                  const maxVal = Math.max(
                    1,
                    lexicon.spotifyLens?.topArtists[0]?.minutes ||
                      lexicon.spotifyLens?.topArtists[0]?.plays ||
                      1,
                  );
                  const val = artist.minutes > 0 ? artist.minutes : artist.plays;
                  return (
                    <div key={artist.name} className="font-mono text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-slate-200">{artist.name}</span>
                        <span className="shrink-0 text-[#10B981]">
                          {artist.minutes > 0
                            ? `${artist.minutes.toLocaleString()} ${t.lexicon.spotifyMinsUnit} · `
                            : ''}
                          {artist.plays.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                        <div
                          className="h-full rounded-full bg-[#10B981]"
                          style={{ width: `${Math.min(100, Math.round((val / maxVal) * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.spotifyTopTracks}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.spotifyLens.topTracks.slice(0, 10).map((track, idx) => (
                  <div
                    key={`${track.name}-${track.artist}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded border border-[#1E293B]/70 bg-[#0D1117] px-3 py-1.5 font-mono text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-slate-200">{track.name}</div>
                      {track.artist && (
                        <div className="truncate text-[10px] text-slate-500">{track.artist}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-[#38BDF8]">
                      {track.plays.toLocaleString()}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {lexicon.youtubeLens && (
        <div className="rounded-lg border border-[#F43F5E]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#F43F5E]">
            <PlayCircle className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">{t.lexicon.ytLensTitle}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.ytLensDesc}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ytTotalVideos}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#F43F5E]">
                {lexicon.youtubeLens.totalVideos.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ytUniqueChannels}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#38BDF8]">
                {lexicon.youtubeLens.uniqueChannels.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ytShortsShare}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#F59E0B]">
                {lexicon.youtubeLens.shortsPct}%{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({lexicon.youtubeLens.shortsCount.toLocaleString()})
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.ytTopChannels}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.youtubeLens.topChannels.slice(0, 10).map((ch) => (
                  <div key={ch.channel} className="font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="truncate text-slate-200">{ch.channel}</span>
                      <span className="text-[#F43F5E]">
                        {ch.videos.toLocaleString()} {t.lexicon.ytVideosUnit} ({ch.sharePct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#F43F5E] to-[#F59E0B]"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (ch.videos /
                                Math.max(1, lexicon.youtubeLens?.topChannels[0]?.videos ?? 1)) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.ytBingeStreaks}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.youtubeLens.bingeStreaks.slice(0, 8).map((bs, idx) => (
                  <div
                    key={`${bs.channel}-${bs.startTs}-${idx}`}
                    className="flex items-center justify-between rounded border border-[#1E293B]/70 bg-[#0D1117] px-3 py-2 font-mono text-xs"
                  >
                    <div>
                      <div className="text-slate-200">{bs.channel}</div>
                      <div className="text-[10px] text-slate-500">
                        {formatLocalDate(bs.startTs)}
                      </div>
                    </div>
                    <span className="rounded border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-2 py-0.5 text-[#F43F5E]">
                      {bs.streakCount} {t.lexicon.ytStreakUnit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {lexicon.tiktokLens && (
        <div className="rounded-lg border border-[#EC4899]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#EC4899]">
            <Film className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">{t.lexicon.ttLensTitle}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.ttLensDesc}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ttWatchedVideos}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#EC4899]">
                {lexicon.tiktokLens.totalVideos.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ttLikes}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#00FF9D]">
                {lexicon.tiktokLens.totalLikes.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ttLikeRate}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#38BDF8]">
                {lexicon.tiktokLens.likeRatePct}%
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ttSearches}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#F59E0B]">
                {lexicon.tiktokLens.totalSearches.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.ttUniqueCreators}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100">
                {lexicon.tiktokLens.uniqueCreators.toLocaleString()}
              </div>
            </div>
          </div>

          {(lexicon.tiktokLens.topCreators.length > 0 ||
            lexicon.tiktokLens.bingeStreaks.length > 0) && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {lexicon.tiktokLens.topCreators.length > 0 && (
                <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
                  <h3 className="font-mono text-xs font-bold text-slate-200">
                    {t.lexicon.ttTopCreators}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {lexicon.tiktokLens.topCreators.slice(0, 10).map((cr) => (
                      <div key={cr.creator} className="font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="truncate text-slate-200">{cr.creator}</span>
                          <span className="text-[#EC4899]">
                            {cr.videos.toLocaleString()} ({cr.sharePct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                          <div
                            className="h-full rounded-full bg-[#EC4899]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (cr.videos /
                                    Math.max(1, lexicon.tiktokLens?.topCreators[0]?.videos ?? 1)) *
                                    100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lexicon.tiktokLens.bingeStreaks.length > 0 && (
                <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
                  <h3 className="font-mono text-xs font-bold text-slate-200">
                    {t.lexicon.ttBingeStreaks}
                  </h3>
                  <div className="mt-3 space-y-2">
                    {lexicon.tiktokLens.bingeStreaks.slice(0, 8).map((bs, idx) => (
                      <div
                        key={`${bs.channel}-${bs.startTs}-${idx}`}
                        className="flex items-center justify-between rounded border border-[#1E293B]/70 bg-[#0D1117] px-3 py-2 font-mono text-xs"
                      >
                        <div>
                          <div className="text-slate-200">{bs.channel}</div>
                          <div className="text-[10px] text-slate-500">
                            {formatLocalDate(bs.startTs)}
                          </div>
                        </div>
                        <span className="rounded border border-[#EC4899]/40 bg-[#EC4899]/10 px-2 py-0.5 text-[#EC4899]">
                          {bs.streakCount} {t.lexicon.ytStreakUnit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lexicon.twitterLens && (
        <div className="rounded-lg border border-[#38BDF8]/40 bg-[#0D1117] p-5">
          <div className="flex items-center gap-2 text-[#38BDF8]">
            <AtSign className="h-4 w-4" />
            <h2 className="font-mono text-sm font-bold">{t.lexicon.twLensTitle}</h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{t.lexicon.twLensDesc}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.twOriginalPosts}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#00FF9D]">
                {lexicon.twitterLens.originalTweets.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.twReplies}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#38BDF8]">
                {lexicon.twitterLens.replyTweets.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.twRetweets}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#A855F7]">
                {lexicon.twitterLens.retweetTweets.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.twLikesGiven}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100">
                {lexicon.twitterLens.totalLikesGiven.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-[#1E293B] bg-[#07090D] p-3.5">
              <div className="text-[11px] text-slate-400">{t.lexicon.twLikesReceived}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#F43F5E]">
                {lexicon.twitterLens.totalLikesReceived.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {lexicon.twitterLens.topHandles.length > 0 && (
              <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
                <h3 className="font-mono text-xs font-bold text-slate-200">
                  {t.lexicon.twTopHandles}
                </h3>
                <div className="mt-3 space-y-2">
                  {lexicon.twitterLens.topHandles.slice(0, 8).map((h) => (
                    <div key={h.handle} className="font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="truncate text-slate-200">{h.handle}</span>
                        <span className="text-[#38BDF8]">
                          {h.count.toLocaleString()} ({h.sharePct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                        <div
                          className="h-full rounded-full bg-[#38BDF8]"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (h.count /
                                  Math.max(1, lexicon.twitterLens?.topHandles[0]?.count ?? 1)) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lexicon.twitterLens.topSources.length > 0 && (
              <div className="rounded border border-[#1E293B] bg-[#07090D] p-4">
                <h3 className="font-mono text-xs font-bold text-slate-200">
                  {t.lexicon.twTopSources}
                </h3>
                <div className="mt-3 space-y-2">
                  {lexicon.twitterLens.topSources.map((src) => (
                    <div key={src.source} className="font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="truncate text-slate-200">{src.source}</span>
                        <span className="text-[#00FF9D]">
                          {src.count.toLocaleString()} ({src.sharePct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-[#1E293B]">
                        <div
                          className="h-full rounded-full bg-[#00FF9D]"
                          style={{ width: `${Math.min(100, src.sharePct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {lexicon.twitterLens.topViralPosts.length > 0 && (
            <div className="mt-4 rounded border border-[#1E293B] bg-[#07090D] p-4">
              <h3 className="font-mono text-xs font-bold text-slate-200">
                {t.lexicon.twTopViral}
              </h3>
              <div className="mt-3 space-y-2">
                {lexicon.twitterLens.topViralPosts.slice(0, 5).map((vp, idx) => (
                  <div
                    key={`${vp.ts}-${idx}`}
                    className="flex items-start justify-between gap-3 rounded border border-[#1E293B]/70 bg-[#0D1117] px-3 py-2.5 font-mono text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-slate-200">{vp.text}</div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {vp.kind.toUpperCase()} · {formatLocalDate(vp.ts)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-2 py-0.5 text-[#F43F5E]">
                      ❤️ {vp.likes.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`grid gap-6 ${hasRightCol ? 'lg:grid-cols-2' : ''}`}>
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

        {hasRightCol && (
          <div className="space-y-6">
            {showEmojis && (
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
            )}

            {showQuestions && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
