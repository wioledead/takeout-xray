import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NormalizedMediaEvent, NormalizedThread } from '../types/domain';
import { generateDemoDataset } from '../utils/demoGenerators';
import { parseTikTokStream } from '../worker/adapters/tiktok';
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

  it('generates and ingests Antigravity demo with antigravity_steps, lens metrics, thread filtering & SQL presets', async () => {
    const dataset = generateDemoDataset('antigravity');
    expect(dataset.threads).toHaveLength(4);
    expect(dataset.antigravitySteps?.length).toBeGreaterThan(100);

    const { engine, close } = await createNodeEngine();
    try {
      await engine.resetSession(dataset.format);
      await engine.ingestBatch(dataset.threads, dataset.events, dataset.antigravitySteps);

      const snap = await engine.getDashboardSnapshot('ALL', 0);
      expect(snap.format).toBe('antigravity');
      expect(snap.overview.totalThreads).toBe(4);
      expect(snap.lexicon.antigravityLens).toBeDefined();
      expect(snap.lexicon.antigravityLens?.userPrompts).toBe(56);
      expect(snap.lexicon.antigravityLens?.totalCacheReadTokens).toBeGreaterThan(0);
      expect(snap.lexicon.antigravityLens?.cacheHitPct).toBeGreaterThan(50);
      expect(snap.lexicon.antigravityLens?.topTools.length).toBeGreaterThan(0);

      const filtered = await engine.getDashboardSnapshot('ag_09e83be3', 0);
      expect(filtered.lexicon.antigravityLens?.userPrompts).toBe(14);
      expect(filtered.lexicon.antigravityLens?.checkpoints).toBe(2);

      for (const preset of getSqlPresets(0)) {
        const res = await engine.runSql(preset.sql);
        expect(res.columns.length).toBeGreaterThan(0);
      }
    } finally {
      close();
    }
  });

  it('generates and ingests Spotify demo with media_events, Spotify lens metrics, and SQL presets', async () => {
    const dataset = generateDemoDataset('spotify');
    expect(dataset.format).toBe('spotify');
    expect(dataset.events).toHaveLength(1400);
    expect(dataset.mediaEvents).toHaveLength(1400);

    const { engine, close } = await createNodeEngine();
    try {
      await engine.resetSession(dataset.format);
      await engine.ingestBatch(dataset.threads, dataset.events, [], dataset.mediaEvents);

      const snap = await engine.getDashboardSnapshot('ALL', 0);
      expect(snap.format).toBe('spotify');
      expect(snap.lexicon.spotifyLens).toBeDefined();
      expect(snap.lexicon.spotifyLens?.totalPlays).toBe(1400);
      expect(snap.lexicon.spotifyLens?.totalHours).toBeGreaterThan(30);
      expect(snap.lexicon.spotifyLens?.skipPct).toBeGreaterThan(10);
      expect(snap.lexicon.spotifyLens?.shufflePct).toBeGreaterThan(30);
      expect(snap.lexicon.spotifyLens?.topArtists.length).toBeGreaterThan(5);
      expect(snap.lexicon.spotifyLens?.topTracks.length).toBeGreaterThan(5);

      for (const preset of getSqlPresets(0)) {
        const res = await engine.runSql(preset.sql);
        expect(res.columns.length).toBeGreaterThan(0);
      }
    } finally {
      close();
    }
  });

  it('generates and ingests YouTube demo and verifies TikTok media lens SQL end-to-end', async () => {
    const yt = generateDemoDataset('youtube');
    expect(yt.format).toBe('youtube');
    expect(yt.events).toHaveLength(960);
    expect(yt.mediaEvents).toHaveLength(960);

    const { engine, close } = await createNodeEngine();
    try {
      await engine.resetSession(yt.format);
      await engine.ingestBatch(yt.threads, yt.events, [], yt.mediaEvents);

      const ytSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(ytSnap.lexicon.youtubeLens).toBeDefined();
      expect(ytSnap.lexicon.youtubeLens?.totalVideos).toBe(960);
      expect(ytSnap.lexicon.youtubeLens?.shortsCount).toBeGreaterThan(100);
      expect(ytSnap.lexicon.youtubeLens?.topChannels.length).toBeGreaterThan(5);
      expect(ytSnap.lexicon.youtubeLens?.bingeStreaks.length).toBeGreaterThan(0);

      // Verify TikTok adapter -> DuckDB pipeline
      const ttPayload = JSON.stringify({
        Activity: {
          'Video Browsing History': {
            VideoList: [
              { Date: '2024-10-01 12:00:00', Link: 'https://www.tiktok.com/@alpha/video/1' },
              { Date: '2024-10-01 12:01:00', Link: 'https://www.tiktok.com/@alpha/video/2' },
              { Date: '2024-10-01 12:02:00', Link: 'https://www.tiktok.com/@beta/video/3' },
            ],
          },
          'Like List': {
            ItemFavoriteList: [
              { Date: '2024-10-01 12:01:30', Link: 'https://www.tiktok.com/@alpha/video/2' },
            ],
          },
          'Search History': {
            SearchList: [{ Date: '2024-10-01 12:05:00', SearchTerm: 'local first sql' }],
          },
        },
      });
      const bytes = new TextEncoder().encode(ttPayload);
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(bytes);
          c.close();
        },
      });
      await engine.resetSession('tiktok');
      let ttThreads: NormalizedThread[] = [];
      let ttEvents: typeof yt.events = [];
      let ttMedia: NormalizedMediaEvent[] = [];
      await parseTikTokStream({
        stream,
        totalBytes: bytes.byteLength,
        onBatch: (t, e) => {
          ttThreads = t;
          ttEvents = e;
        },
        onMediaBatch: (m) => {
          ttMedia = m;
        },
      });
      await engine.ingestBatch(ttThreads, ttEvents, [], ttMedia);
      const ttSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(ttSnap.lexicon.tiktokLens?.totalVideos).toBe(3);
      expect(ttSnap.lexicon.tiktokLens?.totalLikes).toBe(1);
      expect(ttSnap.lexicon.tiktokLens?.totalSearches).toBe(1);
      expect(ttSnap.lexicon.tiktokLens?.topCreators[0]?.creator).toBe('@alpha');
      expect(ttSnap.lexicon.tiktokLens?.bingeStreaks[0]?.streakCount).toBe(2);
    } finally {
      close();
    }
  });

  it('generates and ingests WhatsApp, Discord, Claude.ai, Claude Code CLI, and TikTok demos end-to-end', async () => {
    const { engine, close } = await createNodeEngine();
    try {
      const wa = generateDemoDataset('whatsapp');
      expect(wa.format).toBe('whatsapp');
      expect(wa.threads).toHaveLength(2);
      await engine.resetSession(wa.format);
      await engine.ingestBatch(wa.threads, wa.events);
      const waSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(waSnap.overview.totalEvents).toBeGreaterThan(1000);
      expect(waSnap.behavior.initiators.length).toBeGreaterThanOrEqual(2);

      const dc = generateDemoDataset('discord');
      expect(dc.format).toBe('discord');
      expect(dc.threads).toHaveLength(3);
      await engine.resetSession(dc.format);
      await engine.ingestBatch(dc.threads, dc.events);
      const dcSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(dcSnap.overview.totalEvents).toBeGreaterThan(1000);
      expect(dcSnap.lexicon.topWords.length).toBeGreaterThan(3);
      expect(dcSnap.lexicon.topEmojis.length).toBeGreaterThan(1);

      const ca = generateDemoDataset('claude_ai');
      expect(ca.format).toBe('claude_ai');
      expect(ca.threads).toHaveLength(96);
      await engine.resetSession(ca.format);
      await engine.ingestBatch(ca.threads, ca.events);
      const caSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(caSnap.lexicon.chatgptLens).toBeDefined();
      expect(caSnap.lexicon.chatgptLens?.politePromptPct).toBeGreaterThan(30);
      expect(caSnap.lexicon.chatgptLens?.codeBlockPct).toBeGreaterThan(15);

      const cc = generateDemoDataset('claude_code');
      expect(cc.format).toBe('claude_code');
      expect(cc.threads).toHaveLength(4);
      expect(cc.antigravitySteps?.length).toBeGreaterThan(80);
      await engine.resetSession(cc.format);
      await engine.ingestBatch(cc.threads, cc.events, cc.antigravitySteps);
      const ccSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(ccSnap.lexicon.antigravityLens).toBeDefined();
      expect(ccSnap.lexicon.antigravityLens?.toolExecutions).toBeGreaterThan(50);
      expect(ccSnap.lexicon.antigravityLens?.cacheHitPct).toBeGreaterThan(50);
      expect(ccSnap.lexicon.antigravityLens?.topTools.length).toBeGreaterThan(3);

      const tt = generateDemoDataset('tiktok');
      expect(tt.format).toBe('tiktok');
      expect(tt.events).toHaveLength(1200);
      expect(tt.mediaEvents).toHaveLength(1200);
      await engine.resetSession(tt.format);
      await engine.ingestBatch(tt.threads, tt.events, [], tt.mediaEvents);
      const ttSnap = await engine.getDashboardSnapshot('ALL', 0);
      expect(ttSnap.lexicon.tiktokLens).toBeDefined();
      expect(ttSnap.lexicon.tiktokLens?.totalVideos).toBeGreaterThan(700);
      expect(ttSnap.lexicon.tiktokLens?.totalLikes).toBeGreaterThan(50);
      expect(ttSnap.lexicon.tiktokLens?.totalSearches).toBeGreaterThan(20);
      expect(ttSnap.lexicon.tiktokLens?.topCreators.length).toBeGreaterThan(3);
      expect(ttSnap.lexicon.tiktokLens?.bingeStreaks.length).toBeGreaterThan(0);
    } finally {
      close();
    }
  });
});
