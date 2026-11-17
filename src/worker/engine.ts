import type {
  AntigravityLensMetrics,
  BehaviorMetrics,
  ChatGptLensMetrics,
  ChromeLensMetrics,
  DashboardSnapshot,
  ExportFormat,
  LexiconMetrics,
  NormalizedAntigravityStep,
  NormalizedEvent,
  NormalizedMediaEvent,
  NormalizedThread,
  OverviewMetrics,
  SpotifyLensMetrics,
  SqlCellValue,
  SqlQueryResult,
  TikTokLensMetrics,
  TwitterLensMetrics,
  YearlyWords,
  YouTubeLensMetrics,
} from '../types/domain';
import {
  buildLocalTsMacroSql,
  computeOffsetSegments,
  type TimeZoneSpec,
} from './localTime';
import {
  buildBehaviorSql,
  buildLexiconSql,
  buildOverviewSql,
  validateReadOnlySql,
} from './queries.sql';
import {
  CREATE_TABLES_SQL,
  RESET_SESSION_TABLES_SQL,
  STOPWORDS_LIST,
} from './schema.sql';

export interface DuckDBTableLike {
  schema: { fields: Array<{ name: string }> };
  numRows: number;
  get?(index: number): { toJSON(): Record<string, unknown> } | null;
  toArray(): Array<{ toJSON(): Record<string, unknown> }>;
}

export interface DuckDBBackend {
  registerFileText(name: string, text: string): Promise<void>;
  dropFile(name: string): Promise<void>;
  query(sql: string): Promise<DuckDBTableLike>;
}

function serializeSqlValue(val: unknown): SqlCellValue {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean' || typeof val === 'string') return val;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'bigint') {
    const asNum = Number(val);
    return Number.isSafeInteger(asNum) ? asNum : val.toString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (val instanceof Uint8Array) {
    return Array.from(val)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (typeof val === 'object' && 'toArray' in val && typeof (val as { toArray: unknown }).toArray === 'function') {
    const arr = Array.from((val as { toArray(): unknown[] }).toArray()).map((item) =>
      serializeSqlValue(item),
    );
    return JSON.stringify(arr);
  }
  if (Array.isArray(val)) {
    return JSON.stringify(val.map((item) => serializeSqlValue(item)));
  }
  return String(val);
}

function toNum(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val === 'bigint') return Number(val);
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'bigint') return Number(val);
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRows(table: DuckDBTableLike): Array<Record<string, unknown>> {
  return table.toArray().map((row) => row.toJSON());
}

export class XRayEngine {
  private readonly backend: DuckDBBackend;
  private initialized = false;
  private batchCounter = 0;
  private activeFormat: ExportFormat | null = null;

  constructor(backend: DuckDBBackend) {
    this.backend = backend;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.backend.query(CREATE_TABLES_SQL);

    const stopCountRows = extractRows(
      await this.backend.query('SELECT COUNT(*) AS c FROM stopwords;'),
    );
    const existingStopwords = toNum(stopCountRows[0]?.c, 0);
    if (existingStopwords === 0) {
      const stopNdjson = STOPWORDS_LIST.map((w) => JSON.stringify({ word: w })).join('\n');
      const stopFile = `stopwords_seed_${this.batchCounter++}.ndjson`;
      await this.backend.registerFileText(stopFile, stopNdjson);
      try {
        await this.backend.query(`
          INSERT OR IGNORE INTO stopwords
          SELECT word FROM read_json('${stopFile}',
            format = 'newline_delimited',
            columns = { word: 'VARCHAR' }
          );
        `);
      } finally {
        await this.backend.dropFile(stopFile);
      }
    }

    await this.backend.query(
      buildLocalTsMacroSql([{ startMs: Number.NEGATIVE_INFINITY, offsetMs: 0 }]),
    );
    await this.backend.query(
      'SET autoinstall_known_extensions = false; SET autoload_known_extensions = false;',
    );

    this.initialized = true;
  }

  private async updateLocalTimeMacro(spec: TimeZoneSpec): Promise<void> {
    const row = extractRows(
      await this.backend.query('SELECT MIN(ts_ms) AS min_ts, MAX(ts_ms) AS max_ts FROM events;'),
    )[0];
    const segments = computeOffsetSegments(
      toOptNum(row?.min_ts),
      toOptNum(row?.max_ts),
      spec,
    );
    await this.backend.query(buildLocalTsMacroSql(segments));
  }

