import type { TranslationDictionary } from '../i18n/dictionary';

export interface QueryScope {
  threadId: string;
  tzOffsetMs: number;
  timeZone?: string;
}

export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildEventWhere(scope: QueryScope): string {
  if (!scope.threadId || scope.threadId === 'ALL') {
    return '1 = 1';
  }
  return `thread_id = '${escapeSqlLiteral(scope.threadId)}'`;
}

export function buildThreadWhere(scope: QueryScope): string {
  if (!scope.threadId || scope.threadId === 'ALL') {
    return '1 = 1';
  }
  return `thread_id = '${escapeSqlLiteral(scope.threadId)}'`;
}

export function getOffsetInt(tzOffsetMs: number): number {
  return Number.isFinite(tzOffsetMs) ? Math.trunc(tzOffsetMs) : 0;
}

export function buildOverviewSql(scope: QueryScope) {
  const ew = buildEventWhere(scope);
  const tw = buildThreadWhere(scope);

  return {
    kpis: `
      SELECT
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE event_kind != 'service') AS non_service_events,
        COUNT(*) FILTER (WHERE event_kind = 'visit') AS total_visits,
        COUNT(DISTINCT thread_id) AS total_threads,
        COALESCE(SUM(word_count), 0) AS total_words,
        COALESCE(SUM(char_count), 0) AS total_chars,
        COUNT(*) FILTER (WHERE has_media) AS total_media,
        COUNT(*) FILTER (WHERE event_kind = 'service') AS total_service_events,
        COUNT(DISTINCT DATE_TRUNC('day', local_ts(ts_ms))) AS active_days,
        MIN(ts_ms) AS first_event_ts,
        MAX(ts_ms) AS last_event_ts
      FROM events
      WHERE ${ew};
    `,
    extraBranches: `
      SELECT COALESCE(SUM(extra_count), 0) AS extra_branch_count
      FROM threads
      WHERE ${tw};
    `,
    heatmap: `
      SELECT
        CAST(ISODOW(local_ts(ts_ms)) AS INTEGER) AS dow,
        CAST(HOUR(local_ts(ts_ms)) AS INTEGER) AS hour,
        COUNT(*) AS count
      FROM events
      WHERE ${ew}
      GROUP BY 1, 2
      ORDER BY 1, 2;
    `,
    timelineMonthly: `
      SELECT
        STRFTIME(local_ts(ts_ms), '%Y-%m') AS bucket,
        COUNT(*) AS count
      FROM events
      WHERE ${ew}
      GROUP BY 1
      ORDER BY 1 ASC;
    `,
    timelineDaily: `
      SELECT
        STRFTIME(local_ts(ts_ms), '%Y-%m-%d') AS bucket,
        COUNT(*) AS count
      FROM events
      WHERE ${ew}
      GROUP BY 1
      ORDER BY 1 ASC;
    `,
    topSenders: `
      SELECT
        sender_name AS senderName,
        COUNT(*) AS eventCount,
        COALESCE(SUM(word_count), 0) AS wordCount,
        COALESCE(SUM(char_count), 0) AS charCount
      FROM events
      WHERE ${ew} AND event_kind != 'service'
      GROUP BY sender_name
      ORDER BY eventCount DESC
      LIMIT 15;
    `,
    threadsList: `
      SELECT
        t.thread_id,
        t.source_type,
        t.title,
        t.thread_kind,
        t.extra_count
      FROM threads t
      LEFT JOIN (
        SELECT thread_id, COUNT(*) AS cnt
        FROM events
        GROUP BY thread_id
      ) e ON t.thread_id = e.thread_id
      ORDER BY COALESCE(e.cnt, 0) DESC, t.title ASC
      LIMIT 500;
    `,
  };
}

