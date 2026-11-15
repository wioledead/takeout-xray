import type {
  DemoKind,
  ExportFormat,
  NormalizedEvent,
  NormalizedThread,
} from '../types/domain';
import {
  countQuestions,
  countWords,
  extractEmojis,
  extractFirstDomain,
  hasCodeBlock,
} from './textAnalysis';

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export interface DemoDataset {
  format: ExportFormat;
  threads: NormalizedThread[];
  events: NormalizedEvent[];
}

export function generateTelegramDemo(): DemoDataset {
  const rng = createRng(0x58524159);
  const threads: NormalizedThread[] = [
    {
      thread_id: 'tg_demo_core',
      source_type: 'tg_account',
      title: 'Cyberpunk Core Team',
      thread_kind: 'private_group',
      extra_count: 0,
    },
    {
      thread_id: 'tg_demo_elena',
      source_type: 'tg_account',
      title: 'Elena // Neural Lab',
      thread_kind: 'personal_chat',
      extra_count: 0,
    },
    {
      thread_id: 'tg_demo_saved',
      source_type: 'tg_account',
      title: 'Saved Research Notes',
      thread_kind: 'personal_chat',
      extra_count: 0,
    },
  ];

  const participants = [
    { id: 'u_artem', name: 'Artem' },
    { id: 'u_elena', name: 'Elena' },
    { id: 'u_max', name: 'Max' },
  ];

  const enLines = [
    'Pushed the streaming parser patch to main, latency dropped by 40% 🚀',
    'Wait, did we benchmark DuckDB-Wasm batch sizes at 5000 rows yet?',
    'Look at this flamegraph from Chrome DevTools 👀 https://github.com/duckdb/duckdb-wasm',
    'Late night refactor session... why does UTC vs local offset always bite us? 💀',
    'Quick question: should we support full account chats.list alongside single chat?',
    'Deployed the zero-backend static build! Zero bytes sent anywhere ✨',
    'Check this paper on local-first analytics engines https://arxiv.org/abs/2401.10234 🔥',
    '```sql\nSELECT sender_name, MEDIAN(delta) FROM events GROUP BY 1;\n```',
    'Found a wild edge case with 4-byte emoji surrogate pairs across 64-byte chunks 🧠',
    'Coffee + terminal logs at 02:30 AM hits different ⚡',
    'Nice! Also check Hacker News thread https://news.ycombinator.com/item?id=39001234',
    'Did you see the median reply time drop after removing sleep gaps?',
  ];

  const ruLines = [
    'Проверил потоковый парсер на файле 400 МБ — память вообще не растёт 🔥',
    'Слушай, а как в DuckDB работает regexp_extract_all с кириллицей?',
    'Закинул свежий бенчмарк по воркерам на https://habr.com/ru/articles/800123/ 🚀',
    'Опять сидим в два часа ночи дебажим веб-воркеры 😅',
    'Нужно не забыть вызывать dropFile после каждого батча в виртуальной ФС!',
    'Посмотри вот эту ветку обсуждения, там классная оптимизация ✨',
    'Сделал анонимизацию имён на экспорте карточки — можно смело шарить 👀',
    'Вопрос: медиану ответа считаем только до шести часов тишины?',
    'Да, всё что дольше 6 часов — это уже новая сессия инициатора 🧠',
    'Потрясающе, графики в терминальном стиле выглядят как настоящий радар ⚡',
  ];

  const events: NormalizedEvent[] = [];
  const startBase = Date.UTC(2024, 2, 10, 9, 0, 0);
  const totalEvents = 15000;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const countForThread = i === 0 ? 7000 : i === 1 ? 6000 : 2000;
    let ts = startBase + i * 3600 * 1000 * 12;
    let currentSender = participants[0];
    let streakRemaining = 0;

    for (let j = 0; j < countForThread; j++) {
      if (thread.thread_id === 'tg_demo_saved') {
        currentSender = participants[0];
      } else if (thread.thread_id === 'tg_demo_elena') {
        if (streakRemaining <= 0) {
          currentSender = rng() < 0.56 ? participants[0] : participants[1];
          streakRemaining = rng() < 0.14 ? 5 + Math.floor(rng() * 5) : 1 + Math.floor(rng() * 2);
        }
        streakRemaining--;
      } else {
        if (streakRemaining <= 0) {
          const r = rng();
          currentSender = r < 0.45 ? participants[0] : r < 0.8 ? participants[1] : participants[2];
          streakRemaining = rng() < 0.16 ? 5 + Math.floor(rng() * 6) : 1 + Math.floor(rng() * 2);
        }
        streakRemaining--;
      }

      // Advance timestamp: mostly quick replies (12s-12m), sometimes >6h gap to trigger initiators
      const gapRoll = rng();
      if (gapRoll < 0.05) {
        ts += Math.floor((6.5 + rng() * 18) * 3600 * 1000);
      } else if (gapRoll < 0.25) {
        ts += Math.floor((15 + rng() * 90) * 60 * 1000);
      } else {
        ts += Math.floor((12 + rng() * 240) * 1000);
      }

      // Occasionally shift to late night window (00:00 - 04:00)
      if (rng() < 0.08) {
        const d = new Date(ts);
        d.setUTCHours(Math.floor(rng() * 4), Math.floor(rng() * 60), Math.floor(rng() * 60));
        if (d.getTime() > ts) {
          ts = d.getTime();
        }
      }

      // Keep timeline within 2024..2026
      const maxTs = Date.UTC(2026, 9, 1);
      if (ts > maxTs) {
        ts = startBase + Math.floor(rng() * (maxTs - startBase));
      }

      const isService = j > 0 && j % 190 === 0;
      const text = isService
        ? ''
        : rng() < 0.52
          ? pick(rng, enLines)
          : pick(rng, ruLines);

      events.push({
        event_id: `${thread.thread_id}_${j}`,
        thread_id: thread.thread_id,
        source_type: 'tg_account',
        event_kind: isService ? 'service' : 'message',
        ts_ms: ts,
        sender_id: currentSender.id,
        sender_name: currentSender.name,
        text_content: text,
        char_count: text.length,
        word_count: isService ? 0 : countWords(text),
        question_count: isService ? 0 : countQuestions(text),
        has_code: !isService && hasCodeBlock(text),
        has_media: !isService && rng() < 0.09,
        emojis: isService ? [] : extractEmojis(text),
        domain: isService ? null : extractFirstDomain(text, false),
        meta_subtype: isService ? (rng() < 0.5 ? 'phone_call' : 'pin_message') : null,
      });
    }
  }

  return {
    format: 'tg_account',
    threads,
    events: events.slice(0, totalEvents),
  };
}

