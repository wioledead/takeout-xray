import { describe, expect, it } from 'vitest';
import { BlobWriter, configure as configureZip, TextReader, ZipWriter } from '@zip.js/zip.js';
import type {
  NormalizedAntigravityStep,
  NormalizedEvent,
  NormalizedMediaEvent,
  NormalizedThread,
} from '../types/domain';
import { prepareIngestSelection } from '../utils/antigravityFiles';
import { inspectZipArchive, withZipEntryStream } from '../utils/zipExtractor';
import {
  cleanAntigravityUserPrompt,
  parseAntigravityStream,
} from '../worker/adapters/antigravity';
import { parseChatGptStream } from '../worker/adapters/chatgpt';
import { parseChromeStream } from '../worker/adapters/chrome';
import { parseClaudeAiStream } from '../worker/adapters/claudeAi';
import { parseClaudeCodeStream } from '../worker/adapters/claudeCode';
import {
  detectAndWrapStream,
  detectExportFormat,
  detectFileFormat,
  UnsupportedFormatError,
} from '../worker/adapters/detector';
import { parseDiscordStream } from '../worker/adapters/discord';
import { parseSpotifyStream } from '../worker/adapters/spotify';
import { parseTelegramStream } from '../worker/adapters/telegram';
import { parseTikTokStream } from '../worker/adapters/tiktok';
import { decodeTwitterSnowflakeMs, parseTwitterStream } from '../worker/adapters/twitter';
import { parseWhatsAppStream } from '../worker/adapters/whatsapp';
import { parseYouTubeStream } from '../worker/adapters/youtube';

function createChunkedStream(jsonText: string, chunkSize = 64): {
  stream: ReadableStream<Uint8Array>;
  totalBytes: number;
} {
  const bytes = new TextEncoder().encode(jsonText);
  let offset = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const nextOffset = Math.min(offset + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(offset, nextOffset));
      offset = nextOffset;
    },
  });

  return { stream, totalBytes: bytes.length };
}

describe('Format detector', () => {
  it('identifies all 5 supported formats and rejects unknown input', () => {
    expect(detectExportFormat('{"Browser History": []}')).toBe('chrome_history');
    expect(detectExportFormat('[{"title":"Hi","current_node":"a","mapping":{}}]')).toBe('chatgpt');
    expect(detectExportFormat('{"about":"...","chats":{"list":[]}}')).toBe('tg_account');
    expect(detectExportFormat('{"name":"Alice","type":"personal_chat","messages":[]}')).toBe('tg_chat');
    expect(
      detectExportFormat(
        '{"step_index":0,"source":"USER_EXPLICIT","type":"USER_INPUT","created_at":"2026-11-15T20:00:00Z","content":"hi"}\n',
      ),
    ).toBe('antigravity');
    expect(() => detectExportFormat('{"foo":"bar"}')).toThrow(UnsupportedFormatError);
  });

  it('detects real-world ChatGPT files >40KB where current_node is past 16KB and text mentions "messages"', async () => {
    const bigText = 'This conversation discusses "messages" parsing. ' + 'x'.repeat(35000);
    const largeChatGpt = JSON.stringify([
      {
        id: 'conv_big',
        title: 'Huge first conversation',
        create_time: 1710000000,
        mapping: {
          root: { id: 'root', parent: null, message: null },
          n1: {
            id: 'n1',
            parent: 'root',
            message: { id: 'm1', author: { role: 'user' }, create_time: 1710000001, content: { parts: [bigText] } },
          },
        },
        current_node: 'n1',
      },
    ]);
    const blob = new Blob([largeChatGpt], { type: 'application/json' });
    await expect(detectFileFormat(blob)).resolves.toBe('chatgpt');
  });

  it('detects full Telegram account export even when >80KB of contacts precede chats.list', async () => {
    const contacts = Array.from({ length: 1200 }, (_, i) => ({
      first_name: `Contact_${i}`,
      phone_number: `+1000000${i}`,
    }));
    const fullExport = JSON.stringify({
      about: 'Telegram Desktop full export',
      contacts: { about: 'contacts list', list: contacts },
      chats: {
        about: 'All chats',
        list: [{ name: 'General', type: 'personal_chat', id: 1, messages: [] }],
      },
    });
    expect(fullExport.indexOf('"chats"')).toBeGreaterThan(65536);
    const blob = new Blob([fullExport], { type: 'application/json' });
    await expect(detectFileFormat(blob)).resolves.toBe('tg_account');
  });
});

