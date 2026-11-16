import { useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Play,
  Terminal,
} from 'lucide-react';
import { getLocalTzOffsetMs } from '../client/xrayClient';
import { useI18n } from '../i18n/useI18n';
import type { ExportFormat, SqlCellValue, SqlQueryResult } from '../types/domain';
import { getFormatProfile } from '../utils/formatProfile';
import { getSqlPresets } from '../worker/queries.sql';

interface SqlConsoleTabProps {
  format?: ExportFormat;
  onRunSql: (sql: string) => Promise<SqlQueryResult>;
}

const SCHEMA_TABLES = [
  {
    name: 'events',
    columns: [
      { col: 'event_id', type: 'VARCHAR' },
      { col: 'thread_id', type: 'VARCHAR' },
      { col: 'source_type', type: 'VARCHAR' },
      { col: 'event_kind', type: 'VARCHAR' },
      { col: 'ts_ms', type: 'BIGINT' },
      { col: 'sender_id', type: 'VARCHAR' },
      { col: 'sender_name', type: 'VARCHAR' },
      { col: 'text_content', type: 'VARCHAR' },
      { col: 'char_count', type: 'INTEGER' },
      { col: 'word_count', type: 'INTEGER' },
      { col: 'question_count', type: 'INTEGER' },
      { col: 'has_code', type: 'BOOLEAN' },
      { col: 'has_media', type: 'BOOLEAN' },
      { col: 'emojis', type: 'VARCHAR[]' },
      { col: 'domain', type: 'VARCHAR' },
      { col: 'meta_subtype', type: 'VARCHAR' },
    ],
  },
  {
    name: 'threads',
    columns: [
      { col: 'thread_id', type: 'VARCHAR' },
      { col: 'source_type', type: 'VARCHAR' },
      { col: 'title', type: 'VARCHAR' },
      { col: 'thread_kind', type: 'VARCHAR' },
      { col: 'extra_count', type: 'INTEGER' },
    ],
  },
  {
    name: 'antigravity_steps',
    columns: [
      { col: 'step_id', type: 'VARCHAR' },
      { col: 'thread_id', type: 'VARCHAR' },
      { col: 'step_index', type: 'INTEGER' },
      { col: 'step_type', type: 'VARCHAR' },
      { col: 'ts_ms', type: 'BIGINT' },
      { col: 'input_tokens', type: 'BIGINT' },
      { col: 'cache_read_tokens', type: 'BIGINT' },
      { col: 'output_tokens', type: 'BIGINT' },
      { col: 'thinking_chars', type: 'INTEGER' },
      { col: 'reply_chars', type: 'INTEGER' },
      { col: 'tool_call_count', type: 'INTEGER' },
      { col: 'tool_names', type: 'VARCHAR[]' },
    ],
  },
  {
    name: 'media_events',
    columns: [
      { col: 'media_id', type: 'VARCHAR' },
      { col: 'thread_id', type: 'VARCHAR' },
      { col: 'source_type', type: 'VARCHAR' },
      { col: 'ts_ms', type: 'BIGINT' },
      { col: 'creator_name', type: 'VARCHAR' },
      { col: 'item_title', type: 'VARCHAR' },
      { col: 'album_or_sub', type: 'VARCHAR' },
      { col: 'ms_played', type: 'BIGINT' },
      { col: 'is_skipped', type: 'BOOLEAN' },
      { col: 'is_shuffle', type: 'BOOLEAN' },
      { col: 'platform', type: 'VARCHAR' },
    ],
  },
  {
    name: 'stopwords',
    columns: [{ col: 'word', type: 'VARCHAR' }],
  },
];

