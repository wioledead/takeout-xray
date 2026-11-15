import { describe, expect, it } from 'vitest';
import type { NormalizedEvent, NormalizedThread } from '../types/domain';
import { detectExportFormat, detectFileFormat, UnsupportedFormatError } from '../worker/adapters/detector';
import { parseChatGptStream } from '../worker/adapters/chatgpt';
import { parseChromeStream } from '../worker/adapters/chrome';
import { parseTelegramStream } from '../worker/adapters/telegram';

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
  it('identifies all 4 supported formats and rejects unknown input', () => {
    expect(detectExportFormat('{"Browser History": []}')).toBe('chrome_history');
    expect(detectExportFormat('[{"title":"Hi","current_node":"a","mapping":{}}]')).toBe('chatgpt');
    expect(detectExportFormat('{"about":"...","chats":{"list":[]}}')).toBe('tg_account');
    expect(detectExportFormat('{"name":"Alice","type":"personal_chat","messages":[]}')).toBe('tg_chat');
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
