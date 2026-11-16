export type ExportFormat =
  | 'tg_chat'
  | 'tg_account'
  | 'chatgpt'
  | 'claude_ai'
  | 'chrome_history'
  | 'antigravity'
  | 'claude_code'
  | 'whatsapp'
  | 'discord'
  | 'spotify'
  | 'youtube'
  | 'tiktok';

export type ThreadKind =
  | 'personal_chat'
  | 'private_group'
  | 'conversation'
  | 'browser'
  | 'antigravity_session'
  | 'channel'
  | 'streaming'
  | 'video';

export type EventKind = 'message' | 'service' | 'visit';

export type DemoKind =
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'chatgpt'
  | 'claude_ai'
  | 'antigravity'
  | 'claude_code'
  | 'youtube'
  | 'spotify'
  | 'tiktok'
  | 'chrome';

export type TabId = 'overview' | 'behavior' | 'lexicon' | 'sql';

export type Language = 'en' | 'ru';

export interface NormalizedThread {
  thread_id: string;
  source_type: ExportFormat;
  title: string;
  thread_kind: ThreadKind;
  extra_count: number;
}

export interface NormalizedEvent {
  event_id: string;
  thread_id: string;
  source_type: ExportFormat;
  event_kind: EventKind;
  ts_ms: number;
  sender_id: string;
  sender_name: string;
  text_content: string;
  char_count: number;
  word_count: number;
  question_count: number;
  has_code: boolean;
  has_media: boolean;
  emojis: string[];
  domain: string | null;
  meta_subtype: string | null;
}

export interface IngestionProgress {
  phase: 'detecting' | 'streaming' | 'indexing' | 'ready';
  format?: ExportFormat;
  bytesRead: number;
  totalBytes: number;
  rowsIngested: number;
  threadsFound: number;
  elapsedMs: number;
}

export interface HeatmapCell {
  dow: number; // 1 (Mon) .. 7 (Sun)
  hour: number; // 0 .. 23
  count: number;
}

export interface TimelineBucket {
  bucket: string; // YYYY-MM or YYYY-MM-DD
  count: number;
}

export interface SenderBreakdown {
  senderName: string;
  eventCount: number;
  wordCount: number;
  charCount: number;
  sharePct: number;
}

export interface OverviewMetrics {
  totalEvents: number;
  totalThreads: number;
  totalWords: number;
  totalChars: number;
  totalMedia: number;
  totalServiceEvents: number;
  activeDays: number;
  firstEventTs: number | null;
  lastEventTs: number | null;
  extraBranchCount: number;
  heatmap: HeatmapCell[];
  timeline: TimelineBucket[];
  topSenders: SenderBreakdown[];
  threads: NormalizedThread[];
}

export interface InitiatorStat {
  senderName: string;
  sessionsStarted: number;
  sharePct: number;
}

export interface ReplyLatencyStat {
  senderName: string;
  medianLatencySec: number;
  replyCount: number;
}

export interface MonologueStat {
  senderName: string;
  maxStreak: number;
  avgPerTurn: number;
  monologues5Plus: number;
}

export interface HourlyBucket {
  hour: number;
  count: number;
}

export interface BehaviorMetrics {
  initiators: InitiatorStat[];
  replyLatency: ReplyLatencyStat[];
  monologues: MonologueStat[];
  hourlyBreakdown: HourlyBucket[];
  nightOwlPct: number;
  peakHour: number;
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface YearlyWords {
  year: number;
  words: WordFrequency[];
}

export interface EmojiFrequency {
  emoji: string;
  count: number;
}

export interface QuestionRateStat {
  senderName: string;
  questionCount: number;
  messageCount: number;
  questionPct: number;
}

export interface ChatGptLensMetrics {
  userChars: number;
  assistantChars: number;
  userMessages: number;
  assistantMessages: number;
  politePromptPct: number;
  codeBlockPct: number;
  regeneratedBranches: number;
  peakPromptHour: number;
}

export interface ChromeDomainStat {
  domain: string;
  visits: number;
  sharePct: number;
}

export interface ChromeTransitionStat {
  transition: string;
  count: number;
  sharePct: number;
}

export interface ChromeRabbitHole {
  domain: string;
  streakCount: number;
  startTs: number;
}

export interface ChromeLensMetrics {
  topDomains: ChromeDomainStat[];
  transitions: ChromeTransitionStat[];
  rabbitHoles: ChromeRabbitHole[];
}

export interface NormalizedAntigravityStep {
  step_id: string;
  thread_id: string;
  step_index: number;
  step_type: string;
  ts_ms: number;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  thinking_chars: number;
  reply_chars: number;
  tool_call_count: number;
  tool_names: string[];
}

export interface AntigravityToolStat {
  toolName: string;
  calls: number;
  sharePct: number;
}

export interface AntigravityLensMetrics {
  userPrompts: number;
  plannerSteps: number;
  toolExecutions: number;
  totalInputTokens: number;
  totalCacheReadTokens: number;
  totalOutputTokens: number;
  cacheHitPct: number;
  thinkingChars: number;
  replyChars: number;
  checkpoints: number;
  errors: number;
  topTools: AntigravityToolStat[];
}

export interface NormalizedMediaEvent {
  media_id: string;
  thread_id: string;
  source_type: ExportFormat;
  ts_ms: number;
  creator_name: string;
  item_title: string;
  album_or_sub: string | null;
  ms_played: number;
  is_skipped: boolean;
  is_shuffle: boolean;
  platform: string | null;
}

export interface SpotifyEntityStat {
  name: string;
  plays: number;
  minutes: number;
  artist?: string;
}

export interface SpotifyLensMetrics {
  totalHours: number;
  totalPlays: number;
  uniqueArtists: number;
  uniqueTracks: number;
  skipPct: number;
  shufflePct: number;
  topArtists: SpotifyEntityStat[];
  topTracks: SpotifyEntityStat[];
}

export interface YouTubeChannelStat {
  channel: string;
  videos: number;
  sharePct: number;
}

export interface YouTubeBingeStreak {
  channel: string;
  streakCount: number;
  startTs: number;
}

export interface YouTubeLensMetrics {
  totalVideos: number;
  uniqueChannels: number;
  shortsCount: number;
  shortsPct: number;
  topChannels: YouTubeChannelStat[];
  bingeStreaks: YouTubeBingeStreak[];
}

export interface TikTokCreatorStat {
  creator: string;
  videos: number;
  sharePct: number;
}

export interface TikTokLensMetrics {
  totalVideos: number;
  totalLikes: number;
  totalSearches: number;
  uniqueCreators: number;
  likeRatePct: number;
  topCreators: TikTokCreatorStat[];
  bingeStreaks: YouTubeBingeStreak[];
}

export interface LexiconMetrics {
  topWords: WordFrequency[];
  wordsByYear: YearlyWords[];
  topEmojis: EmojiFrequency[];
  questionRateBySender: QuestionRateStat[];
  chatgptLens?: ChatGptLensMetrics;
  chromeLens?: ChromeLensMetrics;
  antigravityLens?: AntigravityLensMetrics;
  spotifyLens?: SpotifyLensMetrics;
  youtubeLens?: YouTubeLensMetrics;
  tiktokLens?: TikTokLensMetrics;
}

export type SqlCellValue = string | number | boolean | null;

export interface SqlQueryResult {
  columns: string[];
  rows: Array<Record<string, SqlCellValue>>;
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
}

export interface DashboardSnapshot {
  format: ExportFormat;
  selectedThreadId: string;
  overview: OverviewMetrics;
  behavior: BehaviorMetrics;
  lexicon: LexiconMetrics;
}