export function generateChatGptDemo(): DemoDataset {
  const rng = createRng(0x47505439);
  const threads: NormalizedThread[] = [];
  const events: NormalizedEvent[] = [];

  const topics = [
    'DuckDB Window Functions Optimization',
    'Web Worker Zero-Copy Streaming Architecture',
    'Russian & English Morphological Tokenizer',
    'React 19 SVG Heatmap Performance',
    'Distributed Systems Consensus Notes',
    'PostgreSQL vs DuckDB Analytics Benchmark',
    'Regex Edge Cases for Unicode Emojis',
    'Tailwind v4 Cyber-Terminal Design Tokens',
  ];

  const userPrompts = [
    'Please explain how DuckDB-Wasm handles newline delimited JSON ingestion without memory leaks?',
    'Could you optimize this SQL query for median reply latency, thank you!',
    'Пожалуйста, подскажи как правильно обойти DAG переписки в ChatGPT экспорте?',
    'Can you write a TypeScript streaming UTF-8 decoder test with 64-byte chunks? Thanks!',
    'Спасибо! А как исключить стоп-слова из частотного словаря на двух языках?',
    'Show me a clean SVG 24x7 circadian heatmap grid in React.',
    'Why is median response time better than average for chat forensics?',
    'Пожалуйста, проверь этот SQL запрос на window functions:\n```sql\nSELECT LAG(ts_ms) OVER (ORDER BY ts_ms) FROM events;\n```',
  ];

  const assistantReplies = [
    'Here is a clean streaming approach using `registerFileText` followed immediately by `dropFile` inside a `finally` block:\n```ts\nawait db.registerFileText(name, ndjson);\ntry {\n  await conn.query(`INSERT INTO events SELECT * FROM read_json(...)`);\n} finally {\n  await db.dropFile(name);\n}\n```',
    'Because sleep gaps (6+ hours) heavily skew arithmetic means upward, `MEDIAN()` gives a much truer signal of active conversational cadence.',
    'Для корректного обхода дерева `mapping` начинайте с `current_node` и двигайтесь вверх по `.parent`, сохраняя посещённые узлы в `Set` для защиты от циклов.',
    'Using `LAG(sender_id)` with a cumulative `SUM(is_new_turn)` gaps-and-islands pattern lets DuckDB compute consecutive monologue streaks in a single table scan.',
    'Вот оптимизированный SQL-запрос с поддержкой часового пояса через `epoch_ms(ts_ms + offset)`:\n```sql\nSELECT ISODOW(epoch_ms(ts_ms)) AS dow, COUNT(*) FROM events GROUP BY 1;\n```',
  ];

  const baseTs = Date.UTC(2024, 1, 1, 10, 0, 0);
  const convCount = 300;

  for (let c = 0; c < convCount; c++) {
    const threadId = `gpt_demo_${c}`;
    const hasRegen = rng() < 0.45;
    const extraCount = hasRegen ? 1 + Math.floor(rng() * 4) : 0;
    const title = `${pick(rng, topics)} #${c + 1}`;

    threads.push({
      thread_id: threadId,
      source_type: 'chatgpt',
      title,
      thread_kind: 'conversation',
      extra_count: extraCount,
    });

    const turns = 3 + Math.floor(rng() * 4);
    let ts = baseTs + Math.floor((c / convCount) * 900 * 24 * 3600 * 1000);
    // Concentrate prompting around evening & late-night coding hours
    const d = new Date(ts);
    const hourWeights = [1, 2, 11, 15, 19, 21, 22, 23, 0, 1];
    d.setUTCHours(pick(rng, hourWeights), Math.floor(rng() * 60), 0, 0);
    ts = d.getTime();

    for (let t = 0; t < turns; t++) {
      const prompt = pick(rng, userPrompts);
      events.push({
        event_id: `${threadId}_u_${t}`,
        thread_id: threadId,
        source_type: 'chatgpt',
        event_kind: 'message',
        ts_ms: ts,
        sender_id: 'user',
        sender_name: 'User',
        text_content: prompt,
        char_count: prompt.length,
        word_count: countWords(prompt),
        question_count: countQuestions(prompt),
        has_code: hasCodeBlock(prompt),
        has_media: rng() < 0.08,
        emojis: extractEmojis(prompt),
        domain: extractFirstDomain(prompt, false),
        meta_subtype: 'user',
      });

      ts += 3000 + Math.floor(rng() * 14000);
      const reply = pick(rng, assistantReplies);
      events.push({
        event_id: `${threadId}_a_${t}`,
        thread_id: threadId,
        source_type: 'chatgpt',
        event_kind: 'message',
        ts_ms: ts,
        sender_id: 'assistant',
        sender_name: 'ChatGPT',
        text_content: reply,
        char_count: reply.length,
        word_count: countWords(reply),
        question_count: countQuestions(reply),
        has_code: hasCodeBlock(reply),
        has_media: false,
        emojis: extractEmojis(reply),
        domain: extractFirstDomain(reply, false),
        meta_subtype: 'assistant',
      });

      ts += 25000 + Math.floor(rng() * 180000);
    }
  }

  return { format: 'chatgpt', threads, events };
}