function formatCell(val: SqlCellValue): string {
  if (val === null) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

function escapeCsvField(val: SqlCellValue): string {
  if (val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function SqlConsoleTab({ format, onRunSql }: SqlConsoleTabProps) {
  const { t } = useI18n();
  const rawPresets = getSqlPresets(getLocalTzOffsetMs());
  const preferredIds = format ? getFormatProfile(format).preferredSqlPresetIds : [];
  const preferredSet = new Set(preferredIds);
  const presets = [...rawPresets].sort((a, b) => {
    const aIdx = preferredIds.indexOf(a.id);
    const bIdx = preferredIds.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return 0;
  });
  const [sql, setSql] = useState(presets[0].sql);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const execute = async (queryText = sql) => {
    setRunning(true);
    setError(null);
    try {
      const res = await onRunSql(queryText);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void execute();
    }
  };

  const handleCopyCsv = async () => {
    if (!result || result.columns.length === 0) return;
    const header = result.columns.map(escapeCsvField).join(',');
    const lines = result.rows.map((row) =>
      result.columns.map((c) => escapeCsvField(row[c] ?? null)).join(','),
    );
    await navigator.clipboard.writeText([header, ...lines].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="space-y-4 lg:col-span-3">
        <div className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#00FF9D]" />
                <h2 className="font-mono text-sm font-bold text-slate-100">{t.sql.title}</h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{t.sql.subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">
                {t.sql.shortcutHint}
              </span>
              <button
                type="button"
                disabled={running}
                onClick={() => void execute()}
                className="inline-flex items-center gap-1.5 rounded bg-[#00FF9D] px-3.5 py-1.5 font-mono text-xs font-bold text-[#07090D] transition hover:bg-[#00FF9D]/90 disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                {running ? t.sql.running : t.sql.runBtn}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 font-mono text-[10px] font-bold tracking-wider text-slate-500">
              {t.sql.presetsTitle}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => {
                const isRecommended = preferredSet.has(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSql(preset.sql);
                      void execute(preset.sql);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] transition cursor-pointer ${
                      isRecommended
                        ? 'border-[#00FF9D]/40 bg-[#00FF9D]/5 text-slate-200 hover:border-[#00FF9D]/80 hover:text-[#00FF9D]'
                        : 'border-[#1E293B] bg-[#07090D] text-slate-400 hover:border-[#38BDF8]/60 hover:text-[#38BDF8]'
                    }`}
                  >
                    {isRecommended && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00FF9D]" />
                    )}
                    <span>{t.sql.presets[preset.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={9}
            spellCheck={false}
            aria-label="SQL Query Editor"
            className="mt-4 w-full rounded-md border border-[#1E293B] bg-[#07090D] p-3 font-mono text-xs leading-relaxed text-[#00FF9D] outline-none focus:border-[#00FF9D]/60"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[#F59E0B]/50 bg-[#F59E0B]/10 p-4 font-mono text-xs text-[#F59E0B]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-[#1E293B] bg-[#0D1117]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] px-4 py-2.5 font-mono text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-400">
                  {t.sql.execTime}:{' '}
                  <span className="font-bold text-[#00FF9D]">{result.elapsedMs} ms</span>
                </span>
                <span className="text-slate-400">
                  {t.sql.rowsReturned}:{' '}
                  <span className="font-bold text-[#38BDF8]">
                    {result.rowCount.toLocaleString()}
                  </span>
                </span>
                {result.truncated && (
                  <span className="rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 text-[11px] text-[#F59E0B]">
                    {t.sql.truncatedNotice}
                  </span>
                )}
              </div>

              {result.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCopyCsv()}
                  className="inline-flex items-center gap-1.5 rounded border border-[#1E293B] bg-[#07090D] px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-[#00FF9D]" />
                      <span className="text-[#00FF9D]">{t.sql.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>{t.sql.copyCsv}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {result.rows.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-slate-400">
                {t.sql.emptyResult}
              </div>
            ) : (
              <div className="max-h-[460px] overflow-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 border-b border-[#1E293B] bg-[#111822] text-[10px] uppercase text-slate-400">
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-3 py-2">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B]/60">
                    {result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#111822]/80">
                        {result.columns.map((col) => {
                          const val = row[col] ?? null;
                          return (
                            <td
                              key={col}
                              className={`max-w-[320px] truncate px-3 py-2 ${
                                val === null
                                  ? 'italic text-slate-600'
                                  : typeof val === 'number'
                                    ? 'text-[#38BDF8]'
                                    : typeof val === 'boolean'
                                      ? 'text-[#F59E0B]'
                                      : 'text-slate-200'
                              }`}
                              title={formatCell(val)}
                            >
                              {formatCell(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="rounded-lg border border-[#1E293B] bg-[#0D1117] p-4">
        <div className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-slate-200">
          <Database className="h-4 w-4 text-[#38BDF8]" />
          <span>{t.sql.schemaTitle}</span>
        </div>

        <div className="mt-4 space-y-4">
          {SCHEMA_TABLES.map((tbl) => (
            <div key={tbl.name} className="rounded border border-[#1E293B] bg-[#07090D] p-3">
              <button
                type="button"
                onClick={() => setSql(`SELECT * FROM ${tbl.name} LIMIT 50;`)}
                className="font-mono text-xs font-bold text-[#00FF9D] hover:underline cursor-pointer"
              >
                {tbl.name}
              </button>
              <div className="mt-2 space-y-1">
                {tbl.columns.map((c) => (
                  <div
                    key={c.col}
                    className="flex items-center justify-between font-mono text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => setSql((prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${c.col}`)}
                      className="text-slate-300 hover:text-[#38BDF8] cursor-pointer"
                    >
                      {c.col}
                    </button>
                    <span className="text-[10px] text-slate-500">{c.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
