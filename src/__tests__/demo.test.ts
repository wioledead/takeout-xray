import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '../utils/demoGenerators';
import { XRayEngine, type DuckDBBackend, type DuckDBTableLike } from '../worker/engine';
import { getSqlPresets } from '../worker/queries.sql';

const require = createRequire(import.meta.url);

async function createNodeEngine(): Promise<{ engine: XRayEngine; close: () => void }> {
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

  const backend: DuckDBBackend = {
    async registerFileText(name: string, text: string) {
      db.registerFileText(name, text);
    },
    async dropFile(name: string) {
      db.dropFile(name);
    },
    async query(sql: string) {
      return conn.query(sql) as unknown as DuckDBTableLike;
    },
  };

  const engine = new XRayEngine(backend);
  await engine.init();
  return { engine, close: () => conn.close() };
}

describe('Synthetic demo generators & full DuckDB pipeline', () => {
  it('generates and ingests Telegram demo with complete Overview, Behavior, Lexicon, thread filter, and SQL presets', async () => {
    const t0 = performance.now();
    const dataset = generateDemoDataset('telegram');
    const genMs = performance.now() - t0;

    expect(genMs).toBeLessThan(1000);
    expect(dataset.threads).toHaveLength(3);
    expect(dataset.events.length).toBe(15000);

    const { engine, close } = await createNodeEngine();
    try {
      await engine.resetSession(dataset.format);
      for (let i = 0; i < dataset.events.length; i += 5000) {
        await engine.ingestBatch(i === 0 ? dataset.threads : [], dataset.events.slice(i, i + 5000));
      }

      const snapAll = await engine.getDashboardSnapshot('ALL', 0);
      expect(snapAll.format).toBe('tg_account');
      expect(snapAll.overview.totalEvents).toBe(15000);
      expect(snapAll.overview.totalThreads).toBe(3);
      expect(snapAll.overview.heatmap.length).toBeGreaterThan(0);
      expect(snapAll.overview.timeline.length).toBeGreaterThan(0);
      expect(snapAll.overview.topSenders.length).toBe(3);

      expect(snapAll.behavior.initiators.length).toBeGreaterThan(0);
      expect(snapAll.behavior.replyLatency.length).toBeGreaterThan(0);
      expect(snapAll.behavior.monologues.length).toBeGreaterThan(0);
      expect(snapAll.behavior.hourlyBreakdown).toHaveLength(24);
      expect(snapAll.behavior.nightOwlPct).toBeGreaterThan(0);

      expect(snapAll.lexicon.topWords.length).toBeGreaterThan(10);
      expect(snapAll.lexicon.topWords.some((w) => w.word === 'the' || w.word === 'это')).toBe(false);
      expect(snapAll.lexicon.wordsByYear.length).toBeGreaterThan(0);
      expect(snapAll.lexicon.topEmojis.length).toBeGreaterThan(0);
      expect(snapAll.lexicon.questionRateBySender.length).toBeGreaterThan(0);

      // Thread filter test
      const snapFiltered = await engine.getDashboardSnapshot('tg_demo_elena', 0);
      expect(snapFiltered.overview.totalEvents).toBe(6000);

      // Verify all 6 SQL presets run without error
      for (const preset of getSqlPresets(0)) {
        const res = await engine.runSql(preset.sql);
        expect(res.columns.length).toBeGreaterThan(0);
      }
    } finally {
      close();
    }
  });

  it('generates and ingests ChatGPT demo with ChatGPT lens metrics', async () => {
    const dataset = generateDemoDataset('chatgpt');
    expect(dataset.threads).toHaveLength(300);
    expect(dataset.events.length).toBeGreaterThan(1500);

    const { engine, close } = await createNodeEngine();
    try {
      await engine.resetSession(dataset.format);
      await engine.ingestBatch(dataset.threads, dataset.events);

      const snap = await engine.getDashboardSnapshot('ALL', 0);
      expect(snap.format).toBe('chatgpt');
      expect(snap.overview.extraBranchCount).toBeGreaterThan(0);
      expect(snap.lexicon.chatgptLens).toBeDefined();
      expect(snap.lexicon.chatgptLens?.userChars).toBeGreaterThan(0);
      expect(snap.lexicon.chatgptLens?.assistantChars).toBeGreaterThan(0);
      expect(snap.lexicon.chatgptLens?.politePromptPct).toBeGreaterThan(0);
      expect(snap.lexicon.chatgptLens?.codeBlockPct).toBeGreaterThan(0);
      expect(snap.lexicon.chatgptLens?.regeneratedBranches).toBeGreaterThan(0);
    } finally {
      close();
    }
  });

  it('generates and ingests Chrome demo with Chrome navigation lens metrics', async () => {
    const dataset = generateDemoDataset('chrome');
    expect(dataset.events).toHaveLength(10000);

    const { engine, close } = await createNodeEngine();
    try {
      await engine.resetSession(dataset.format);
      for (let i = 0; i < dataset.events.length; i += 5000) {
        await engine.ingestBatch(i === 0 ? dataset.threads : [], dataset.events.slice(i, i + 5000));
      }

      const snap = await engine.getDashboardSnapshot('ALL', 0);
      expect(snap.format).toBe('chrome_history');
      expect(snap.lexicon.chromeLens).toBeDefined();
      expect(snap.lexicon.chromeLens?.topDomains.length).toBeGreaterThan(5);
      expect(snap.lexicon.chromeLens?.transitions.length).toBeGreaterThan(2);
      expect(snap.lexicon.chromeLens?.rabbitHoles.length).toBeGreaterThan(0);
    } finally {
      close();
    }
  });
});