describe('Telegram streaming adapter', () => {
  it('handles polymorphic text arrays, service messages, missing sender, and 64-byte UTF-8 chunk boundaries', async () => {
    const payload = {
      name: 'Лаборатория X-Ray 🚀',
      type: 'private_group',
      id: 777,
      messages: [
        {
          id: 1,
          type: 'message',
          date_unixtime: '1710466867',
          from: 'Алиса',
          from_id: 'user101',
          text: [
            'Привет ',
            { type: 'bold', text: 'мир' },
            '! Посмотри ',
            { type: 'text_link', text: 'репо', href: 'https://www.github.com/duckdb/duckdb-wasm' },
            ' и код: ',
            { type: 'pre', text: 'SELECT 1;' },
            ' 🔥👨‍💻',
          ],
        },
        {
          id: 2,
          type: 'service',
          date_unixtime: '1710466900',
          actor: 'Алиса',
          action: 'pin_message',
          text: '',
        },
        {
          id: 3,
          type: 'message',
          date: '2024-03-15T10:00:00Z',
          text: 'Saved note without from field? 🚀',
          photo: 'photos/img_01.jpg',
        },
      ],
    };

    const { stream, totalBytes } = createChunkedStream(JSON.stringify(payload), 64);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];
    let batchCount = 0;

    await parseTelegramStream(
      {
        stream,
        totalBytes,
        batchSize: 2,
        onBatch: (t, e) => {
          batchCount++;
          threads.push(...t);
          events.push(...e);
        },
      },
      'tg_chat',
    );

    expect(batchCount).toBeGreaterThanOrEqual(2);
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toBe('Лаборатория X-Ray 🚀');
    expect(threads[0].thread_kind).toBe('private_group');

    expect(events).toHaveLength(3);
    const [m1, m2, m3] = events;
    expect(m1.text_content).toBe('Привет мир! Посмотри репо и код: SELECT 1; 🔥👨‍💻');
    expect(m1.text_content).not.toContain('\uFFFD');
    expect(m1.ts_ms).toBe(1710466867000);
    expect(m1.has_code).toBe(true);
    expect(m1.domain).toBe('github.com');
    expect(m1.emojis).toEqual(['🔥', '👨‍💻']);

    expect(m2.event_kind).toBe('service');
    expect(m2.meta_subtype).toBe('pin_message');
    expect(m2.word_count).toBe(0);

    expect(m3.sender_name).toBe('Unknown');
    expect(m3.has_media).toBe(true);
    expect(m3.question_count).toBe(1);
    expect(m3.emojis).toEqual(['🚀']);
  });

  it('streams tg_account chats.list even when messages precede name and id keys', async () => {
    const accountPayload = {
      chats: {
        list: [
          {
            messages: [
              { id: 10, type: 'message', date_unixtime: '1700000000', from: 'Bob', text: 'First chat msg' },
            ],
            name: 'Out-of-Order Chat',
            type: 'personal_chat',
            id: 111,
          },
          {
            id: 222,
            type: 'saved_messages',
            messages: [
              { id: 20, type: 'message', date_unixtime: '1700000100', text: 'Note to self' },
            ],
          },
        ],
      },
    };

    const { stream, totalBytes } = createChunkedStream(JSON.stringify(accountPayload), 64);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];

    await parseTelegramStream(
      {
        stream,
        totalBytes,
        onBatch: (t, e) => {
          threads.push(...t);
          events.push(...e);
        },
      },
      'tg_account',
    );

    expect(threads).toHaveLength(2);
    expect(threads[0].title).toBe('Out-of-Order Chat');
    expect(threads[1].title).toBe('Saved Messages');
    expect(events).toHaveLength(2);
    expect(events[0].thread_id).toBe(threads[0].thread_id);
    expect(events[1].thread_id).toBe(threads[1].thread_id);
  });
});