export function buildBehaviorSql(scope: QueryScope) {
  const ew = buildEventWhere(scope);

  return {
    initiators: `
      WITH ordered AS (
        SELECT
          thread_id,
          sender_name,
          ts_ms,
          LAG(ts_ms) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) AS prev_ts_ms
        FROM events
        WHERE ${ew} AND event_kind != 'service'
      )
      SELECT
        sender_name AS senderName,
        COUNT(*) AS sessionsStarted
      FROM ordered
      WHERE prev_ts_ms IS NULL OR (ts_ms - prev_ts_ms) > 21600000
      GROUP BY sender_name
      ORDER BY sessionsStarted DESC
      LIMIT 12;
    `,
    replyLatency: `
      WITH ordered AS (
        SELECT
          sender_id,
          sender_name,
          ts_ms,
          LAG(sender_id) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) AS prev_sender_id,
          LAG(ts_ms) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) AS prev_ts_ms
        FROM events
        WHERE ${ew} AND event_kind = 'message'
      )
      SELECT
        sender_name AS senderName,
        ROUND(MEDIAN((ts_ms - prev_ts_ms) / 1000.0), 1) AS medianLatencySec,
        COUNT(*) AS replyCount
      FROM ordered
      WHERE prev_sender_id IS NOT NULL
        AND sender_id != prev_sender_id
        AND (ts_ms - prev_ts_ms) BETWEEN 1000 AND 21600000
      GROUP BY sender_name
      ORDER BY replyCount DESC
      LIMIT 12;
    `,
    monologues: `
      WITH ordered AS (
        SELECT
          thread_id,
          sender_id,
          sender_name,
          ts_ms,
          event_id,
          CASE
            WHEN LAG(sender_id) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) = sender_id THEN 0
            ELSE 1
          END AS is_new_turn
        FROM events
        WHERE ${ew} AND event_kind = 'message'
      ),
      turns AS (
        SELECT
          thread_id,
          sender_name,
          SUM(is_new_turn) OVER (
            PARTITION BY thread_id
            ORDER BY ts_ms, event_id
            ROWS UNBOUNDED PRECEDING
          ) AS turn_id
        FROM ordered
      ),
      turn_lengths AS (
        SELECT
          sender_name,
          thread_id,
          turn_id,
          COUNT(*) AS streak_len
        FROM turns
        GROUP BY sender_name, thread_id, turn_id
      )
      SELECT
        sender_name AS senderName,
        MAX(streak_len) AS maxStreak,
        ROUND(AVG(streak_len), 2) AS avgPerTurn,
        COUNT(*) FILTER (WHERE streak_len >= 5) AS monologues5Plus
      FROM turn_lengths
      GROUP BY sender_name
      ORDER BY maxStreak DESC, monologues5Plus DESC
      LIMIT 12;
    `,
    hourly: `
      SELECT
        CAST(HOUR(local_ts(ts_ms)) AS INTEGER) AS hour,
        COUNT(*) AS count
      FROM events
      WHERE ${ew}
      GROUP BY 1
      ORDER BY 1 ASC;
    `,
  };
}

