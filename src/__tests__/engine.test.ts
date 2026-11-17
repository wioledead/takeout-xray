import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { XRayEngine, type DuckDBBackend, type DuckDBTableLike } from '../worker/engine';
import { computeOffsetSegments } from '../worker/localTime';
import { validateReadOnlySql } from '../worker/queries.sql';
import type { NormalizedEvent, NormalizedThread } from '../types/domain';

const require = createRequire(import.meta.url);

async function createNodeDuckDB(): Promise<{
  backend: DuckDBBackend;
  registered: string[];
  dropped: string[];
  close: () => void;
}> {
  const duckdb = require('@duckdb/duckdb-wasm/blocking') as typeof import('@duckdb/duckdb-wasm/blocking');
  const distDir = path.dirname(require.resolve('@duckdb/duckdb-wasm/blocking'));
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(distDir, 'duckdb-mvp.wasm'), mainWorker: '' },
      eh: { mainModule: path.join(distDir, 'duckdb-eh.wasm'), mainWorker: '' },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate();
  const conn = db.connect();

  const registered: string[] = [];
  const dropped: string[] = [];

  const backend: DuckDBBackend = {
    async registerFileText(name: string, text: string) {
      registered.push(name);
      db.registerFileText(name, text);
    },
    async dropFile(name: string) {
      dropped.push(name);
      db.dropFile(name);
    },
    async query(sql: string) {
      return conn.query(sql) as unknown as DuckDBTableLike;
    },
  };

  return {
    backend,
    registered,
    dropped,
    close: () => conn.close(),
  };
}