describe('ChatGPT streaming adapter', () => {
  it('walks active DAG path from current_node, counts regenerated branches, and guards against cycles', async () => {
    const conversations = [
      {
        id: 'conv_1',
        title: 'Rust & DuckDB',
        create_time: 1710000000,
        current_node: 'node_3_active',
        mapping: {
          root: { id: 'root', parent: null, message: null },
          node_1: {
            id: 'node_1',
            parent: 'root',
            message: {
              id: 'm1',
              author: { role: 'user' },
              create_time: 1710000010,
              content: { parts: ['Please explain DuckDB?', { content_type: 'image_asset_pointer', asset_pointer: 'file://img' }] },
            },
          },
          node_2_abandoned: {
            id: 'node_2_abandoned',
            parent: 'node_1',
            message: {
              id: 'm2_old',
              author: { role: 'assistant' },
              create_time: 1710000015,
              content: { parts: ['Old discarded generation'] },
            },
          },
          node_2_active: {
            id: 'node_2_active',
            parent: 'node_1',
            message: {
              id: 'm2_new',
              author: { role: 'assistant' },
              create_time: 1710000020,
              content: { parts: ['Here is SQL:\n```sql\nSELECT 42;\n```'] },
            },
          },
          node_3_active: {
            id: 'node_3_active',
            parent: 'node_2_active',
            message: {
              id: 'm3',
              author: { role: 'user' },
              create_time: 1710000030,
              content: { parts: ['Спасибо!'] },
            },
          },
        },
      },
      {
        id: 'conv_cyclic',
        title: 'Cyclic Safety',
        create_time: 1710000100,
        current_node: 'a',
        mapping: {
          a: {
            id: 'a',
            parent: 'b',
            message: { id: 'ma', author: { role: 'assistant' }, create_time: 1710000102, content: { parts: ['Reply'] } },
          },
          b: {
            id: 'b',
            parent: 'a',
            message: { id: 'mb', author: { role: 'user' }, create_time: 1710000101, content: { parts: ['Prompt'] } },
          },
        },
      },
    ];

    const { stream, totalBytes } = createChunkedStream(JSON.stringify(conversations), 64);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];

    await parseChatGptStream({
      stream,
      totalBytes,
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
    });

    expect(threads).toHaveLength(2);
    expect(threads[0].extra_count).toBe(1); // node_2_abandoned was excluded from active path

    const conv1Events = events.filter((e) => e.thread_id === 'conv_1');
    expect(conv1Events.map((e) => e.text_content)).toEqual([
      'Please explain DuckDB?',
      'Here is SQL:\n```sql\nSELECT 42;\n```',
      'Спасибо!',
    ]);
    expect(conv1Events[0].has_media).toBe(true);
    expect(conv1Events[0].question_count).toBe(1);
    expect(conv1Events[1].has_code).toBe(true);

    const cyclicEvents = events.filter((e) => e.thread_id === 'conv_cyclic');
    expect(cyclicEvents).toHaveLength(2);
  });

  it('falls back to latest message node when current_node is missing or null', async () => {
    const conversations = [
      {
        id: 'conv_no_current',
        title: 'Missing current_node',
        create_time: 1710000000,
        current_node: null,
        mapping: {
          root: { id: 'root', parent: null, message: null },
          n1: {
            id: 'n1',
            parent: 'root',
            message: { id: 'm1', author: { role: 'user' }, create_time: 1710000010, content: { parts: ['First prompt'] } },
          },
          n2: {
            id: 'n2',
            parent: 'n1',
            message: { id: 'm2', author: { role: 'assistant' }, create_time: 1710000020, content: { parts: ['Fallback reply'] } },
          },
        },
      },
    ];

    const { stream, totalBytes } = createChunkedStream(JSON.stringify(conversations), 64);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];

    await parseChatGptStream({
      stream,
      totalBytes,
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
    });

    expect(threads).toHaveLength(1);
    expect(events.map((e) => e.text_content)).toEqual(['First prompt', 'Fallback reply']);
  });
});

describe('Chrome BrowserHistory streaming adapter', () => {
  it('converts time_usec accurately and falls back cleanly on special/malformed URLs', async () => {
    const history = {
      'Browser History': [
        {
          url: 'https://www.arxiv.org/abs/2401.00001',
          title: 'Attention Paper',
          time_usec: 1710466867123456,
          page_transition: 'typed',
          client_id: 'desktop_01',
        },
        {
          url: 'chrome://extensions/',
          title: 'Extensions',
          time_usec: 1710466900000000,
          page_transition: 'AUTO_BOOKMARK',
        },
        {
          url: 'not a valid url',
          title: 'Corrupt Entry',
          time_usec: 1710466910000000,
        },
      ],
    };

    const { stream, totalBytes } = createChunkedStream(JSON.stringify(history), 64);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];

    await parseChromeStream({
      stream,
      totalBytes,
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
    });

    expect(threads).toHaveLength(1);
    expect(events).toHaveLength(3);
    expect(events[0].ts_ms).toBe(1710466867123);
    expect(events[0].domain).toBe('arxiv.org');
    expect(events[0].meta_subtype).toBe('TYPED');
    expect(events[1].domain).toBe('chrome://');
    expect(events[2].domain).toBe('unknown');
  });
});