export function buildLexiconSql(scope: QueryScope) {
  const ew = buildEventWhere(scope);
  const tw = buildThreadWhere(scope);

  return {
    topWords: `
      WITH tokens AS (
        SELECT UNNEST(regexp_extract_all(lower(text_content), '[a-zа-яё]{3,}')) AS word
        FROM events
        WHERE ${ew} AND event_kind != 'service' AND text_content != ''
      )
      SELECT
        t.word AS word,
        COUNT(*) AS count
      FROM tokens t
      LEFT JOIN stopwords s ON t.word = s.word
      WHERE s.word IS NULL
      GROUP BY t.word
      ORDER BY count DESC
      LIMIT 40;
    `,
    wordsByYear: `
      WITH tokens AS (
        SELECT
          CAST(YEAR(local_ts(ts_ms)) AS INTEGER) AS year,
          UNNEST(regexp_extract_all(lower(text_content), '[a-zа-яё]{3,}')) AS word
        FROM events
        WHERE ${ew} AND event_kind != 'service' AND text_content != ''
      ),
      filtered AS (
        SELECT t.year, t.word, COUNT(*) AS count
        FROM tokens t
        LEFT JOIN stopwords s ON t.word = s.word
        WHERE s.word IS NULL
        GROUP BY t.year, t.word
      ),
      ranked AS (
        SELECT
          year,
          word,
          count,
          ROW_NUMBER() OVER (PARTITION BY year ORDER BY count DESC, word ASC) AS rn
        FROM filtered
      )
      SELECT year, word, count
      FROM ranked
      WHERE rn <= 10
      ORDER BY year DESC, count DESC;
    `,
    topEmojis: `
      WITH flat AS (
        SELECT UNNEST(emojis) AS emoji
        FROM events
        WHERE ${ew} AND array_length(emojis) > 0
      )
      SELECT emoji, COUNT(*) AS count
      FROM flat
      GROUP BY emoji
      ORDER BY count DESC
      LIMIT 24;
    `,
    questionRate: `
      SELECT
        sender_name AS senderName,
        COALESCE(SUM(question_count), 0) AS questionCount,
        COUNT(*) AS messageCount,
        ROUND(COALESCE(SUM(question_count), 0) * 100.0 / GREATEST(COUNT(*), 1), 1) AS questionPct
      FROM events
      WHERE ${ew} AND event_kind != 'service'
      GROUP BY sender_name
      ORDER BY messageCount DESC
      LIMIT 12;
    `,
    chatgptLens: `
      WITH stats AS (
        SELECT
          COALESCE(SUM(char_count) FILTER (WHERE meta_subtype = 'user'), 0) AS userChars,
          COALESCE(SUM(char_count) FILTER (WHERE meta_subtype = 'assistant'), 0) AS assistantChars,
          COUNT(*) FILTER (WHERE meta_subtype = 'user') AS userMessages,
          COUNT(*) FILTER (WHERE meta_subtype = 'assistant') AS assistantMessages,
          COUNT(*) FILTER (
            WHERE meta_subtype = 'user'
              AND regexp_matches(lower(text_content), '(please|thank|thanks|спасибо|пожалуйста|благодарю)')
          ) AS politePrompts,
          COUNT(*) FILTER (WHERE has_code) AS codeMessages,
          COUNT(*) AS totalMsgs
        FROM events
        WHERE ${ew} AND event_kind = 'message'
      ),
      peak AS (
        SELECT
          CAST(HOUR(local_ts(ts_ms)) AS INTEGER) AS hr,
          COUNT(*) AS c
        FROM events
        WHERE ${ew} AND meta_subtype = 'user'
        GROUP BY 1
        ORDER BY c DESC
        LIMIT 1
      ),
      branches AS (
        SELECT COALESCE(SUM(extra_count), 0) AS regeneratedBranches
        FROM threads
        WHERE ${tw}
      )
      SELECT
        s.userChars,
        s.assistantChars,
        s.userMessages,
        s.assistantMessages,
        ROUND(s.politePrompts * 100.0 / GREATEST(s.userMessages, 1), 1) AS politePromptPct,
        ROUND(s.codeMessages * 100.0 / GREATEST(s.totalMsgs, 1), 1) AS codeBlockPct,
        b.regeneratedBranches,
        COALESCE((SELECT hr FROM peak), 12) AS peakPromptHour
      FROM stats s, branches b;
    `,
    chromeTopDomains: `
      SELECT
        COALESCE(domain, 'unknown') AS domain,
        COUNT(*) AS visits,
        SUM(COUNT(*)) OVER () AS totalVisits
      FROM events
      WHERE ${ew} AND event_kind = 'visit'
      GROUP BY 1
      ORDER BY visits DESC
      LIMIT 15;
    `,
    chromeTransitions: `
      SELECT
        COALESCE(meta_subtype, 'LINK') AS transition,
        COUNT(*) AS count,
        SUM(COUNT(*)) OVER () AS totalTransitions
      FROM events
      WHERE ${ew} AND event_kind = 'visit'
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 10;
    `,
    chromeRabbitHoles: `
      WITH ordered AS (
        SELECT
          COALESCE(domain, 'unknown') AS domain,
          ts_ms,
          event_id,
          CASE
            WHEN LAG(COALESCE(domain, 'unknown')) OVER (ORDER BY ts_ms, event_id) = COALESCE(domain, 'unknown') THEN 0
            ELSE 1
          END AS is_new_streak
        FROM events
        WHERE ${ew} AND event_kind = 'visit'
      ),
      streaks AS (
        SELECT
          domain,
          ts_ms,
          SUM(is_new_streak) OVER (ORDER BY ts_ms, event_id ROWS UNBOUNDED PRECEDING) AS streak_id
        FROM ordered
      )
      SELECT
        domain,
        COUNT(*) AS streakCount,
        MIN(ts_ms) AS startTs
      FROM streaks
      GROUP BY streak_id, domain
      HAVING COUNT(*) >= 3
      ORDER BY streakCount DESC, startTs DESC
      LIMIT 10;
    `,
    antigravityLens: `
      WITH step_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE step_type = 'USER_INPUT') AS userPrompts,
          COUNT(*) FILTER (WHERE step_type = 'PLANNER_RESPONSE') AS plannerSteps,
          COALESCE(SUM(tool_call_count), 0) AS toolExecutions,
          COALESCE(SUM(input_tokens), 0) AS totalInputTokens,
          COALESCE(SUM(cache_read_tokens), 0) AS totalCacheReadTokens,
          COALESCE(SUM(output_tokens), 0) AS totalOutputTokens,
          COALESCE(SUM(thinking_chars), 0) AS thinkingChars,
          COALESCE(SUM(reply_chars), 0) AS replyChars,
          COUNT(*) FILTER (WHERE step_type = 'CHECKPOINT') AS checkpoints,
          COUNT(*) FILTER (WHERE step_type = 'ERROR_MESSAGE') AS errors
        FROM antigravity_steps
        WHERE ${ew}
      )
      SELECT
        userPrompts,
        plannerSteps,
        toolExecutions,
        totalInputTokens,
        totalCacheReadTokens,
        totalOutputTokens,
        ROUND(
          totalCacheReadTokens * 100.0 / GREATEST(totalInputTokens + totalCacheReadTokens, 1),
          1
        ) AS cacheHitPct,
        thinkingChars,
        replyChars,
        checkpoints,
        errors
      FROM step_stats;
    `,
    antigravityTopTools: `
      WITH flat AS (
        SELECT UNNEST(tool_names) AS toolName
        FROM antigravity_steps
        WHERE ${ew} AND array_length(tool_names) > 0
      )
      SELECT
        toolName,
        COUNT(*) AS calls,
        SUM(COUNT(*)) OVER () AS totalToolCalls
      FROM flat
      GROUP BY toolName
      ORDER BY calls DESC, toolName ASC
      LIMIT 12;
    `,
    spotifyLens: `
      SELECT
        ROUND(COALESCE(SUM(ms_played), 0) / 3600000.0, 1) AS totalHours,
        COUNT(*) AS totalPlays,
        COUNT(DISTINCT creator_name) AS uniqueArtists,
        COUNT(DISTINCT item_title || '||' || creator_name) AS uniqueTracks,
        ROUND(COUNT(*) FILTER (WHERE is_skipped) * 100.0 / GREATEST(COUNT(*), 1), 1) AS skipPct,
        ROUND(COUNT(*) FILTER (WHERE is_shuffle) * 100.0 / GREATEST(COUNT(*), 1), 1) AS shufflePct
      FROM media_events
      WHERE ${ew} AND source_type = 'spotify';
    `,
    spotifyTopArtists: `
      SELECT
        creator_name AS name,
        COUNT(*) AS plays,
        ROUND(COALESCE(SUM(ms_played), 0) / 60000.0, 1) AS minutes
      FROM media_events
      WHERE ${ew} AND source_type = 'spotify'
      GROUP BY creator_name
      ORDER BY minutes DESC, plays DESC
      LIMIT 12;
    `,
    spotifyTopTracks: `
      SELECT
        item_title AS name,
        creator_name AS artist,
        COUNT(*) AS plays,
        ROUND(COALESCE(SUM(ms_played), 0) / 60000.0, 1) AS minutes
      FROM media_events
      WHERE ${ew} AND source_type = 'spotify'
      GROUP BY item_title, creator_name
      ORDER BY plays DESC, minutes DESC
      LIMIT 12;
    `,
    youtubeLens: `
      SELECT
        COUNT(*) AS totalVideos,
        COUNT(DISTINCT creator_name) AS uniqueChannels,
        COUNT(*) FILTER (WHERE album_or_sub = 'shorts') AS shortsCount,
        ROUND(
          COUNT(*) FILTER (WHERE album_or_sub = 'shorts') * 100.0 / GREATEST(COUNT(*), 1),
          1
        ) AS shortsPct
      FROM media_events
      WHERE ${ew} AND source_type = 'youtube';
    `,
    youtubeTopChannels: `
      SELECT
        creator_name AS channel,
        COUNT(*) AS videos,
        SUM(COUNT(*)) OVER () AS totalVideos
      FROM media_events
      WHERE ${ew} AND source_type = 'youtube' AND creator_name != 'Removed / Unavailable'
      GROUP BY creator_name
      ORDER BY videos DESC, channel ASC
      LIMIT 12;
    `,
    youtubeBingeStreaks: `
      WITH ordered AS (
        SELECT
          creator_name AS channel,
          ts_ms,
          media_id,
          CASE
            WHEN LAG(creator_name) OVER (ORDER BY ts_ms, media_id) = creator_name THEN 0
            ELSE 1
          END AS is_new_streak
        FROM media_events
        WHERE ${ew} AND source_type = 'youtube' AND creator_name != 'Removed / Unavailable'
      ),
      streaks AS (
        SELECT
          channel,
          ts_ms,
          SUM(is_new_streak) OVER (ORDER BY ts_ms, media_id ROWS UNBOUNDED PRECEDING) AS streak_id
        FROM ordered
      )
      SELECT
        channel,
        COUNT(*) AS streakCount,
        MIN(ts_ms) AS startTs
      FROM streaks
      GROUP BY streak_id, channel
      HAVING COUNT(*) >= 3
      ORDER BY streakCount DESC, startTs DESC
      LIMIT 10;
    `,
    tiktokLens: `
      WITH stats AS (
        SELECT
          COUNT(*) FILTER (WHERE platform = 'watch') AS totalVideos,
          COUNT(*) FILTER (WHERE platform = 'like') AS totalLikes,
          COUNT(*) FILTER (WHERE platform = 'search') AS totalSearches,
          COUNT(DISTINCT creator_name) FILTER (
            WHERE platform IN ('watch', 'like')
              AND creator_name != 'tiktok.com'
              AND creator_name != 'Liked Video'
          ) AS uniqueCreators
        FROM media_events
        WHERE ${ew} AND source_type = 'tiktok'
      )
      SELECT
        totalVideos,
        totalLikes,
        totalSearches,
        uniqueCreators,
        ROUND(totalLikes * 100.0 / GREATEST(totalVideos, 1), 1) AS likeRatePct
      FROM stats;
    `,
    tiktokTopCreators: `
      SELECT
        creator_name AS creator,
        COUNT(*) AS videos,
        SUM(COUNT(*)) OVER () AS totalWatched
      FROM media_events
      WHERE ${ew} AND source_type = 'tiktok' AND platform IN ('watch', 'like') AND creator_name LIKE '@%'
      GROUP BY creator_name
      ORDER BY videos DESC, creator ASC
      LIMIT 12;
    `,
    tiktokBingeStreaks: `
      WITH ordered AS (
        SELECT
          creator_name AS channel,
          ts_ms,
          media_id,
          CASE
            WHEN LAG(creator_name) OVER (ORDER BY ts_ms, media_id) = creator_name THEN 0
            ELSE 1
          END AS is_new_streak
        FROM media_events
        WHERE ${ew} AND source_type = 'tiktok' AND platform = 'watch' AND creator_name LIKE '@%'
      ),
      streaks AS (
        SELECT
          channel,
          ts_ms,
          SUM(is_new_streak) OVER (ORDER BY ts_ms, media_id ROWS UNBOUNDED PRECEDING) AS streak_id
        FROM ordered
      )
      SELECT
        channel,
        COUNT(*) AS streakCount,
        MIN(ts_ms) AS startTs
      FROM streaks
      GROUP BY streak_id, channel
      HAVING COUNT(*) >= 2
      ORDER BY streakCount DESC, startTs DESC
      LIMIT 10;
    `,
    twitterStats: `
      SELECT
        COUNT(*) FILTER (WHERE platform IN ('tweet', 'reply', 'retweet')) AS totalTweets,
        COUNT(*) FILTER (WHERE platform = 'tweet') AS originalTweets,
        COUNT(*) FILTER (WHERE platform = 'reply') AS replyTweets,
        COUNT(*) FILTER (WHERE platform = 'retweet') AS retweetTweets,
        COUNT(*) FILTER (WHERE platform = 'like') AS totalLikesGiven,
        COALESCE(SUM(ms_played) FILTER (WHERE platform IN ('tweet', 'reply')), 0) AS totalLikesReceived,
        COUNT(DISTINCT creator_name) FILTER (
          WHERE creator_name LIKE '@%' AND creator_name != '@self' AND creator_name != '@liked'
        ) AS uniqueHandles
      FROM media_events
      WHERE ${ew} AND source_type = 'twitter';
    `,
    twitterTopHandles: `
      SELECT
        creator_name AS handle,
        COUNT(*) AS count,
        SUM(COUNT(*)) OVER () AS totalHits
      FROM media_events
      WHERE ${ew} AND source_type = 'twitter'
        AND creator_name LIKE '@%'
        AND creator_name != '@self'
        AND creator_name != '@liked'
      GROUP BY creator_name
      ORDER BY count DESC, handle ASC
      LIMIT 12;
    `,
    twitterTopSources: `
      SELECT
        COALESCE(album_or_sub, 'X Web') AS source,
        COUNT(*) AS count,
        SUM(COUNT(*)) OVER () AS totalPosts
      FROM media_events
      WHERE ${ew} AND source_type = 'twitter' AND platform IN ('tweet', 'reply', 'retweet')
      GROUP BY 1
      ORDER BY count DESC, source ASC
      LIMIT 8;
    `,
    twitterTopViral: `
      SELECT
        item_title AS text,
        ms_played AS likes,
        ts_ms AS ts,
        platform AS kind
      FROM media_events
      WHERE ${ew} AND source_type = 'twitter' AND platform IN ('tweet', 'reply')
      ORDER BY ms_played DESC, ts_ms DESC
      LIMIT 6;
    `,
  };
}

