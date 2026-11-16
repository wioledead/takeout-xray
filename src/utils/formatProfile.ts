import type { ExportFormat } from '../types/domain';

export type ServiceArchetype =
  | 'messenger'
  | 'ai_chat'
  | 'coding_agent'
  | 'media_video'
  | 'media_audio'
  | 'browser'
  | 'social_feed';

export interface FormatProfile {
  archetype: ServiceArchetype;
  /** True only for multi-party chats where "who texted first after 6h" makes sense. */
  hasInitiators: boolean;
  /** True when alternating turn-taking turnaround latency applies (messengers, AI chats, agents). */
  hasReplyLatency: boolean;
  /** True when consecutive-message monologue streaks reflect conversational cadence. */
  hasMonologues: boolean;
  /** True when per-sender question rate is meaningful. */
  hasQuestionRate: boolean;
  /** SQL preset IDs ordered by relevance to the active archive format. */
  preferredSqlPresetIds: readonly string[];
}

const PROFILES: Record<ExportFormat, FormatProfile> = {
  tg_chat: {
    archetype: 'messenger',
    hasInitiators: true,
    hasReplyLatency: true,
    hasMonologues: true,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['monologues', 'responseTimes', 'lateNight', 'emojis', 'domains', 'hourlyVolume'],
  },
  tg_account: {
    archetype: 'messenger',
    hasInitiators: true,
    hasReplyLatency: true,
    hasMonologues: true,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['monologues', 'responseTimes', 'lateNight', 'emojis', 'domains', 'hourlyVolume'],
  },
  whatsapp: {
    archetype: 'messenger',
    hasInitiators: true,
    hasReplyLatency: true,
    hasMonologues: true,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['monologues', 'responseTimes', 'lateNight', 'emojis', 'domains', 'hourlyVolume'],
  },
  discord: {
    archetype: 'messenger',
    hasInitiators: true,
    hasReplyLatency: true,
    hasMonologues: true,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['monologues', 'responseTimes', 'lateNight', 'domains', 'emojis', 'hourlyVolume'],
  },
  chatgpt: {
    archetype: 'ai_chat',
    hasInitiators: false,
    hasReplyLatency: true,
    hasMonologues: true,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['lateNight', 'hourlyVolume', 'responseTimes', 'monologues', 'domains'],
  },
  claude_ai: {
    archetype: 'ai_chat',
    hasInitiators: false,
    hasReplyLatency: true,
    hasMonologues: true,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['lateNight', 'hourlyVolume', 'responseTimes', 'monologues', 'domains'],
  },
  antigravity: {
    archetype: 'coding_agent',
    hasInitiators: false,
    hasReplyLatency: true,
    hasMonologues: false,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['antigravityTools', 'antigravityTokens', 'lateNight', 'hourlyVolume'],
  },
  claude_code: {
    archetype: 'coding_agent',
    hasInitiators: false,
    hasReplyLatency: true,
    hasMonologues: false,
    hasQuestionRate: true,
    preferredSqlPresetIds: ['antigravityTools', 'antigravityTokens', 'lateNight', 'hourlyVolume'],
  },
  youtube: {
    archetype: 'media_video',
    hasInitiators: false,
    hasReplyLatency: false,
    hasMonologues: false,
    hasQuestionRate: false,
    preferredSqlPresetIds: ['youtubeChannels', 'lateNight', 'hourlyVolume'],
  },
  tiktok: {
    archetype: 'media_video',
    hasInitiators: false,
    hasReplyLatency: false,
    hasMonologues: false,
    hasQuestionRate: false,
    preferredSqlPresetIds: ['youtubeChannels', 'lateNight', 'hourlyVolume'],
  },
  spotify: {
    archetype: 'media_audio',
    hasInitiators: false,
    hasReplyLatency: false,
    hasMonologues: false,
    hasQuestionRate: false,
    preferredSqlPresetIds: ['spotifyArtists', 'lateNight', 'hourlyVolume'],
  },
  chrome_history: {
    archetype: 'browser',
    hasInitiators: false,
    hasReplyLatency: false,
    hasMonologues: false,
    hasQuestionRate: false,
    preferredSqlPresetIds: ['domains', 'lateNight', 'hourlyVolume'],
  },
  twitter: {
    archetype: 'social_feed',
    hasInitiators: false,
    hasReplyLatency: false,
    hasMonologues: false,
    hasQuestionRate: false,
    preferredSqlPresetIds: ['twitterPosts', 'domains', 'lateNight', 'emojis', 'hourlyVolume'],
  },
};

/** Returns domain capabilities and section adaptation rules for any supported export format. */
export function getFormatProfile(format: ExportFormat): FormatProfile {
  return PROFILES[format];
}