describe('Antigravity 2.0 streaming adapter & folder deduplication', () => {
  it('cleans USER_REQUEST wrappers, strips metadata, parses tool_calls and tokens across 64-byte chunks', async () => {
    const lines = [
      JSON.stringify({
        step_index: 0,
        source: 'USER_EXPLICIT',
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: '2026-11-15T20:00:00Z',
        content:
          '<USER_REQUEST>\nПроверь логи парсера 🚀?\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nLANGUAGE_UNSPECIFIED os: windows\n</ADDITIONAL_METADATA>',
      }),
      JSON.stringify({
        step_index: 1,
        source: 'MODEL',
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-15T20:00:04Z',
        input_tokens: 4000,
        cache_read_tokens: 16000,
        output_tokens: 320,
        thinking: 'Checking transcript lines carefully...',
        content: '',
        tool_calls: [{ name: 'run_command', args: {} }, { name: 'read_file', args: {} }],
      }),
      JSON.stringify({
        step_index: 2,
        source: 'MODEL',
        type: 'GENERIC',
        status: 'DONE',
        created_at: '2026-11-15T20:00:06Z',
        content: 'tool stdout blob that should not pollute top words',
      }),
      JSON.stringify({
        step_index: 3,
        source: 'MODEL',
        type: 'PLANNER_RESPONSE',
        status: 'DONE',
        created_at: '2026-11-15T20:00:10Z',
        input_tokens: 1000,
        cache_read_tokens: 19000,
        output_tokens: 480,
        thinking: 'Final response ready',
        content: 'Всё проверено! ```ts\nconsole.log(1);\n```',
      }),
      JSON.stringify({
        step_index: 4,
        source: 'SYSTEM',
        type: 'CHECKPOINT',
        status: 'DONE',
        created_at: '2026-11-15T20:00:12Z',
        input_tokens: 500,
        cache_read_tokens: 19500,
        output_tokens: 120,
        content: 'compacted summary',
      }),
    ];

    const jsonl = `${lines.join('\n')}\n{"step_index":5,"source":"MODEL"`; // truncated tail from active session
    const { stream, totalBytes } = createChunkedStream(jsonl, 64);

    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];
    const steps: NormalizedAntigravityStep[] = [];

    await parseAntigravityStream({
      stream,
      totalBytes,
      sessionHint: 'brain/09e83be3-5b90-49fd-a73c-0ec4475f44f6/.system_generated/logs/transcript_full.jsonl',
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
      onStepBatch: (s) => {
        steps.push(...s);
      },
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].thread_id).toBe('ag_09e83be3-5b90-49fd-a73c-0ec4475f44f6');
    expect(threads[0].title).toContain('09e83be3 · Проверь логи парсера');
    expect(threads[0].extra_count).toBe(1);

    expect(cleanAntigravityUserPrompt(JSON.parse(lines[0]).content)).toBe('Проверь логи парсера 🚀?');
    expect(events).toHaveLength(5);
    expect(events[0].event_kind).toBe('message');
    expect(events[0].sender_name).toBe('User');
    expect(events[0].text_content).toBe('Проверь логи парсера 🚀?');
    expect(events[1].event_kind).toBe('service');
    expect(events[1].meta_subtype).toBe('tool_turn');
    expect(events[2].event_kind).toBe('service');
    expect(events[2].text_content).toBe('');
    expect(events[3].event_kind).toBe('message');
    expect(events[3].has_code).toBe(true);
    expect(events[4].meta_subtype).toBe('checkpoint');

    expect(steps).toHaveLength(5);
    expect(steps[1].tool_names).toEqual(['run_command', 'read_file']);
    expect(steps[1].thinking_chars).toBeGreaterThan(10);
  });

  it('deduplicates transcript_full.jsonl over transcript.jsonl per brain directory', () => {
    const f1Compact = new File(['{"step_index":0}'], 'transcript.jsonl');
    const f1Full = new File(['{"step_index":0,"full":true}'], 'transcript_full.jsonl');
    const f2Compact = new File(['{"step_index":0}'], 'transcript.jsonl');
    const unrelated = new File(['ignored'], 'image.png');
    const empty = new File([], 'transcript.jsonl');

    const selected = prepareIngestSelection([
      { file: f1Compact, relativePath: 'brain/11111111-1111-1111-1111-111111111111/.system_generated/logs/transcript.jsonl' },
      { file: f1Full, relativePath: 'brain/11111111-1111-1111-1111-111111111111/.system_generated/logs/transcript_full.jsonl' },
      { file: f2Compact, relativePath: 'brain/22222222-2222-2222-2222-222222222222/.system_generated/logs/transcript.jsonl' },
      { file: unrelated, relativePath: 'brain/11111111-1111-1111-1111-111111111111/image.png' },
      { file: empty, relativePath: 'brain/33333333-3333-3333-3333-333333333333/.system_generated/logs/transcript.jsonl' },
    ]);

    expect(selected).toHaveLength(2);
    expect(selected.map((s) => s.relativePath)).toEqual([
      'brain/11111111-1111-1111-1111-111111111111/.system_generated/logs/transcript_full.jsonl',
      'brain/22222222-2222-2222-2222-222222222222/.system_generated/logs/transcript.jsonl',
    ]);
  });
});

