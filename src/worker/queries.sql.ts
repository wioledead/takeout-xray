import type { TranslationDictionary } from '../i18n/dictionary';

export interface QueryScope {
  threadId: string;
  tzOffsetMs: number;
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
  const off = getOffsetInt(scope.tzOffsetMs);

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
        COUNT(DISTINCT DATE_TRUNC('day', epoch_ms(ts_ms + ${off}))) AS active_days,
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
        CAST(ISODOW(epoch_ms(ts_ms + ${off})) AS INTEGER) AS dow,
        CAST(HOUR(epoch_ms(ts_ms + ${off})) AS INTEGER) AS hour,
        COUNT(*) AS count
      FROM events
      WHERE ${ew}
      GROUP BY 1, 2
      ORDER BY 1, 2;
    `,
    timelineMonthly: `
      SELECT
        STRFTIME(epoch_ms(ts_ms + ${off}), '%Y-%m') AS bucket,
        COUNT(*) AS count
      FROM events
      WHERE ${ew}
      GROUP BY 1
      ORDER BY 1 ASC;
    `,
    timelineDaily: `
      SELECT
        STRFTIME(epoch_ms(ts_ms + ${off}), '%Y-%m-%d') AS bucket,
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
  const off = getOffsetInt(scope.tzOffsetMs);

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
        CAST(HOUR(epoch_ms(ts_ms + ${off})) AS INTEGER) AS hour,
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
  const off = getOffsetInt(scope.tzOffsetMs);

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
          CAST(YEAR(epoch_ms(ts_ms + ${off})) AS INTEGER) AS year,
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
          CAST(HOUR(epoch_ms(ts_ms + ${off})) AS INTEGER) AS hr,
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
  };
}

const ALLOWED_START_RE = /^(SELECT|WITH|DESCRIBE|SHOW|EXPLAIN|PRAGMA|SUMMARIZE)\b/i;
const FORBIDDEN_KEYWORD_RE = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|ATTACH|DETACH|COPY|EXPORT|IMPORT|TRUNCATE|REPLACE|VACUUM|CALL|INSTALL|LOAD)\b/i;

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

  const trimmedOriginal = rawSql.trim();
  return { valid: true, cleanSql: trimmedOriginal };
}

export interface SqlPreset {
  id: keyof TranslationDictionary['sql']['presets'];
  sql: string;
}

export function getSqlPresets(tzOffsetMs: number): SqlPreset[] {
  const off = getOffsetInt(tzOffsetMs);
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
  MIN(epoch_ms(ts_ms + ${off})) AS started_at
FROM turns
GROUP BY thread_id, turn_id, sender_name
ORDER BY consecutive_events DESC
LIMIT 10;`,
    },
    {
      id: 'lateNight',
      sql: `SELECT
  sender_name,
  CAST(HOUR(epoch_ms(ts_ms + ${off})) AS INTEGER) AS local_hour,
  COUNT(*) AS late_events,
  ROUND(AVG(word_count), 1) AS avg_words
FROM events
WHERE HOUR(epoch_ms(ts_ms + ${off})) BETWEEN 0 AND 4
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
  MAX(epoch_ms(ts_ms + ${off})) AS last_seen
FROM events
WHERE domain IS NOT NULL AND domain != ''
GROUP BY domain
ORDER BY hits DESC
LIMIT 25;`,
    },
    {
      id: 'hourlyVolume',
      sql: `SELECT
  CAST(HOUR(epoch_ms(ts_ms + ${off})) AS INTEGER) AS hour_of_day,
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
  ];
}
