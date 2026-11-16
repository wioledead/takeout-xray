import { describe, expect, it } from 'vitest';
import type { ExportFormat } from '../types/domain';
import { getFormatProfile } from '../utils/formatProfile';
import { getSqlPresets } from '../worker/queries.sql';

const ALL_FORMATS: ExportFormat[] = [
  'tg_chat',
  'tg_account',
  'whatsapp',
  'discord',
  'chatgpt',
  'claude_ai',
  'antigravity',
  'claude_code',
  'youtube',
  'tiktok',
  'spotify',
  'chrome_history',
  'twitter',
];

describe('getFormatProfile domain adaptation', () => {
  it('enables conversation initiators only for multi-party messengers', () => {
    const messengers: ExportFormat[] = ['tg_chat', 'tg_account', 'whatsapp', 'discord'];
    const nonMessengers = ALL_FORMATS.filter((f) => !messengers.includes(f));

    for (const f of messengers) {
      const p = getFormatProfile(f);
      expect(p.archetype).toBe('messenger');
      expect(p.hasInitiators).toBe(true);
      expect(p.hasReplyLatency).toBe(true);
      expect(p.hasMonologues).toBe(true);
      expect(p.hasQuestionRate).toBe(true);
    }

    for (const f of nonMessengers) {
      expect(getFormatProfile(f).hasInitiators).toBe(false);
    }
  });

  it('disables reply latency, monologues, and question rate on media, browser, and social feed logs', () => {
    const mediaAndBrowser: ExportFormat[] = ['youtube', 'tiktok', 'spotify', 'chrome_history', 'twitter'];

    for (const f of mediaAndBrowser) {
      const p = getFormatProfile(f);
      expect(p.hasInitiators).toBe(false);
      expect(p.hasReplyLatency).toBe(false);
      expect(p.hasMonologues).toBe(false);
      expect(p.hasQuestionRate).toBe(false);
    }
  });

  it('maps every format to valid preferred SQL preset IDs', () => {
    const validPresetIds = new Set<string>(getSqlPresets(0).map((p) => p.id));

    for (const f of ALL_FORMATS) {
      const p = getFormatProfile(f);
      expect(p.preferredSqlPresetIds.length).toBeGreaterThan(0);
      for (const presetId of p.preferredSqlPresetIds) {
        expect(validPresetIds.has(presetId)).toBe(true);
      }
    }
  });
});