describe('Expanded multi-service format detection & streaming adapters', () => {
  it('detects all 12 personal archive formats including Claude, WhatsApp, Discord, Spotify, YouTube, TikTok', () => {
    expect(
      detectExportFormat('[{"uuid":"c1","name":"Test","chat_messages":[{"uuid":"m1","sender":"human","text":"hi"}]}]'),
    ).toBe('claude_ai');
    expect(
      detectExportFormat(
        '{"type":"user","timestamp":"2025-10-01T12:00:00Z","sessionId":"s1","message":{"role":"user","content":"fix"}}\n',
      ),
    ).toBe('claude_code');
    expect(detectExportFormat('[15/03/2024, 14:22:05] Alice: Hello there!')).toBe('whatsapp');
    expect(detectExportFormat('3/25/24, 9:15 PM - Bob: Meeting soon')).toBe('whatsapp');
    expect(
      detectExportFormat('[{"ID":"100","Timestamp":"2024-02-01 10:00:00","Contents":"gm","Attachments":""}]'),
    ).toBe('discord');
    expect(
      detectExportFormat('{"guild":{"name":"Devs"},"channel":{"id":"1","name":"general"},"messages":[]}'),
    ).toBe('discord');
    expect(
      detectExportFormat('[{"ts":"2024-04-01T10:00:00Z","ms_played":180000,"master_metadata_track_name":"Intro"}]'),
    ).toBe('spotify');
    expect(
      detectExportFormat('[{"endTime":"2024-04-01 10:00","artistName":"M83","trackName":"Wait","msPlayed":120000}]'),
    ).toBe('spotify');
    expect(
      detectExportFormat('[{"header":"YouTube","title":"Watched DuckDB","titleUrl":"https://www.youtube.com/watch?v=1","time":"2024-01-01T00:00:00Z"}]'),
    ).toBe('youtube');
    expect(
      detectExportFormat('{"Activity":{"Video Browsing History":{"VideoList":[{"Date":"2024-01-01 12:00:00","Link":"https://www.tiktok.com/@user/video/1"}]}}}'),
    ).toBe('tiktok');
    expect(
      detectExportFormat('window.YTD.tweets.part0 = [{"tweet":{"created_at":"Wed Oct 16 18:24:11 +0000 2024","full_text":"hello x"}}];'),
    ).toBe('twitter');
    expect(
      detectExportFormat('window.YTD.like.part0 = [{"like":{"tweetId":"1846618510000000000","fullText":"liked"}}]'),
    ).toBe('twitter');
    expect(
      detectExportFormat('[{"dmConversation":{"conversationId":"1-2","messages":[]}}]'),
    ).toBe('twitter');
  });

  it('parses Claude.ai conversations with thinking blocks and file attachments', async () => {
    const payload = JSON.stringify([
      {
        uuid: 'conv-cl-1',
        name: 'Rust lifetimes deep dive',
        created_at: '2025-05-01T10:00:00Z',
        chat_messages: [
          {
            uuid: 'm1',
            sender: 'human',
            created_at: '2025-05-01T10:00:05Z',
            text: 'Could you please explain lifetimes?',
            files: [{ file_name: 'main.rs' }],
          },
          {
            uuid: 'm2',
            sender: 'assistant',
            created_at: '2025-05-01T10:00:12Z',
            content: [
              { type: 'thinking', thinking: 'Analyze borrow checker constraints.' },
              { type: 'text', text: 'Here is an example:\n```rust\nfn foo<\'a>(x: &\'a str) -> &\'a str { x }\n```' },
            ],
          },
        ],
      },
    ]);

    const { stream, totalBytes } = createChunkedStream(payload, 32);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];

    await parseClaudeAiStream({
      stream,
      totalBytes,
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].source_type).toBe('claude_ai');
    expect(threads[0].extra_count).toBe(1);
    expect(events).toHaveLength(2);
    expect(events[0].sender_id).toBe('user');
    expect(events[0].has_media).toBe(true);
    expect(events[1].sender_id).toBe('assistant');
    expect(events[1].has_code).toBe(true);
  });

  it('parses Claude Code CLI JSONL and deduplicates token usage across identical message.id fragments', async () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        timestamp: '2025-11-01T10:00:00Z',
        sessionId: 'sess-cc-001',
        message: { role: 'user', content: '<system-reminder>ignore</system-reminder>Refactor parser' },
      }),
      JSON.stringify({
        type: 'assistant',
        timestamp: '2025-11-01T10:00:05Z',
        message: {
          id: 'msg_01ABC',
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Checking parser...' },
            { type: 'tool_use', name: 'Read', input: {} },
          ],
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 50,
            cache_read_input_tokens: 9000,
            output_tokens: 45,
          },
        },
      }),
      JSON.stringify({
        type: 'assistant',
        timestamp: '2025-11-01T10:00:06Z',
        message: {
          id: 'msg_01ABC', // Duplicate message.id fragment
          role: 'assistant',
          content: [{ type: 'text', text: 'Done!' }],
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 50,
            cache_read_input_tokens: 9000,
            output_tokens: 45,
          },
        },
      }),
      JSON.stringify({
        type: 'user',
        timestamp: '2025-11-01T10:00:07Z',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
        },
      }),
      JSON.stringify({
        type: 'summary',
        timestamp: '2025-11-01T10:00:09Z',
        summary: 'Context compacted cleanly',
      }),
    ].join('\n');

    const { stream, totalBytes } = createChunkedStream(lines, 48);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];
    const steps: NormalizedAntigravityStep[] = [];

    await parseClaudeCodeStream({
      stream,
      totalBytes,
      sessionHint: '.claude/projects/repo/12345678-1234-1234-1234-1234567890ab.jsonl',
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
      onStepBatch: (s) => {
        steps.push(...s);
      },
    });

    expect(threads).toHaveLength(1);
    expect(threads[0].source_type).toBe('claude_code');
    expect(threads[0].extra_count).toBe(1);
    expect(events[0].text_content).toBe('Refactor parser');
    expect(events[3].event_kind).toBe('service'); // tool_result only user entry
    expect(steps.reduce((s, r) => s + r.input_tokens, 0)).toBe(150);
    expect(steps.reduce((s, r) => s + r.cache_read_tokens, 0)).toBe(9000);
    expect(steps[1].tool_names).toEqual(['Read']);
  });

  it('parses Android DMY and iOS MDY WhatsApp chats with multiline continuation and media omitted markers', async () => {
    const waText = [
      '\uFEFF\u200E[3/22/24, 9:05:10 AM] Messages and calls are end-to-end encrypted.',
      '[3/22/24, 9:10:00 AM] Alice: Morning! Quick check:',
      'Did you push the PR?',
      '\u200E[3/22/24, 9:12:45 PM] Bob: \u200E<Media omitted>',
    ].join('\n');

    const { stream, totalBytes } = createChunkedStream(waText, 29);
    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];

    await parseWhatsAppStream({
      stream,
      totalBytes,
      chatTitle: 'WhatsApp Chat with Alice.txt',
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
    });

    expect(threads[0].title).toBe('Alice');
    expect(events).toHaveLength(3);
    expect(events[0].event_kind).toBe('service');
    expect(events[1].sender_name).toBe('Alice');
    expect(events[1].text_content).toContain('Did you push the PR?');
    expect(new Date(events[1].ts_ms).getMonth()).toBe(2); // March (0-indexed 2)
    expect(new Date(events[1].ts_ms).getDate()).toBe(22);
    expect(events[2].has_media).toBe(true);
  });

  it('infers MDY WhatsApp dates accurately even when the first >120 messages have day <= 12', async () => {
    const lines: string[] = [];
    for (let i = 0; i < 150; i++) {
      const day = String((i % 12) + 1).padStart(2, '0');
      lines.push(`[03/${day}/2026, 10:00:00 AM] Alice: Ambiguous date message ${i}`);
    }
    for (let i = 150; i < 154; i++) {
      lines.push(`[03/12/2026, 10:05:00 AM] Alice: Still ambiguous ${i}`);
    }
    lines.push('[03/25/2026, 11:15:00 AM] Bob: Unambiguous MDY message 155');

    const { stream, totalBytes } = createChunkedStream(lines.join('\n'), 64);
    const events: NormalizedEvent[] = [];

    await parseWhatsAppStream({
      stream,
      totalBytes,
      chatTitle: 'WhatsApp Chat with Bob.txt',
      onBatch: (_t, e) => {
        events.push(...e);
      },
    });

    expect(events).toHaveLength(155);
    expect(new Date(events[0].ts_ms).getMonth()).toBe(2);
    expect(new Date(events[0].ts_ms).getDate()).toBe(1);
    const lastDate = new Date(events[154].ts_ms);
    expect(lastDate.getFullYear()).toBe(2026);
    expect(lastDate.getMonth()).toBe(2);
    expect(lastDate.getDate()).toBe(25);
    expect(lastDate.getHours()).toBe(11);
  });

  it('parses Discord Data Package with index.json channel titles and DiscordChatExporter files', async () => {
    const pkgJson = JSON.stringify([
      { ID: '1', Timestamp: '2024-06-01 12:00:00', Contents: 'Hello DM', Attachments: 'https://cdn.discordapp.com/a.png' },
    ]);
    const pkgStream = createChunkedStream(pkgJson, 24);
    const threadsA: NormalizedThread[] = [];
    const eventsA: NormalizedEvent[] = [];

    await parseDiscordStream({
      ...pkgStream,
      channelIdHint: 'messages/c999888/messages.json',
      channelTitleMap: { '999888': 'Direct Message with Elena' },
      onBatch: (t, e) => {
        threadsA.push(...t);
        eventsA.push(...e);
      },
    });

    expect(threadsA[0].title).toBe('Direct Message with Elena');
    expect(threadsA[0].thread_kind).toBe('personal_chat');
    expect(eventsA[0].has_media).toBe(true);

    const dceJson = JSON.stringify({
      guild: { name: 'Engineering' },
      channel: { id: '555', type: 'GuildTextChat', name: 'duckdb' },
      messages: [
        { id: '10', timestamp: '2024-06-02T15:00:00Z', type: 'Default', content: 'Fast query!', author: { id: 'u1', nickname: 'Max' } },
      ],
    });
    const dceStream = createChunkedStream(dceJson, 30);
    const threadsB: NormalizedThread[] = [];
    const eventsB: NormalizedEvent[] = [];

    await parseDiscordStream({
      ...dceStream,
      onBatch: (t, e) => {
        threadsB.push(...t);
        eventsB.push(...e);
      },
    });

    expect(threadsB[0].title).toBe('Engineering / #duckdb');
    expect(eventsB[0].sender_name).toBe('Max');
  });

  it('parses Spotify, YouTube and TikTok into events + media_events', async () => {
    const spJson = JSON.stringify([
      {
        ts: '2024-07-01T21:00:00Z',
        ms_played: 195000,
        master_metadata_track_name: 'Resonance',
        master_metadata_album_artist_name: 'Home',
        master_metadata_album_album_name: 'Odyssey',
        platform: 'osx',
        skipped: false,
        shuffle: true,
      },
      {
        endTime: '2024-07-02 01:15',
        artistName: 'M83',
        trackName: 'Midnight City',
        msPlayed: 243000,
      },
    ]);
    const spMedia: NormalizedMediaEvent[] = [];
    const spEvents: NormalizedEvent[] = [];
    await parseSpotifyStream({
      ...createChunkedStream(spJson, 32),
      onBatch: (_t, e) => {
        spEvents.push(...e);
      },
      onMediaBatch: (m) => {
        spMedia.push(...m);
      },
    });
    expect(spEvents).toHaveLength(2);
    expect(spMedia).toHaveLength(2);
    expect(spMedia[0].is_shuffle).toBe(true);

    const ytJson = JSON.stringify([
      {
        header: 'YouTube',
        title: 'Просмотрено видео DuckDB Wasm Architecture',
        titleUrl: 'https://www.youtube.com/watch?v=abc',
        subtitles: [{ name: 'Fireship', url: 'https://youtube.com/@Fireship' }],
        time: '2024-08-01T19:00:00Z',
      },
      {
        header: 'YouTube',
        title: 'Watched Quick Tip',
        titleUrl: 'https://www.youtube.com/shorts/xyz',
        subtitles: [{ name: 'Fireship' }],
        time: '2024-08-01T19:05:00Z',
      },
    ]);
    const ytMedia: NormalizedMediaEvent[] = [];
    await parseYouTubeStream({
      ...createChunkedStream(ytJson, 32),
      onBatch: () => {},
      onMediaBatch: (m) => {
        ytMedia.push(...m);
      },
    });
    expect(ytMedia).toHaveLength(2);
    expect(ytMedia[0].item_title).toBe('DuckDB Wasm Architecture');
    expect(ytMedia[1].album_or_sub).toBe('shorts');

    const ttJson = JSON.stringify({
      Activity: {
        'Video Browsing History': {
          VideoList: [{ Date: '2024-09-01 10:00:00', Link: 'https://www.tiktok.com/@dev/video/1' }],
        },
        'Like List': {
          ItemFavoriteList: [{ Date: '2024-09-01 10:00:10', Link: 'https://www.tiktok.com/@dev/video/1' }],
        },
        'Search History': {
          SearchList: [{ Date: '2024-09-01 10:01:00', SearchTerm: 'duckdb wasm' }],
        },
      },
    });
    const ttEvents: NormalizedEvent[] = [];
    const ttMedia: NormalizedMediaEvent[] = [];
    await parseTikTokStream({
      ...createChunkedStream(ttJson, 32),
      onBatch: (_t, e) => {
        ttEvents.push(...e);
      },
      onMediaBatch: (m) => {
        ttMedia.push(...m);
      },
    });
    expect(ttEvents).toHaveLength(3);
    expect(ttEvents[0].event_kind).toBe('visit');
    expect(ttEvents[1].event_kind).toBe('service');
    expect(ttMedia[0].creator_name).toBe('@dev');
    expect(ttMedia[2].platform).toBe('search');
  });

  it('inspects multi-service .zip central directories locally and streams entries through detectAndWrapStream without worker URLs', async () => {
    configureZip({ useWebWorkers: false });
    const writer = new ZipWriter(new BlobWriter('application/zip'));
    await writer.add(
      'Takeout/Chrome/BrowserHistory.json',
      new TextReader(JSON.stringify({ 'Browser History': [{ url: 'https://github.com', title: 'GitHub', time_usec: 1700000000000000 }] })),
    );
    await writer.add(
      'Takeout/YouTube and YouTube Music/history/watch-history.json',
      new TextReader(
        JSON.stringify([
          {
            header: 'YouTube',
            title: 'Watched Systems Programming',
            titleUrl: 'https://www.youtube.com/watch?v=sys1',
            subtitles: [{ name: 'Computerphile' }],
            time: '2024-05-01T12:00:00Z',
          },
        ]),
      ),
    );
    await writer.add(
      'brain/11111111-1111-1111-1111-111111111111/.system_generated/logs/transcript.jsonl',
      new TextReader('{"step_index":0,"source":"USER_EXPLICIT","type":"USER_INPUT","created_at":"2026-01-01T00:00:00Z","content":"compact"}\n'),
    );
    await writer.add(
      'brain/11111111-1111-1111-1111-111111111111/.system_generated/logs/transcript_full.jsonl',
      new TextReader('{"step_index":0,"source":"USER_EXPLICIT","type":"USER_INPUT","created_at":"2026-01-01T00:00:00Z","content":"full"}\n'),
    );

    const zipBlob = await writer.close();
    const zipFile = new File([zipBlob], 'takeout-bundle.zip', { type: 'application/zip' });

    const groups = await inspectZipArchive(zipFile);
    expect(groups.length).toBe(3);
    const agGroup = groups.find((g) => g.groupId === 'antigravity');
    expect(agGroup?.entries).toHaveLength(1);
    expect(agGroup?.entries[0].zipEntryPath).toContain('transcript_full.jsonl');

    const ytGroup = groups.find((g) => g.groupId === 'youtube')!;
    expect(ytGroup.entries).toHaveLength(1);

    const ytTitles: string[] = [];
    await withZipEntryStream(zipFile, ytGroup.entries[0].zipEntryPath!, async (stream, size) => {
      const { format, replayStream } = await detectAndWrapStream(stream);
      expect(format).toBe('youtube');
      await parseYouTubeStream({
        stream: replayStream,
        totalBytes: size,
        onBatch: () => {},
        onMediaBatch: (m) => {
          ytTitles.push(...m.map((x) => x.item_title));
        },
      });
    });

    expect(ytTitles).toEqual(['Systems Programming']);
  });

  it('parses X / Twitter window.YTD tweets.js, like.js, and ZIP archive end-to-end', async () => {
    const tweetsJs =
      'window.YTD.tweets.part0 = ' +
      JSON.stringify([
        {
          tweet: {
            id_str: '1846618510000000000',
            created_at: 'Wed Oct 16 18:24:11 +0000 2024',
            full_text: 'Привет X! Testing "quotes" & [brackets] with DuckDB 🚀 https://github.com/wioledead/takeout-xray',
            favorite_count: '42',
            retweet_count: '5',
            retweeted: false,
            source: '<a href="https://mobile.twitter.com" rel="nofollow">Twitter for iPhone</a>',
            entities: {
              urls: [{ expanded_url: 'https://github.com/wioledead/takeout-xray' }],
              user_mentions: [],
            },
          },
        },
        {
          tweet: {
            id_str: '1846618610000000000',
            created_at: 'Wed Oct 16 19:00:00 +0000 2024',
            full_text: '@karpathy Pure browser WASM indexing is wild!',
            in_reply_to_screen_name: 'karpathy',
            favorite_count: '7',
            source: '<a href="https://twitter.com" rel="nofollow">Twitter Web App</a>',
          },
        },
        {
          tweet: {
            id_str: '1846618710000000000',
            created_at: 'Wed Oct 16 20:00:00 +0000 2024',
            full_text: 'RT @levelsio: Ship fast and keep data local',
            favorite_count: '0',
            retweeted: true,
            source: '<a href="https://twitter.com" rel="nofollow">Twitter Web App</a>',
          },
        },
      ]) +
      ';\n';

    const threads: NormalizedThread[] = [];
    const events: NormalizedEvent[] = [];
    const media: NormalizedMediaEvent[] = [];

    await parseTwitterStream({
      ...createChunkedStream(tweetsJs, 24),
      onBatch: (t, e) => {
        threads.push(...t);
        events.push(...e);
      },
      onMediaBatch: (m) => {
        media.push(...m);
      },
    });

    expect(threads).toHaveLength(1);
    expect(events).toHaveLength(3);
    expect(events[0].event_kind).toBe('message');
    expect(events[0].domain).toBe('github.com');
    expect(events[0].emojis).toEqual(['🚀']);
    expect(events[1].meta_subtype).toBe('reply');
    expect(events[1].sender_name).toBe('@karpathy');
    expect(events[2].event_kind).toBe('service');
    expect(events[2].meta_subtype).toBe('retweet');

    expect(media).toHaveLength(3);
    expect(media[0].album_or_sub).toBe('Twitter for iPhone');
    expect(media[0].ms_played).toBe(42);
    expect(media[1].album_or_sub).toBe('Twitter Web App');
    expect(media[2].creator_name).toBe('@levelsio');

    // Verify Snowflake timestamp decoding for like.js entries without explicit timestamps
    const snowflakeMs = decodeTwitterSnowflakeMs('1846618510000000000');
    expect(snowflakeMs).not.toBeNull();
    expect(new Date(snowflakeMs!).getUTCFullYear()).toBe(2024);

    // Verify multi-file Twitter ZIP extraction ignores non-ingestible js metadata files
    configureZip({ useWebWorkers: false });
    const writer = new ZipWriter(new BlobWriter('application/zip'));
    await writer.add('data/tweets.js', new TextReader(tweetsJs));
    await writer.add(
      'data/like.js',
      new TextReader(
        'window.YTD.like.part0 = [{"like":{"tweetId":"1846618510000000000","fullText":"Liked thread","expandedUrl":"https://x.com/simonw/status/1846618510000000000"}}]',
      ),
    );
    await writer.add('data/account.js', new TextReader('window.YTD.account.part0 = [{"account":{"email":"hidden"}}];'));
    const zipFile = new File([await writer.close()], 'twitter-archive.zip', { type: 'application/zip' });

    const groups = await inspectZipArchive(zipFile);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupId).toBe('twitter');
    expect(groups[0].entries).toHaveLength(2);

    const likeMedia: NormalizedMediaEvent[] = [];
    const likeEntry = groups[0].entries.find((e) => e.zipEntryPath === 'data/like.js')!;
    await withZipEntryStream(zipFile, likeEntry.zipEntryPath!, async (stream, size) => {
      const { format, replayStream } = await detectAndWrapStream(stream);
      expect(format).toBe('twitter');
      await parseTwitterStream({
        stream: replayStream,
        totalBytes: size,
        onBatch: () => {},
        onMediaBatch: (m) => {
          likeMedia.push(...m);
        },
      });
    });

    expect(likeMedia).toHaveLength(1);
    expect(likeMedia[0].platform).toBe('like');
    expect(likeMedia[0].creator_name).toBe('@simonw');
    expect(likeMedia[0].ts_ms).toBe(snowflakeMs);
  });
});