export function generateChromeDemo(): DemoDataset {
  const rng = createRng(0x4348524d);
  const threads: NormalizedThread[] = [
    {
      thread_id: 'chrome_history',
      source_type: 'chrome_history',
      title: 'Chrome Browser History',
      thread_kind: 'browser',
      extra_count: 0,
    },
  ];

  const domainCatalog = [
    { domain: 'github.com', title: 'GitHub · Pull Requests & Issues', weight: 18 },
    { domain: 'duckdb.org', title: 'DuckDB Documentation — JSON & Window Functions', weight: 12 },
    { domain: 'stackoverflow.com', title: 'Stack Overflow — TypeScript Streaming Streams', weight: 11 },
    { domain: 'news.ycombinator.com', title: 'Hacker News', weight: 10 },
    { domain: 'arxiv.org', title: 'arXiv.org — Computer Science Preprints', weight: 8 },
    { domain: 'youtube.com', title: 'YouTube — Systems Engineering Talks', weight: 9 },
    { domain: 'habr.com', title: 'Хабр — Разработка и WebAssembly', weight: 7 },
    { domain: 'developer.mozilla.org', title: 'MDN Web Docs — ReadableStream & TextDecoder', weight: 7 },
    { domain: 'reddit.com', title: 'Reddit — r/programming & r/LocalLLaMA', weight: 6 },
    { domain: 'docs.rs', title: 'Docs.rs — Rust Crate Documentation', weight: 4 },
    { domain: 'figma.com', title: 'Figma — Cyber Terminal UI Spec', weight: 4 },
    { domain: 'localhost', title: 'localhost:5173 — Takeout X-Ray Dev', weight: 6 },
    { domain: 'wikipedia.org', title: 'Wikipedia — Information Forensics', weight: 4 },
  ];

  const transitions = ['LINK', 'LINK', 'LINK', 'TYPED', 'TYPED', 'RELOAD', 'AUTO_BOOKMARK', 'GENERATED'];
  const devices = [
    { id: 'dev_mbp16', name: 'Device mbp16' },
    { id: 'dev_linux', name: 'Device linux' },
  ];

  const events: NormalizedEvent[] = [];
  let ts = Date.UTC(2024, 3, 1, 8, 30, 0);
  const totalVisits = 10000;
  let currentDomain = domainCatalog[0];
  let rabbitStreak = 0;

  for (let i = 0; i < totalVisits; i++) {
    if (rabbitStreak <= 0) {
      currentDomain = pick(rng, domainCatalog);
      // Intentional rabbit holes on research/code domains
      rabbitStreak = rng() < 0.12 ? 5 + Math.floor(rng() * 10) : 1 + Math.floor(rng() * 2);
    }
    rabbitStreak--;

    if (rng() < 0.04) {
      ts += Math.floor((6.5 + rng() * 14) * 3600 * 1000);
    } else {
      ts += Math.floor((8 + rng() * 320) * 1000);
    }

    const maxTs = Date.UTC(2026, 9, 15);
    if (ts > maxTs) {
      ts = Date.UTC(2024, 3, 1) + Math.floor(rng() * (maxTs - Date.UTC(2024, 3, 1)));
    }

    const device = rng() < 0.72 ? devices[0] : devices[1];
    const transition = pick(rng, transitions);
    const title = currentDomain.title;

    events.push({
      event_id: `chrome_${i}`,
      thread_id: 'chrome_history',
      source_type: 'chrome_history',
      event_kind: 'visit',
      ts_ms: ts,
      sender_id: device.id,
      sender_name: device.name,
      text_content: title,
      char_count: title.length,
      word_count: countWords(title),
      question_count: countQuestions(title),
      has_code: false,
      has_media: false,
      emojis: [],
      domain: currentDomain.domain,
      meta_subtype: transition,
    });
  }

  return { format: 'chrome_history', threads, events };
}

export function generateDemoDataset(kind: DemoKind): DemoDataset {
  switch (kind) {
    case 'telegram':
      return generateTelegramDemo();
    case 'chatgpt':
      return generateChatGptDemo();
    case 'chrome':
      return generateChromeDemo();
  }
}