const ALLOWED_START_RE = /^(SELECT|WITH|DESCRIBE|SHOW|EXPLAIN|SUMMARIZE)\b/i;
const FORBIDDEN_KEYWORD_RE =
  /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|ATTACH|DETACH|COPY|EXPORT|IMPORT|TRUNCATE|REPLACE|VACUUM|CALL|INSTALL|LOAD|SET|RESET|PRAGMA)\b/i;
const FORBIDDEN_FUNCTION_RE =
  /\b(read_csv|read_csv_auto|read_json|read_json_auto|read_json_objects|read_ndjson|read_ndjson_objects|read_ndjson_auto|read_parquet|read_text|read_blob|parquet_scan|parquet_metadata|parquet_schema|parquet_file_metadata|parquet_kv_metadata|csv_sniffer|sniff_csv|glob|duckdb_extensions|duckdb_settings)\s*\(|\bpragma_/i;
const FORBIDDEN_URI_RE = /\b(?:https?|s3|gs|gcs|hf|ftp|file|ws|wss):\/\//i;

/**
 * Strips SQL comments and replaces single/double-quoted literals with safe placeholders
 * in a single lexical pass so string searches like `ILIKE '%update%'` are never
 * misidentified as mutating DDL/DML statements.
 */
function buildSqlValidationSkeleton(rawSql: string): string {
  const tokens = rawSql.match(
    /'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|[^'"/-]+|./g,
  );
  if (!tokens) return '';

  return tokens
    .map((tok) => {
      if (tok.startsWith("'")) return "'_'";
      if (tok.startsWith('"')) return '"_"';
      if (tok.startsWith('--') || tok.startsWith('/*')) return ' ';
      return tok;
    })
    .join('')
    .trim()
    .replace(/;+\s*$/, '');
}

export function validateReadOnlySql(rawSql: string): { valid: boolean; cleanSql: string; error?: string } {
  const skeleton = buildSqlValidationSkeleton(rawSql);

  if (!skeleton) {
    return { valid: false, cleanSql: '', error: 'SQL query is empty.' };
  }

  if (skeleton.includes(';')) {
    return { valid: false, cleanSql: '', error: 'Only a single read-only SQL statement is permitted.' };
  }

  if (!ALLOWED_START_RE.test(skeleton)) {
    return {
      valid: false,
      cleanSql: '',
      error: 'Only read-only queries (SELECT, WITH, DESCRIBE, SHOW, EXPLAIN, SUMMARIZE) are allowed.',
    };
  }

  if (FORBIDDEN_KEYWORD_RE.test(skeleton)) {
    return {
      valid: false,
      cleanSql: '',
      error: 'Mutating or DDL statements are blocked in the SQL forensic sandbox.',
    };
  }

  if (FORBIDDEN_FUNCTION_RE.test(skeleton) || FORBIDDEN_URI_RE.test(rawSql)) {
    return {
      valid: false,
      cleanSql: '',
      error: 'External file or URL access functions are blocked in the SQL forensic sandbox.',
    };
  }

  const trimmedOriginal = rawSql.trim();
  return { valid: true, cleanSql: trimmedOriginal };
}

export interface SqlPreset {
  id: keyof TranslationDictionary['sql']['presets'];
  sql: string;
}

export function getSqlPresets(_tzOffsetMs = 0): SqlPreset[] {
  return [
    {
      id: 'monologues',
      sql: `WITH ordered AS (
  SELECT
    thread_id, sender_id, sender_name, ts_ms, event_id,
    CASE WHEN LAG(sender_id) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) = sender_id THEN 0 ELSE 1 END AS is_new
  FROM events
  WHERE event_kind != 'service'
),
turns AS (
  SELECT
    thread_id, sender_name, ts_ms,
    SUM(is_new) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id ROWS UNBOUNDED PRECEDING) AS turn_id
  FROM ordered
)
SELECT
  sender_name,
  COUNT(*) AS consecutive_events,
  MIN(local_ts(ts_ms)) AS started_at
FROM turns
GROUP BY thread_id, turn_id, sender_name
ORDER BY consecutive_events DESC
LIMIT 10;`,
    },
    {
      id: 'lateNight',
      sql: `SELECT
  sender_name,
  CAST(HOUR(local_ts(ts_ms)) AS INTEGER) AS local_hour,
  COUNT(*) AS late_events,
  ROUND(AVG(word_count), 1) AS avg_words
FROM events
WHERE HOUR(local_ts(ts_ms)) BETWEEN 0 AND 4
GROUP BY 1, 2
ORDER BY late_events DESC
LIMIT 25;`,
    },
    {
      id: 'domains',
      sql: `SELECT
  domain,
  COUNT(*) AS hits,
  COUNT(DISTINCT sender_name) AS unique_senders,
  MAX(local_ts(ts_ms)) AS last_seen
FROM events
WHERE domain IS NOT NULL AND domain != ''
GROUP BY domain
ORDER BY hits DESC
LIMIT 25;`,
    },
    {
      id: 'hourlyVolume',
      sql: `SELECT
  CAST(HOUR(local_ts(ts_ms)) AS INTEGER) AS hour_of_day,
  COUNT(*) AS event_count,
  SUM(word_count) AS total_words,
  SUM(question_count) AS questions
FROM events
GROUP BY 1
ORDER BY 1 ASC;`,
    },
    {
      id: 'emojis',
      sql: `WITH flat AS (
  SELECT sender_name, UNNEST(emojis) AS emoji
  FROM events
  WHERE array_length(emojis) > 0
)
SELECT
  emoji,
  COUNT(*) AS total_uses,
  ANY_VALUE(sender_name) AS sample_sender
FROM flat
GROUP BY emoji
ORDER BY total_uses DESC
LIMIT 30;`,
    },
    {
      id: 'responseTimes',
      sql: `WITH pairs AS (
  SELECT
    sender_id,
    sender_name,
    ts_ms,
    LAG(sender_id) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) AS prev_sender,
    LAG(ts_ms) OVER (PARTITION BY thread_id ORDER BY ts_ms, event_id) AS prev_ts
  FROM events
  WHERE event_kind = 'message'
)
SELECT
  sender_name,
  COUNT(*) AS reply_samples,
  ROUND(MEDIAN((ts_ms - prev_ts) / 1000.0), 1) AS median_sec,
  ROUND(QUANTILE_CONT((ts_ms - prev_ts) / 1000.0, 0.9), 1) AS p90_sec
FROM pairs
WHERE prev_sender IS NOT NULL
  AND sender_id != prev_sender
  AND (ts_ms - prev_ts) BETWEEN 1000 AND 21600000
GROUP BY sender_name
ORDER BY reply_samples DESC;`,
    },
    {
      id: 'antigravityTools',
      sql: `WITH flat AS (
  SELECT thread_id, UNNEST(tool_names) AS tool_name
  FROM antigravity_steps
  WHERE array_length(tool_names) > 0
)
SELECT
  tool_name,
  COUNT(*) AS calls,
  COUNT(DISTINCT thread_id) AS sessions
FROM flat
GROUP BY tool_name
ORDER BY calls DESC, tool_name ASC
LIMIT 25;`,
    },
    {
      id: 'antigravityTokens',
      sql: `SELECT
  t.title AS session,
  COUNT(*) FILTER (WHERE s.step_type = 'USER_INPUT') AS prompts,
  COALESCE(SUM(s.tool_call_count), 0) AS tools,
  COALESCE(SUM(s.input_tokens), 0) AS uncached_in,
  COALESCE(SUM(s.cache_read_tokens), 0) AS cache_read,
  COALESCE(SUM(s.output_tokens), 0) AS output_tok,
  ROUND(
    COALESCE(SUM(s.cache_read_tokens), 0) * 100.0 /
    GREATEST(COALESCE(SUM(s.input_tokens + s.cache_read_tokens), 0), 1),
    1
  ) AS cache_hit_pct
FROM antigravity_steps s
JOIN threads t ON s.thread_id = t.thread_id
GROUP BY t.thread_id, t.title
ORDER BY output_tok DESC, tools DESC
LIMIT 50;`,
    },
    {
      id: 'spotifyArtists',
      sql: `SELECT
  creator_name AS artist,
  COUNT(*) AS plays,
  ROUND(COALESCE(SUM(ms_played), 0) / 3600000.0, 2) AS hours_listened,
  ROUND(COUNT(*) FILTER (WHERE is_skipped) * 100.0 / GREATEST(COUNT(*), 1), 1) AS skip_pct
FROM media_events
WHERE source_type = 'spotify'
GROUP BY creator_name
ORDER BY hours_listened DESC, plays DESC
LIMIT 25;`,
    },
    {
      id: 'youtubeChannels',
      sql: `SELECT
  creator_name AS channel,
  COUNT(*) AS videos,
  COUNT(*) FILTER (WHERE album_or_sub = 'shorts') AS shorts,
  MAX(local_ts(ts_ms)) AS last_watched
FROM media_events
WHERE source_type IN ('youtube', 'tiktok')
GROUP BY creator_name
ORDER BY videos DESC
LIMIT 25;`,
    },
    {
      id: 'twitterPosts',
      sql: `SELECT
  platform AS post_type,
  creator_name AS target_handle,
  COALESCE(album_or_sub, 'X Web') AS client,
  ms_played AS likes_received,
  local_ts(ts_ms) AS posted_at,
  item_title AS tweet_text
FROM media_events
WHERE source_type = 'twitter'
ORDER BY ms_played DESC, ts_ms DESC
LIMIT 25;`,
    },
  ];
}