  async resetSession(format?: ExportFormat): Promise<void> {
    await this.init();
    await this.backend.query(RESET_SESSION_TABLES_SQL);
    this.activeFormat = format ?? null;
  }

  setActiveFormat(format: ExportFormat): void {
    this.activeFormat = format;
  }

  private async insertNdjsonBatch(
    tableName: string,
    columnsSql: string,
    rows: unknown[],
    orIgnore = false,
  ): Promise<void> {
    if (rows.length === 0) return;
    const batchName = `${tableName}_batch_${this.batchCounter++}.ndjson`;
    const ndjson = rows.map((row) => JSON.stringify(row)).join('\n');
    await this.backend.registerFileText(batchName, ndjson);
    try {
      const insertClause = orIgnore ? `INSERT OR IGNORE INTO ${tableName}` : `INSERT INTO ${tableName}`;
      await this.backend.query(`
        ${insertClause}
        SELECT * FROM read_json('${batchName}',
          format = 'newline_delimited',
          columns = {
            ${columnsSql}
          }
        );
      `);
    } finally {
      await this.backend.dropFile(batchName);
    }
  }

  async ingestBatch(
    threads: NormalizedThread[],
    events: NormalizedEvent[],
    steps: NormalizedAntigravityStep[] = [],
    media: NormalizedMediaEvent[] = [],
  ): Promise<void> {
    await this.init();

    await this.insertNdjsonBatch(
      'threads',
      `thread_id: 'VARCHAR',
       source_type: 'VARCHAR',
       title: 'VARCHAR',
       thread_kind: 'VARCHAR',
       extra_count: 'INTEGER'`,
      threads,
      true,
    );

    await this.insertNdjsonBatch(
      'events',
      `event_id: 'VARCHAR',
       thread_id: 'VARCHAR',
       source_type: 'VARCHAR',
       event_kind: 'VARCHAR',
       ts_ms: 'BIGINT',
       sender_id: 'VARCHAR',
       sender_name: 'VARCHAR',
       text_content: 'VARCHAR',
       char_count: 'INTEGER',
       word_count: 'INTEGER',
       question_count: 'INTEGER',
       has_code: 'BOOLEAN',
       has_media: 'BOOLEAN',
       emojis: 'VARCHAR[]',
       domain: 'VARCHAR',
       meta_subtype: 'VARCHAR'`,
      events,
    );

    await this.insertNdjsonBatch(
      'antigravity_steps',
      `step_id: 'VARCHAR',
       thread_id: 'VARCHAR',
       step_index: 'INTEGER',
       step_type: 'VARCHAR',
       ts_ms: 'BIGINT',
       input_tokens: 'BIGINT',
       cache_read_tokens: 'BIGINT',
       output_tokens: 'BIGINT',
       thinking_chars: 'INTEGER',
       reply_chars: 'INTEGER',
       tool_call_count: 'INTEGER',
       tool_names: 'VARCHAR[]'`,
      steps,
    );

    await this.insertNdjsonBatch(
      'media_events',
      `media_id: 'VARCHAR',
       thread_id: 'VARCHAR',
       source_type: 'VARCHAR',
       ts_ms: 'BIGINT',
       creator_name: 'VARCHAR',
       item_title: 'VARCHAR',
       album_or_sub: 'VARCHAR',
       ms_played: 'BIGINT',
       is_skipped: 'BOOLEAN',
       is_shuffle: 'BOOLEAN',
       platform: 'VARCHAR'`,
      media,
    );
  }

  async getDashboardSnapshot(
    threadId: string,
    tzOffsetMs: number,
    timeZone?: string,
  ): Promise<DashboardSnapshot> {
    await this.init();
    const scope = { threadId: threadId || 'ALL', tzOffsetMs, timeZone };
    await this.updateLocalTimeMacro({ tzOffsetMs, timeZone });

    let format = this.activeFormat;
    if (!format) {
      const fmtRows = extractRows(
        await this.backend.query('SELECT source_type FROM events LIMIT 1;'),
      );
      format = (fmtRows[0]?.source_type as ExportFormat | undefined) ?? 'tg_chat';
      this.activeFormat = format;
    }

    const [overview, behavior, lexicon] = await Promise.all([
      this.fetchOverview(scope),
      this.fetchBehavior(scope),
      this.fetchLexicon(scope, format),
    ]);

    return {
      format,
      selectedThreadId: scope.threadId,
      overview,
      behavior,
      lexicon,
    };
  }

