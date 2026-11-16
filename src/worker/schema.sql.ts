export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS threads (
  thread_id VARCHAR PRIMARY KEY,
  source_type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  thread_kind VARCHAR NOT NULL,
  extra_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  event_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,
  event_kind VARCHAR NOT NULL,
  ts_ms BIGINT NOT NULL,
  sender_id VARCHAR NOT NULL,
  sender_name VARCHAR NOT NULL,
  text_content VARCHAR NOT NULL,
  char_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  has_code BOOLEAN NOT NULL,
  has_media BOOLEAN NOT NULL,
  emojis VARCHAR[] NOT NULL,
  domain VARCHAR,
  meta_subtype VARCHAR
);

CREATE TABLE IF NOT EXISTS antigravity_steps (
  step_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  step_index INTEGER NOT NULL,
  step_type VARCHAR NOT NULL,
  ts_ms BIGINT NOT NULL,
  input_tokens BIGINT NOT NULL,
  cache_read_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  thinking_chars INTEGER NOT NULL,
  reply_chars INTEGER NOT NULL,
  tool_call_count INTEGER NOT NULL,
  tool_names VARCHAR[] NOT NULL
);

CREATE TABLE IF NOT EXISTS media_events (
  media_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,
  ts_ms BIGINT NOT NULL,
  creator_name VARCHAR NOT NULL,
  item_title VARCHAR NOT NULL,
  album_or_sub VARCHAR,
  ms_played BIGINT NOT NULL,
  is_skipped BOOLEAN NOT NULL,
  is_shuffle BOOLEAN NOT NULL,
  platform VARCHAR
);

CREATE TABLE IF NOT EXISTS stopwords (
  word VARCHAR PRIMARY KEY
);
`;

export const RESET_SESSION_TABLES_SQL = `
DROP TABLE IF EXISTS media_events;
DROP TABLE IF EXISTS antigravity_steps;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS threads;
CREATE TABLE threads (
  thread_id VARCHAR PRIMARY KEY,
  source_type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  thread_kind VARCHAR NOT NULL,
  extra_count INTEGER DEFAULT 0
);
CREATE TABLE events (
  event_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,
  event_kind VARCHAR NOT NULL,
  ts_ms BIGINT NOT NULL,
  sender_id VARCHAR NOT NULL,
  sender_name VARCHAR NOT NULL,
  text_content VARCHAR NOT NULL,
  char_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  has_code BOOLEAN NOT NULL,
  has_media BOOLEAN NOT NULL,
  emojis VARCHAR[] NOT NULL,
  domain VARCHAR,
  meta_subtype VARCHAR
);
CREATE TABLE antigravity_steps (
  step_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  step_index INTEGER NOT NULL,
  step_type VARCHAR NOT NULL,
  ts_ms BIGINT NOT NULL,
  input_tokens BIGINT NOT NULL,
  cache_read_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  thinking_chars INTEGER NOT NULL,
  reply_chars INTEGER NOT NULL,
  tool_call_count INTEGER NOT NULL,
  tool_names VARCHAR[] NOT NULL
);
CREATE TABLE media_events (
  media_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,
  ts_ms BIGINT NOT NULL,
  creator_name VARCHAR NOT NULL,
  item_title VARCHAR NOT NULL,
  album_or_sub VARCHAR,
  ms_played BIGINT NOT NULL,
  is_skipped BOOLEAN NOT NULL,
  is_shuffle BOOLEAN NOT NULL,
  platform VARCHAR
);
`;

export const STOPWORDS_LIST: readonly string[] = [
  // English (~75)
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'not', 'are', 'from',
  'your', 'have', 'was', 'but', 'what', 'all', 'when', 'can', 'there', 'use',
  'just', 'like', 'about', 'into', 'than', 'more', 'other', 'some', 'could',
  'would', 'should', 'their', 'which', 'will', 'one', 'out', 'who', 'get',
  'how', 'has', 'been', 'were', 'they', 'had', 'his', 'her', 'she', 'him',
  'our', 'its', 'also', 'then', 'them', 'these', 'those', 'only', 'very',
  'here', 'where', 'why', 'well', 'now', 'yes', 'yeah', 'yep', 'nah', 'okay',
  'are', 'too', 'did', 'does', 'doing', 'done', 'dont', "don't", 'cant', 'http',
  'https', 'com', 'www', 'org', 'net',
  // Russian (~75)
  'это', 'как', 'так', 'над', 'для', 'что', 'кто', 'они', 'она', 'оно',
  'при', 'без', 'под', 'про', 'или', 'уже', 'еще', 'ещё', 'вот', 'тут',
  'там', 'где', 'когда', 'если', 'только', 'даже', 'просто', 'очень', 'чтобы',
  'будет', 'было', 'были', 'был', 'была', 'есть', 'нет', 'мне', 'меня',
  'тебе', 'тебя', 'ему', 'его', 'ней', 'нам', 'вам', 'них', 'мой', 'твой',
  'свой', 'наш', 'ваш', 'все', 'всё', 'всех', 'всем', 'этого', 'этот', 'эта',
  'эти', 'того', 'том', 'также', 'через', 'после', 'потому', 'поэтому', 'может',
  'можно', 'нужно', 'надо', 'хорошо', 'ладно', 'пока', 'привет', 'давай', 'буду',
  'сейчас', 'потом', 'тоже', 'вообще', 'конечно', 'кстати',
];
