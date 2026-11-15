export type ExportFormat = 'tg_chat' | 'tg_account' | 'chatgpt' | 'chrome_history';

export type ThreadKind = 'personal_chat' | 'private_group' | 'conversation' | 'browser';

export type EventKind = 'message' | 'service' | 'visit';

export type DemoKind = 'telegram' | 'chatgpt' | 'chrome';

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

export interface LexiconMetrics {
  topWords: WordFrequency[];
  wordsByYear: YearlyWords[];
  topEmojis: EmojiFrequency[];
  questionRateBySender: QuestionRateStat[];
  chatgptLens?: ChatGptLensMetrics;
  chromeLens?: ChromeLensMetrics;
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