  private async fetchOverview(scope: { threadId: string; tzOffsetMs: number }): Promise<OverviewMetrics> {
    const sql = buildOverviewSql(scope);
    const [kpiTable, branchTable, heatmapTable, sendersTable, threadsTable] = await Promise.all([
      this.backend.query(sql.kpis),
      this.backend.query(sql.extraBranches),
      this.backend.query(sql.heatmap),
      this.backend.query(sql.topSenders),
      this.backend.query(sql.threadsList),
    ]);

    const kpi = extractRows(kpiTable)[0] ?? {};
    const branchRow = extractRows(branchTable)[0] ?? {};

    const firstEventTs = toOptNum(kpi.first_event_ts);
    const lastEventTs = toOptNum(kpi.last_event_ts);
    const spanMs = firstEventTs !== null && lastEventTs !== null ? lastEventTs - firstEventTs : 0;
    const useDaily = spanMs > 0 && spanMs < 60 * 24 * 3600 * 1000;

    const timelineTable = await this.backend.query(
      useDaily ? sql.timelineDaily : sql.timelineMonthly,
    );

    const totalEvents = toNum(kpi.total_events);
    const senderRows = extractRows(sendersTable);
    const nonServiceTotal = toNum(kpi.non_service_events) || totalEvents || 1;

    return {
      totalEvents,
      totalThreads: toNum(kpi.total_threads),
      totalWords: toNum(kpi.total_words),
      totalChars: toNum(kpi.total_chars),
      totalMedia: toNum(kpi.total_media),
      totalServiceEvents: toNum(kpi.total_service_events),
      activeDays: toNum(kpi.active_days),
      firstEventTs,
      lastEventTs,
      extraBranchCount: toNum(branchRow.extra_branch_count),
      heatmap: extractRows(heatmapTable).map((r) => ({
        dow: toNum(r.dow),
        hour: toNum(r.hour),
        count: toNum(r.count),
      })),
      timeline: extractRows(timelineTable).map((r) => ({
        bucket: String(r.bucket ?? ''),
        count: toNum(r.count),
      })),
      topSenders: senderRows.map((r) => {
        const count = toNum(r.eventCount);
        return {
          senderName: String(r.senderName ?? 'Unknown'),
          eventCount: count,
          wordCount: toNum(r.wordCount),
          charCount: toNum(r.charCount),
          sharePct: Number(((count * 100) / nonServiceTotal).toFixed(1)),
        };
      }),
      threads: extractRows(threadsTable).map((r) => ({
        thread_id: String(r.thread_id),
        source_type: r.source_type as ExportFormat,
        title: String(r.title),
        thread_kind: r.thread_kind as NormalizedThread['thread_kind'],
        extra_count: toNum(r.extra_count),
      })),
    };
  }

