/**
 * DST-aware local time conversion for DuckDB.
 *
 * Applying today's UTC offset to the whole history shifts every timestamp that
 * falls on the other side of a daylight-saving transition by an hour. Instead we
 * compute the real offset segments of the user's IANA time zone across the data
 * range and compile them into a `local_ts(ts_ms)` SQL macro.
 */

export interface TimeZoneSpec {
  /** Current UTC offset in ms; used as a constant fallback when no IANA zone is available. */
  tzOffsetMs: number;
  /** IANA time zone name, e.g. `Europe/Berlin`. */
  timeZone?: string;
}

export interface OffsetSegment {
  /** Inclusive UTC start (ms) of this segment; the first segment starts at -Infinity. */
  startMs: number;
  offsetMs: number;
}

const DAY_MS = 86_400_000;
const MIN_SUPPORTED_MS = Date.UTC(1970, 0, 1);
const MAX_SPAN_DAYS = 80 * 366;

type OffsetFn = (utcMs: number) => number;

function createOffsetFn(timeZone: string): OffsetFn | null {
  let dtf: Intl.DateTimeFormat;
  try {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch {
    return null;
  }

  return (utcMs: number) => {
    const wholeSecondMs = utcMs - (((utcMs % 1000) + 1000) % 1000);
    const parts = dtf.formatToParts(new Date(wholeSecondMs));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return asUtc - wholeSecondMs;
  };
}

function normalizeOffset(tzOffsetMs: number): number {
  return Number.isFinite(tzOffsetMs) ? Math.trunc(tzOffsetMs) : 0;
}

/**
 * Returns the UTC offset segments of `spec` covering [minMs, maxMs].
 * Falls back to a single constant segment when the zone is unknown or invalid.
 */
export function computeOffsetSegments(
  minMs: number | null,
  maxMs: number | null,
  spec: TimeZoneSpec,
): OffsetSegment[] {
  const fallback: OffsetSegment[] = [
    { startMs: Number.NEGATIVE_INFINITY, offsetMs: normalizeOffset(spec.tzOffsetMs) },
  ];
  if (!spec.timeZone || minMs === null || maxMs === null) return fallback;
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return fallback;

  const offsetAt = createOffsetFn(spec.timeZone);
  if (!offsetAt) return fallback;

  let start = Math.max(Math.min(minMs, maxMs), MIN_SUPPORTED_MS);
  let end = Math.max(minMs, maxMs);
  if (end < start) end = start;
  // Guard against absurd ranges from corrupt timestamps.
  if ((end - start) / DAY_MS > MAX_SPAN_DAYS) start = end - MAX_SPAN_DAYS * DAY_MS;

  const segments: OffsetSegment[] = [
    { startMs: Number.NEGATIVE_INFINITY, offsetMs: offsetAt(start) },
  ];

  let prevT = start;
  let prevOff = segments[0].offsetMs;
  for (let t = start + DAY_MS; ; t += DAY_MS) {
    const probe = Math.min(t, end + DAY_MS);
    const off = offsetAt(probe);
    if (off !== prevOff) {
      // Binary search the exact transition second inside (prevT, probe].
      let lo = prevT;
      let hi = probe;
      while (hi - lo > 1000) {
        const mid = lo + Math.floor((hi - lo) / 2000) * 1000;
        if (mid <= lo) break;
        if (offsetAt(mid) === prevOff) lo = mid;
        else hi = mid;
      }
      segments.push({ startMs: hi, offsetMs: off });
      prevOff = off;
    }
    prevT = probe;
    if (probe >= end + DAY_MS) break;
  }

  return segments;
}

/** Compiles offset segments into a SQL expression returning the offset (ms) for `argName`. */
export function buildOffsetCaseSql(segments: OffsetSegment[], argName = 't'): string {
  if (segments.length === 0) return '0';
  if (segments.length === 1) return String(segments[0].offsetMs);

  const branches: string[] = [];
  for (let i = 1; i < segments.length; i++) {
    branches.push(`WHEN ${argName} < ${segments[i].startMs} THEN ${segments[i - 1].offsetMs}`);
  }
  return `(CASE ${branches.join(' ')} ELSE ${segments[segments.length - 1].offsetMs} END)`;
}

/** SQL that (re)defines `local_ts(ts_ms) -> TIMESTAMP` in the user's local wall-clock time. */
export function buildLocalTsMacroSql(segments: OffsetSegment[]): string {
  const offsetExpr = buildOffsetCaseSql(segments, 't');
  return `CREATE OR REPLACE TEMP MACRO local_ts(t) AS epoch_ms(CAST(t AS BIGINT) + ${offsetExpr});`;
}