describe('XRayEngine DuckDB integration', () => {
  it('initializes schema, seeds stopwords, cleans up batch files via dropFile, and resets cleanly', async () => {
    const { backend, registered, dropped, close } = await createNodeDuckDB();
    try {
      const engine = new XRayEngine(backend);
      await engine.init();

      const stopRes = await engine.runSql('SELECT COUNT(*) AS cnt FROM stopwords;');
      expect(Number(stopRes.rows[0]?.cnt)).toBeGreaterThan(100);

      const threads: NormalizedThread[] = [
        {
          thread_id: 't1',
          source_type: 'tg_chat',
          title: 'Test Thread',
          thread_kind: 'personal_chat',
          extra_count: 0,
        },
      ];
      const events: NormalizedEvent[] = [
        {
          event_id: 'e1',
          thread_id: 't1',
          source_type: 'tg_chat',
          event_kind: 'message',
          ts_ms: 1710466867000,
          sender_id: 'u1',
          sender_name: 'Alice',
          text_content: 'DuckDB streaming test 🚀',
          char_count: 25,
          word_count: 3,
          question_count: 0,
          has_code: false,
          has_media: false,
          emojis: ['🚀'],
          domain: null,
          meta_subtype: null,
        },
      ];

      await engine.ingestBatch(threads, events);
      expect(registered.length).toBe(dropped.length);
      expect(registered.every((name, idx) => dropped[idx] === name)).toBe(true);

      const countBeforeReset = await engine.runSql('SELECT COUNT(*) AS cnt FROM events;');
      expect(countBeforeReset.rows[0]?.cnt).toBe(1);

      await engine.resetSession('chrome_history');
      const countAfterReset = await engine.runSql('SELECT COUNT(*) AS cnt FROM events;');
      expect(countAfterReset.rows[0]?.cnt).toBe(0);

      const stopStillPresent = await engine.runSql('SELECT COUNT(*) AS cnt FROM stopwords;');
      expect(Number(stopStillPresent.rows[0]?.cnt)).toBeGreaterThan(100);
    } finally {
      close();
    }
  });

  it('calls dropFile even when batch SQL insertion fails', async () => {
    const dropped: string[] = [];
    const fakeBackend: DuckDBBackend = {
      async registerFileText() {},
      async dropFile(name: string) {
        dropped.push(name);
      },
      async query(sql: string) {
        if (sql.includes('INSERT INTO events')) {
          throw new Error('Simulated ingestion failure');
        }
        return {
          schema: { fields: [{ name: 'c' }] },
          numRows: 1,
          toArray: () => [{ toJSON: () => ({ c: 1 }) }],
        };
      },
    };

    const engine = new XRayEngine(fakeBackend);
    await expect(
      engine.ingestBatch([], [
        {
          event_id: 'e1',
          thread_id: 't1',
          source_type: 'tg_chat',
          event_kind: 'message',
          ts_ms: 1710000000000,
          sender_id: 'u1',
          sender_name: 'Alice',
          text_content: 'Hello',
          char_count: 5,
          word_count: 1,
          question_count: 0,
          has_code: false,
          has_media: false,
          emojis: [],
          domain: null,
          meta_subtype: null,
        },
      ]),
    ).rejects.toThrow('Simulated ingestion failure');

    expect(dropped.some((d) => d.startsWith('events_batch_'))).toBe(true);
  });

  it('serializes BigInt safely, caps SQL Console results at 500 rows, and blocks mutating SQL', async () => {
    const { backend, close } = await createNodeDuckDB();
    try {
      const engine = new XRayEngine(backend);
      await engine.init();

      const bigRes = await engine.runSql('SELECT range AS n FROM range(600);');
      expect(bigRes.rowCount).toBe(600);
      expect(bigRes.truncated).toBe(true);
      expect(bigRes.rows).toHaveLength(500);
      expect(typeof bigRes.rows[0]?.n).toBe('number');
      expect(() => JSON.stringify(bigRes)).not.toThrow();

      await expect(engine.runSql('DROP TABLE events;')).rejects.toThrow();
      await expect(engine.runSql('DELETE FROM events;')).rejects.toThrow();
      await expect(engine.runSql('SELECT 1; DROP TABLE events;')).rejects.toThrow();
      await expect(engine.runSql("SELECT '\\'; DROP TABLE events; --")).rejects.toThrow();
      await expect(engine.runSql('WITH d AS (DELETE FROM events RETURNING *) SELECT * FROM d;')).rejects.toThrow();
      await expect(engine.runSql('INSTALL httpfs;')).rejects.toThrow();

      // Legitimate string searches containing SQL keywords inside quotes MUST succeed
      await engine.ingestBatch(
        [{ thread_id: 't_sql', source_type: 'tg_chat', title: 'SQL Edge', thread_kind: 'personal_chat', extra_count: 0 }],
        [
          {
            event_id: 'e_upd',
            thread_id: 't_sql',
            source_type: 'tg_chat',
            event_kind: 'message',
            ts_ms: 1710466867000,
            sender_id: 'u1',
            sender_name: 'Alice',
            text_content: 'Please update and create the report; drop old draft',
            char_count: 51,
            word_count: 9,
            question_count: 0,
            has_code: false,
            has_media: false,
            emojis: [],
            domain: null,
            meta_subtype: null,
          },
        ],
      );

      const safeSearch = await engine.runSql(
        "SELECT event_id, text_content FROM events WHERE text_content ILIKE '%update%' AND text_content NOT ILIKE '%delete%';",
      );
      expect(safeSearch.rowCount).toBe(1);
      expect(safeSearch.rows[0]?.event_id).toBe('e_upd');
    } finally {
      close();
    }
  });

  it('orders threads by message count descending and computes exact sharePct across >15 senders', async () => {
    const { backend, close } = await createNodeDuckDB();
    try {
      const engine = new XRayEngine(backend);
      await engine.init();

      const threads: NormalizedThread[] = [
        { thread_id: 'small_a', source_type: 'tg_account', title: 'AAA Small Chat', thread_kind: 'personal_chat', extra_count: 0 },
        { thread_id: 'big_z', source_type: 'tg_account', title: 'ZZZ Big Chat', thread_kind: 'private_group', extra_count: 0 },
      ];

      const events: NormalizedEvent[] = [];
      for (let i = 0; i < 20; i++) {
        events.push({
          event_id: `big_${i}`,
          thread_id: 'big_z',
          source_type: 'tg_account',
          event_kind: 'message',
          ts_ms: 1710466867000 + i * 1000,
          sender_id: `u_${i}`,
          sender_name: `User_${i}`,
          text_content: 'hi',
          char_count: 2,
          word_count: 1,
          question_count: 0,
          has_code: false,
          has_media: false,
          emojis: [],
          domain: null,
          meta_subtype: null,
        });
      }
      events.push({
        event_id: 'small_0',
        thread_id: 'small_a',
        source_type: 'tg_account',
        event_kind: 'message',
        ts_ms: 1710466900000,
        sender_id: 'u_0',
        sender_name: 'User_0',
        text_content: 'only one',
        char_count: 8,
        word_count: 2,
        question_count: 0,
        has_code: false,
        has_media: false,
        emojis: [],
        domain: null,
        meta_subtype: null,
      });

      await engine.ingestBatch(threads, events);
      const snap = await engine.getDashboardSnapshot('ALL', 0);

      // ZZZ Big Chat (20 msgs) must rank ahead of AAA Small Chat (1 msg)
      expect(snap.overview.threads[0].thread_id).toBe('big_z');
      expect(snap.overview.threads[1].thread_id).toBe('small_a');

      // User_0 has 2 of 21 total events = 9.5%, NOT 2 / top15_sum
      const user0 = snap.overview.topSenders.find((s) => s.senderName === 'User_0');
      expect(user0?.sharePct).toBe(9.5);
    } finally {
      close();
    }
  });

  it('blocks external file functions, URLs, PRAGMA, and SET in SQL sandbox', async () => {
    expect(validateReadOnlySql("SELECT * FROM read_csv('https://evil.example/x.csv');").valid).toBe(false);
    expect(validateReadOnlySql("SELECT * FROM read_json('events_batch_0.ndjson');").valid).toBe(false);
    expect(validateReadOnlySql("SELECT * FROM read_parquet('secret.parquet');").valid).toBe(false);
    expect(validateReadOnlySql('SELECT * FROM duckdb_settings();').valid).toBe(false);
    expect(validateReadOnlySql("SELECT 'https://evil.example/?leak=' || text_content FROM events;").valid).toBe(false);
    expect(validateReadOnlySql('PRAGMA table_info(events);').valid).toBe(false);
    expect(validateReadOnlySql("SET enable_external_access = true;").valid).toBe(false);

    const { backend, close } = await createNodeDuckDB();
    try {
      const engine = new XRayEngine(backend);
      await engine.init();

      await expect(engine.runSql("SELECT * FROM read_csv('https://evil.example/a.csv');")).rejects.toThrow();
      await expect(engine.runSql("SELECT * FROM read_json('test.ndjson');")).rejects.toThrow();
      await expect(engine.runSql('PRAGMA show_tables;')).rejects.toThrow();
      await expect(engine.runSql('SET threads = 1;')).rejects.toThrow();
    } finally {
      close();
    }
  });

  it('computes DST-aware local_ts segments for Europe/Berlin and America/New_York across winter and summer', async () => {
    const winterMs = Date.UTC(2024, 0, 15, 12, 0, 0);
    const summerMs = Date.UTC(2024, 6, 15, 12, 0, 0);

    const berlinSegments = computeOffsetSegments(winterMs, summerMs, {
      tzOffsetMs: 3_600_000,
      timeZone: 'Europe/Berlin',
    });
    expect(berlinSegments.length).toBeGreaterThanOrEqual(2);
    expect(berlinSegments[0].offsetMs).toBe(3_600_000);
    expect(berlinSegments[1].offsetMs).toBe(7_200_000);

    const nySegments = computeOffsetSegments(winterMs, summerMs, {
      tzOffsetMs: -18_000_000,
      timeZone: 'America/New_York',
    });
    expect(nySegments.length).toBeGreaterThanOrEqual(2);
    expect(nySegments[0].offsetMs).toBe(-18_000_000);
    expect(nySegments[1].offsetMs).toBe(-14_400_000);

    const { backend, close } = await createNodeDuckDB();
    try {
      const engine = new XRayEngine(backend);
      await engine.init();

      await engine.ingestBatch(
        [{ thread_id: 'dst_1', source_type: 'tg_chat', title: 'DST Chat', thread_kind: 'personal_chat', extra_count: 0 }],
        [
          {
            event_id: 'w1',
            thread_id: 'dst_1',
            source_type: 'tg_chat',
            event_kind: 'message',
            ts_ms: winterMs,
            sender_id: 'u1',
            sender_name: 'Alice',
            text_content: 'winter noon utc',
            char_count: 15,
            word_count: 3,
            question_count: 0,
            has_code: false,
            has_media: false,
            emojis: [],
            domain: null,
            meta_subtype: null,
          },
          {
            event_id: 's1',
            thread_id: 'dst_1',
            source_type: 'tg_chat',
            event_kind: 'message',
            ts_ms: summerMs,
            sender_id: 'u1',
            sender_name: 'Alice',
            text_content: 'summer noon utc',
            char_count: 15,
            word_count: 3,
            question_count: 0,
            has_code: false,
            has_media: false,
            emojis: [],
            domain: null,
            meta_subtype: null,
          },
        ],
      );

      const snap = await engine.getDashboardSnapshot('ALL', 3_600_000, 'Europe/Berlin');
      expect(snap.behavior.hourlyBreakdown.find((h) => h.hour === 13)?.count).toBe(1);
      expect(snap.behavior.hourlyBreakdown.find((h) => h.hour === 14)?.count).toBe(1);
    } finally {
      close();
    }
  });
});