  private async fetchBehavior(scope: { threadId: string; tzOffsetMs: number }): Promise<BehaviorMetrics> {
    const sql = buildBehaviorSql(scope);
    const [initTable, latencyTable, monoTable, hourlyTable] = await Promise.all([
      this.backend.query(sql.initiators),
      this.backend.query(sql.replyLatency),
      this.backend.query(sql.monologues),
      this.backend.query(sql.hourly),
    ]);

    const initRows = extractRows(initTable);
    const totalSessions = initRows.reduce((acc, r) => acc + toNum(r.sessionsStarted), 0) || 1;

    const hourMap = new Map<number, number>();
    for (const r of extractRows(hourlyTable)) {
      hourMap.set(toNum(r.hour), toNum(r.count));
    }

    const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourMap.get(hour) ?? 0,
    }));

    const totalHourly = hourlyBreakdown.reduce((acc, h) => acc + h.count, 0) || 1;
    const nightCount = hourlyBreakdown
      .filter((h) => h.hour >= 0 && h.hour <= 4)
      .reduce((acc, h) => acc + h.count, 0);

    let peakHour = 0;
    let peakCount = -1;
    for (const h of hourlyBreakdown) {
      if (h.count > peakCount) {
        peakCount = h.count;
        peakHour = h.hour;
      }
    }

    return {
      initiators: initRows.map((r) => {
        const sessionsStarted = toNum(r.sessionsStarted);
        return {
          senderName: String(r.senderName ?? 'Unknown'),
          sessionsStarted,
          sharePct: Number(((sessionsStarted * 100) / totalSessions).toFixed(1)),
        };
      }),
      replyLatency: extractRows(latencyTable).map((r) => ({
        senderName: String(r.senderName ?? 'Unknown'),
        medianLatencySec: toNum(r.medianLatencySec),
        replyCount: toNum(r.replyCount),
      })),
      monologues: extractRows(monoTable).map((r) => ({
        senderName: String(r.senderName ?? 'Unknown'),
        maxStreak: toNum(r.maxStreak),
        avgPerTurn: toNum(r.avgPerTurn),
        monologues5Plus: toNum(r.monologues5Plus),
      })),
      hourlyBreakdown,
      nightOwlPct: Number(((nightCount * 100) / totalHourly).toFixed(1)),
      peakHour,
    };
  }

  private async fetchLexicon(
    scope: { threadId: string; tzOffsetMs: number },
    format: ExportFormat,
  ): Promise<LexiconMetrics> {
    const sql = buildLexiconSql(scope);
    const [wordsTable, yearlyTable, emojisTable, questionsTable] = await Promise.all([
      this.backend.query(sql.topWords),
      this.backend.query(sql.wordsByYear),
      this.backend.query(sql.topEmojis),
      this.backend.query(sql.questionRate),
    ]);

    const yearGroups = new Map<number, Array<{ word: string; count: number }>>();
    for (const r of extractRows(yearlyTable)) {
      const year = toNum(r.year);
      const list = yearGroups.get(year) ?? [];
      list.push({ word: String(r.word ?? ''), count: toNum(r.count) });
      yearGroups.set(year, list);
    }

    const wordsByYear: YearlyWords[] = Array.from(yearGroups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, words]) => ({ year, words }));

    let chatgptLens: ChatGptLensMetrics | undefined;
    if (format === 'chatgpt' || format === 'claude_ai') {
      const row = extractRows(await this.backend.query(sql.chatgptLens))[0];
      if (row) {
        chatgptLens = {
          userChars: toNum(row.userChars),
          assistantChars: toNum(row.assistantChars),
          userMessages: toNum(row.userMessages),
          assistantMessages: toNum(row.assistantMessages),
          politePromptPct: toNum(row.politePromptPct),
          codeBlockPct: toNum(row.codeBlockPct),
          regeneratedBranches: toNum(row.regeneratedBranches),
          peakPromptHour: toNum(row.peakPromptHour),
        };
      }
    }

    let chromeLens: ChromeLensMetrics | undefined;
    if (format === 'chrome_history') {
      const [domTable, transTable, rabbitTable] = await Promise.all([
        this.backend.query(sql.chromeTopDomains),
        this.backend.query(sql.chromeTransitions),
        this.backend.query(sql.chromeRabbitHoles),
      ]);

      const domRows = extractRows(domTable);
      const totalVisits = toNum(domRows[0]?.totalVisits) || domRows.reduce((acc, r) => acc + toNum(r.visits), 0) || 1;
      const transRows = extractRows(transTable);
      const totalTrans = toNum(transRows[0]?.totalTransitions) || transRows.reduce((acc, r) => acc + toNum(r.count), 0) || 1;

      chromeLens = {
        topDomains: domRows.map((r) => {
          const visits = toNum(r.visits);
          return {
            domain: String(r.domain ?? 'unknown'),
            visits,
            sharePct: Number(((visits * 100) / totalVisits).toFixed(1)),
          };
        }),
        transitions: transRows.map((r) => {
          const count = toNum(r.count);
          return {
            transition: String(r.transition ?? 'LINK'),
            count,
            sharePct: Number(((count * 100) / totalTrans).toFixed(1)),
          };
        }),
        rabbitHoles: extractRows(rabbitTable).map((r) => ({
          domain: String(r.domain ?? 'unknown'),
          streakCount: toNum(r.streakCount),
          startTs: toNum(r.startTs),
        })),
      };
    }

    let antigravityLens: AntigravityLensMetrics | undefined;
    if (format === 'antigravity' || format === 'claude_code') {
      const [statsTable, toolsTable] = await Promise.all([
        this.backend.query(sql.antigravityLens),
        this.backend.query(sql.antigravityTopTools),
      ]);
      const row = extractRows(statsTable)[0];
      const toolRows = extractRows(toolsTable);
      const totalTools =
        toNum(toolRows[0]?.totalToolCalls) ||
        toolRows.reduce((acc, r) => acc + toNum(r.calls), 0) ||
        1;

      if (row) {
        antigravityLens = {
          userPrompts: toNum(row.userPrompts),
          plannerSteps: toNum(row.plannerSteps),
          toolExecutions: toNum(row.toolExecutions),
          totalInputTokens: toNum(row.totalInputTokens),
          totalCacheReadTokens: toNum(row.totalCacheReadTokens),
          totalOutputTokens: toNum(row.totalOutputTokens),
          cacheHitPct: toNum(row.cacheHitPct),
          thinkingChars: toNum(row.thinkingChars),
          replyChars: toNum(row.replyChars),
          checkpoints: toNum(row.checkpoints),
          errors: toNum(row.errors),
          topTools: toolRows.map((r) => {
            const calls = toNum(r.calls);
            return {
              toolName: String(r.toolName ?? 'unknown'),
              calls,
              sharePct: Number(((calls * 100) / totalTools).toFixed(1)),
            };
          }),
        };
      }
    }

    let spotifyLens: SpotifyLensMetrics | undefined;
    if (format === 'spotify') {
      const [statsTable, artistsTable, tracksTable] = await Promise.all([
        this.backend.query(sql.spotifyLens),
        this.backend.query(sql.spotifyTopArtists),
        this.backend.query(sql.spotifyTopTracks),
      ]);
      const row = extractRows(statsTable)[0];
      if (row) {
        spotifyLens = {
          totalHours: toNum(row.totalHours),
          totalPlays: toNum(row.totalPlays),
          uniqueArtists: toNum(row.uniqueArtists),
          uniqueTracks: toNum(row.uniqueTracks),
          skipPct: toNum(row.skipPct),
          shufflePct: toNum(row.shufflePct),
          topArtists: extractRows(artistsTable).map((r) => ({
            name: String(r.name ?? 'Unknown Artist'),
            plays: toNum(r.plays),
            minutes: toNum(r.minutes),
          })),
          topTracks: extractRows(tracksTable).map((r) => ({
            name: String(r.name ?? 'Unknown Track'),
            artist: String(r.artist ?? ''),
            plays: toNum(r.plays),
            minutes: toNum(r.minutes),
          })),
        };
      }
    }

    let youtubeLens: YouTubeLensMetrics | undefined;
    if (format === 'youtube') {
      const [statsTable, channelsTable, streaksTable] = await Promise.all([
        this.backend.query(sql.youtubeLens),
        this.backend.query(sql.youtubeTopChannels),
        this.backend.query(sql.youtubeBingeStreaks),
      ]);
      const row = extractRows(statsTable)[0];
      const chRows = extractRows(channelsTable);
      const totalChVideos =
        toNum(chRows[0]?.totalVideos) || chRows.reduce((acc, r) => acc + toNum(r.videos), 0) || 1;

      if (row) {
        youtubeLens = {
          totalVideos: toNum(row.totalVideos),
          uniqueChannels: toNum(row.uniqueChannels),
          shortsCount: toNum(row.shortsCount),
          shortsPct: toNum(row.shortsPct),
          topChannels: chRows.map((r) => {
            const videos = toNum(r.videos);
            return {
              channel: String(r.channel ?? 'Unknown Channel'),
              videos,
              sharePct: Number(((videos * 100) / totalChVideos).toFixed(1)),
            };
          }),
          bingeStreaks: extractRows(streaksTable).map((r) => ({
            channel: String(r.channel ?? 'Unknown Channel'),
            streakCount: toNum(r.streakCount),
            startTs: toNum(r.startTs),
          })),
        };
      }
    }

    let tiktokLens: TikTokLensMetrics | undefined;
    if (format === 'tiktok') {
      const [statsTable, creatorsTable, streaksTable] = await Promise.all([
        this.backend.query(sql.tiktokLens),
        this.backend.query(sql.tiktokTopCreators),
        this.backend.query(sql.tiktokBingeStreaks),
      ]);
      const row = extractRows(statsTable)[0];
      const crRows = extractRows(creatorsTable);
      const totalCrVideos =
        toNum(crRows[0]?.totalWatched) || crRows.reduce((acc, r) => acc + toNum(r.videos), 0) || 1;

      if (row) {
        tiktokLens = {
          totalVideos: toNum(row.totalVideos),
          totalLikes: toNum(row.totalLikes),
          totalSearches: toNum(row.totalSearches),
          uniqueCreators: toNum(row.uniqueCreators),
          likeRatePct: toNum(row.likeRatePct),
          topCreators: crRows.map((r) => {
            const videos = toNum(r.videos);
            return {
              creator: String(r.creator ?? '@creator'),
              videos,
              sharePct: Number(((videos * 100) / totalCrVideos).toFixed(1)),
            };
          }),
          bingeStreaks: extractRows(streaksTable).map((r) => ({
            channel: String(r.channel ?? '@creator'),
            streakCount: toNum(r.streakCount),
            startTs: toNum(r.startTs),
          })),
        };
      }
    }

    let twitterLens: TwitterLensMetrics | undefined;
    if (format === 'twitter') {
      const [statsTable, handlesTable, sourcesTable, viralTable] = await Promise.all([
        this.backend.query(sql.twitterStats),
        this.backend.query(sql.twitterTopHandles),
        this.backend.query(sql.twitterTopSources),
        this.backend.query(sql.twitterTopViral),
      ]);
      const row = extractRows(statsTable)[0];
      const hRows = extractRows(handlesTable);
      const totalHits = toNum(hRows[0]?.totalHits) || hRows.reduce((acc, r) => acc + toNum(r.count), 0) || 1;
      const sRows = extractRows(sourcesTable);
      const totalPosts = toNum(sRows[0]?.totalPosts) || sRows.reduce((acc, r) => acc + toNum(r.count), 0) || 1;

      if (row) {
        twitterLens = {
          totalTweets: toNum(row.totalTweets),
          originalTweets: toNum(row.originalTweets),
          replyTweets: toNum(row.replyTweets),
          retweetTweets: toNum(row.retweetTweets),
          totalLikesGiven: toNum(row.totalLikesGiven),
          totalLikesReceived: toNum(row.totalLikesReceived),
          uniqueHandles: toNum(row.uniqueHandles),
          topHandles: hRows.map((r) => {
            const count = toNum(r.count);
            return {
              handle: String(r.handle ?? '@handle'),
              count,
              sharePct: Number(((count * 100) / totalHits).toFixed(1)),
            };
          }),
          topSources: sRows.map((r) => {
            const count = toNum(r.count);
            return {
              source: String(r.source ?? 'X Web'),
              count,
              sharePct: Number(((count * 100) / totalPosts).toFixed(1)),
            };
          }),
          topViralPosts: extractRows(viralTable).map((r) => ({
            text: String(r.text ?? ''),
            likes: toNum(r.likes),
            ts: toNum(r.ts),
            kind: String(r.kind ?? 'tweet'),
          })),
        };
      }
    }

    return {
      topWords: extractRows(wordsTable).map((r) => ({
        word: String(r.word ?? ''),
        count: toNum(r.count),
      })),
      wordsByYear,
      topEmojis: extractRows(emojisTable).map((r) => ({
        emoji: String(r.emoji ?? ''),
        count: toNum(r.count),
      })),
      questionRateBySender: extractRows(questionsTable).map((r) => ({
        senderName: String(r.senderName ?? 'Unknown'),
        questionCount: toNum(r.questionCount),
        messageCount: toNum(r.messageCount),
        questionPct: toNum(r.questionPct),
      })),
      chatgptLens,
      chromeLens,
      antigravityLens,
      spotifyLens,
      youtubeLens,
      tiktokLens,
      twitterLens,
    };
  }

  async runSql(rawSql: string): Promise<SqlQueryResult> {
    await this.init();
    const check = validateReadOnlySql(rawSql);
    if (!check.valid) {
      throw new Error(check.error || 'Invalid SQL query.');
    }

    const start = performance.now();
    const table = await this.backend.query(check.cleanSql);
    const elapsedMs = Number((performance.now() - start).toFixed(1));

    const columns = table.schema.fields.map((f) => f.name);
    const maxRows = 500;
    const totalRows = typeof table.numRows === 'number' ? table.numRows : table.toArray().length;
    const truncated = totalRows > maxRows;

    const slicedRaw: Array<Record<string, unknown>> = [];
    if (typeof table.get === 'function') {
      const limit = Math.min(maxRows, totalRows);
      for (let i = 0; i < limit; i++) {
        const rowObj = table.get(i);
        if (rowObj) slicedRaw.push(rowObj.toJSON());
      }
    } else {
      const allRows = extractRows(table);
      slicedRaw.push(...(truncated ? allRows.slice(0, maxRows) : allRows));
    }

    const rows = slicedRaw.map((r) => {
      const out: Record<string, SqlCellValue> = {};
      for (const col of columns) {
        out[col] = serializeSqlValue(r[col]);
      }
      return out;
    });

    return {
      columns,
      rows,
      rowCount: totalRows,
      truncated,
      elapsedMs,
    };
  }
}
