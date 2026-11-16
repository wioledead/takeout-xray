import type {
  DemoKind,
  ExportFormat,
  NormalizedAntigravityStep,
  NormalizedEvent,
  NormalizedMediaEvent,
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

function makeDemoEvent(params: {
  id: string;
  threadId: string;
  sourceType: ExportFormat;
  eventKind?: 'message' | 'service' | 'visit';
  tsMs: number;
  senderId: string;
  senderName: string;
  text: string;
  hasMedia?: boolean;
  metaSubtype?: string | null;
  domain?: string | null;
}): NormalizedEvent {
  const { text } = params;
  return {
    event_id: params.id,
    thread_id: params.threadId,
    source_type: params.sourceType,
    event_kind: params.eventKind ?? 'message',
    ts_ms: params.tsMs,
    sender_id: params.senderId,
    sender_name: params.senderName,
    text_content: text,
    char_count: text.length,
    word_count: countWords(text),
    question_count: countQuestions(text),
    has_code: hasCodeBlock(text),
    has_media: params.hasMedia ?? false,
    emojis: extractEmojis(text),
    domain: params.domain !== undefined ? params.domain : extractFirstDomain(text),
    meta_subtype: params.metaSubtype ?? null,
  };
}

export interface DemoDataset {
  format: ExportFormat;
  threads: NormalizedThread[];
  events: NormalizedEvent[];
  antigravitySteps?: NormalizedAntigravityStep[];
  mediaEvents?: NormalizedMediaEvent[];
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

export function generateAntigravityDemo(): DemoDataset {
  const rng = createRng(0x414e5449);
  const sessions = [
    { id: 'ag_09e83be3', title: '09e83be3 · Antigravity transcript ingestion', checkpoints: 2 },
    { id: 'ag_4f12a9c0', title: '4f12a9c0 · DuckDB-Wasm streaming benchmark', checkpoints: 1 },
    { id: 'ag_8d31e7b2', title: '8d31e7b2 · React dashboard CI & security review', checkpoints: 1 },
    { id: 'ag_c2901fa4', title: 'c2901fa4 · Local browser preview & QA audit', checkpoints: 0 },
  ];

  const threads: NormalizedThread[] = sessions.map((s) => ({
    thread_id: s.id,
    source_type: 'antigravity',
    title: s.title,
    thread_kind: 'antigravity_session',
    extra_count: s.checkpoints,
  }));

  const userPrompts = [
    'Почему парсер тормозит на файлах больше 200 МБ и как ускорить?',
    'Добавь поддержку Antigravity transcript.jsonl без деплоя в прод 🚀',
    'Проверь SQL запросы в DuckDB-Wasm и прогони все тесты vitest',
    'Can we deduplicate transcript_full.jsonl vs transcript.jsonl automatically?',
    'Please inspect the Chrome lens layout and fix the responsive grid',
  ];

  const assistantReplies = [
    'Проблема в синхронном выделении строк. Переводим парсер на потоковый `TextDecoder` чанками по 64 КБ.\n```ts\nconst decoder = new TextDecoder("utf-8", { fatal: false });\n```',
    'Готово: добавлен адаптер для Antigravity 2.0 с извлечением `tool_calls`, токенов кэша и чисткой `<ADDITIONAL_METADATA>`. ⚡',
    'DuckDB-Wasm batching passed cleanly across 100% of assertions via `run_command` and Vitest.',
    'Implemented directory-scoped deduplication prioritizing `transcript_full.jsonl` over compact transcripts.',
  ];

  const tools = [
    'run_command',
    'read_file',
    'edit_file',
    'write_file',
    'invoke_subagent',
    'search_web',
  ];

  const events: NormalizedEvent[] = [];
  const antigravitySteps: NormalizedAntigravityStep[] = [];
  let ts = Date.UTC(2026, 9, 10, 10, 0, 0);
  let seq = 0;

  for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
    const sess = sessions[sIdx];
    let stepNum = 0;
    let cachedContext = 16000;

    for (let turn = 0; turn < 14; turn++) {
      ts += Math.floor((180 + rng() * 2400) * 1000);
      const prompt = pick(rng, userPrompts);
      events.push({
        event_id: `${sess.id}:e:${seq}`,
        thread_id: sess.id,
        source_type: 'antigravity',
        event_kind: 'message',
        ts_ms: ts,
        sender_id: 'user',
        sender_name: 'User',
        text_content: prompt,
        char_count: prompt.length,
        word_count: countWords(prompt),
        question_count: countQuestions(prompt),
        has_code: false,
        has_media: false,
        emojis: extractEmojis(prompt),
        domain: null,
        meta_subtype: 'user',
      });
      antigravitySteps.push({
        step_id: `${sess.id}:s:${seq++}`,
        thread_id: sess.id,
        step_index: stepNum++,
        step_type: 'USER_INPUT',
        ts_ms: ts,
        input_tokens: 0,
        cache_read_tokens: 0,
        output_tokens: 0,
        thinking_chars: 0,
        reply_chars: 0,
        tool_call_count: 0,
        tool_names: [],
      });

      const plannerToolLoops = 2 + (turn % 3);
      for (let loop = 0; loop < plannerToolLoops; loop++) {
        ts += Math.floor((3 + rng() * 14) * 1000);
        const callCount = 1 + (loop % 2);
        const calledTools = Array.from({ length: callCount }, () => pick(rng, tools));
        const uncached = Math.floor(1800 + rng() * 4500);
        const cacheRead = cachedContext;
        const outTok = Math.floor(350 + rng() * 1400);
        const thinkingChars = Math.floor(800 + rng() * 3200);
        cachedContext += Math.floor(uncached * 0.65);

        events.push({
          event_id: `${sess.id}:e:${seq}`,
          thread_id: sess.id,
          source_type: 'antigravity',
          event_kind: 'service',
          ts_ms: ts,
          sender_id: 'antigravity',
          sender_name: 'Antigravity',
          text_content: '',
          char_count: 0,
          word_count: 0,
          question_count: 0,
          has_code: false,
          has_media: false,
          emojis: [],
          domain: null,
          meta_subtype: 'tool_turn',
        });
        antigravitySteps.push({
          step_id: `${sess.id}:s:${seq++}`,
          thread_id: sess.id,
          step_index: stepNum++,
          step_type: 'PLANNER_RESPONSE',
          ts_ms: ts,
          input_tokens: uncached,
          cache_read_tokens: cacheRead,
          output_tokens: outTok,
          thinking_chars: thinkingChars,
          reply_chars: 0,
          tool_call_count: calledTools.length,
          tool_names: calledTools,
        });

        ts += Math.floor((1 + rng() * 4) * 1000);
        events.push({
          event_id: `${sess.id}:e:${seq}`,
          thread_id: sess.id,
          source_type: 'antigravity',
          event_kind: 'service',
          ts_ms: ts,
          sender_id: 'antigravity',
          sender_name: 'Antigravity',
          text_content: '',
          char_count: 0,
          word_count: 0,
          question_count: 0,
          has_code: false,
          has_media: false,
          emojis: [],
          domain: null,
          meta_subtype: 'tool_result',
        });
        antigravitySteps.push({
          step_id: `${sess.id}:s:${seq++}`,
          thread_id: sess.id,
          step_index: stepNum++,
          step_type: 'GENERIC',
          ts_ms: ts,
          input_tokens: 0,
          cache_read_tokens: 0,
          output_tokens: 0,
          thinking_chars: 0,
          reply_chars: 0,
          tool_call_count: 0,
          tool_names: [],
        });
      }

      ts += Math.floor((4 + rng() * 16) * 1000);
      const reply = pick(rng, assistantReplies);
      const finalIn = Math.floor(1400 + rng() * 2500);
      const finalCache = cachedContext;
      const finalOut = Math.floor(450 + rng() * 1100);
      events.push({
        event_id: `${sess.id}:e:${seq}`,
        thread_id: sess.id,
        source_type: 'antigravity',
        event_kind: 'message',
        ts_ms: ts,
        sender_id: 'antigravity',
        sender_name: 'Antigravity',
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
      antigravitySteps.push({
        step_id: `${sess.id}:s:${seq++}`,
        thread_id: sess.id,
        step_index: stepNum++,
        step_type: 'PLANNER_RESPONSE',
        ts_ms: ts,
        input_tokens: finalIn,
        cache_read_tokens: finalCache,
        output_tokens: finalOut,
        thinking_chars: Math.floor(500 + rng() * 1200),
        reply_chars: reply.length,
        tool_call_count: 0,
        tool_names: [],
      });
    }

    for (let cp = 0; cp < sess.checkpoints; cp++) {
      ts += 2000;
      events.push({
        event_id: `${sess.id}:e:${seq}`,
        thread_id: sess.id,
        source_type: 'antigravity',
        event_kind: 'service',
        ts_ms: ts,
        sender_id: 'system',
        sender_name: 'System',
        text_content: '',
        char_count: 0,
        word_count: 0,
        question_count: 0,
        has_code: false,
        has_media: false,
        emojis: [],
        domain: null,
        meta_subtype: 'checkpoint',
      });
      antigravitySteps.push({
        step_id: `${sess.id}:s:${seq++}`,
        thread_id: sess.id,
        step_index: stepNum++,
        step_type: 'CHECKPOINT',
        ts_ms: ts,
        input_tokens: 12000,
        cache_read_tokens: 180000,
        output_tokens: 3200,
        thinking_chars: 0,
        reply_chars: 0,
        tool_call_count: 0,
        tool_names: [],
      });
    }
  }

  return { format: 'antigravity', threads, events, antigravitySteps };
}

export function generateSpotifyDemo(): DemoDataset {
  const rng = createRng(0x53504f54);
  const threadId = 'spotify_history';
  const threads: NormalizedThread[] = [
    {
      thread_id: threadId,
      source_type: 'spotify',
      title: 'Spotify Streaming History',
      thread_kind: 'streaming',
      extra_count: 0,
    },
  ];

  const catalog = [
    { artist: 'M83', album: 'Hurry Up, We\'re Dreaming', tracks: ['Midnight City', 'Wait', 'Intro', 'Outro'] },
    { artist: 'Daft Punk', album: 'Random Access Memories', tracks: ['Instant Crush', 'Touch', 'Contact', 'Giorgio by Moroder'] },
    { artist: 'Fred again..', album: 'Actual Life 3', tracks: ['Delilah (pull me out of this)', 'Danielle (smile on my face)', 'Kammy (like i do)'] },
    { artist: 'RÜFÜS DU SOL', album: 'Solace', tracks: ['Innerbloom', 'No Place', 'Underwater'] },
    { artist: 'Carpenter Brut', album: 'Trilogy', tracks: ['Turbo Killer', 'Roller Mobster', 'Le Perv'] },
    { artist: 'Tame Impala', album: 'Currents', tracks: ['Let It Happen', 'The Less I Know The Better', 'New Person, Same Old Mistakes'] },
    { artist: 'Jamie xx', album: 'In Colour', tracks: ['Loud Places', 'Gosh', 'SeeSaw'] },
    { artist: 'Home', album: 'Odyssey', tracks: ['Resonance', 'Pyxis', 'Native'] },
    { artist: 'Kino', album: 'Gruppa Krovi', tracks: ['Gruppa Krovi', 'Spokoynaya Noch', 'Zvezda Po Imeni Solntse'] },
  ];
  const platforms = ['osx', 'ios', 'android', 'web_player'];

  const events: NormalizedEvent[] = [];
  const mediaEvents: NormalizedMediaEvent[] = [];
  const startBase = Date.UTC(2024, 0, 5, 9, 0, 0);
  const totalStreams = 1400;

  for (let i = 0; i < totalStreams; i++) {
    const entry = rng() < 0.45 ? catalog[Math.floor(rng() * 3)] : pick(rng, catalog);
    const track = pick(rng, entry.tracks);
    const isSkipped = rng() < 0.21;
    const isShuffle = rng() < 0.58;
    const msPlayed = isSkipped
      ? 12000 + Math.floor(rng() * 45000)
      : 165000 + Math.floor(rng() * 145000);

    const dayOffset = Math.floor((i / totalStreams) * 420);
    const hourWeights = [10, 11, 14, 17, 19, 21, 22, 23, 0, 1];
    const hour = pick(rng, hourWeights);
    const tsMs = startBase + dayOffset * 86_400_000 + hour * 3600_000 + (i % 17) * 195_000;
    const rowId = `sp_demo_${i}`;
    const textContent = `${track} — ${entry.artist}`;

    events.push({
      event_id: rowId,
      thread_id: threadId,
      source_type: 'spotify',
      event_kind: 'visit',
      ts_ms: tsMs,
      sender_id: `artist_${entry.artist.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      sender_name: entry.artist,
      text_content: textContent,
      char_count: textContent.length,
      word_count: countWords(textContent),
      question_count: countQuestions(textContent),
      has_code: false,
      has_media: false,
      emojis: [],
      domain: null,
      meta_subtype: isSkipped ? 'skipped' : 'played',
    });

    mediaEvents.push({
      media_id: rowId,
      thread_id: threadId,
      source_type: 'spotify',
      ts_ms: tsMs,
      creator_name: entry.artist,
      item_title: track,
      album_or_sub: entry.album,
      ms_played: msPlayed,
      is_skipped: isSkipped,
      is_shuffle: isShuffle,
      platform: pick(rng, platforms),
    });
  }

  return { format: 'spotify', threads, events, mediaEvents };
}

export function generateYouTubeDemo(): DemoDataset {
  const rng = createRng(0x59545542);
  const threadId = 'youtube_watch_history';
  const threads: NormalizedThread[] = [
    {
      thread_id: threadId,
      source_type: 'youtube',
      title: 'YouTube Watch History',
      thread_kind: 'video',
      extra_count: 0,
    },
  ];

  const channels = [
    { channel: '3Blue1Brown', titles: ['But what is a neural network?', 'Visualizing attention in Transformers', 'Fourier transforms explained'] },
    { channel: 'Fireship', titles: ['WebAssembly in 100 Seconds', 'DuckDB in 100 Seconds', 'Why local-first apps win'] },
    { channel: 'Veritasium', titles: ['The simplest math problem no one can solve', 'Why nobody can measure speed of light one way'] },
    { channel: 'Andrej Karpathy', titles: ['Let\'s build GPT from scratch', 'Intro to Large Language Models', 'Zero to Hero: Micrograd'] },
    { channel: 'Computerphile', titles: ['Bloom Filters & Probabilistic Structures', 'UTF-8 Encoding Deep Dive'] },
    { channel: 'Linus Tech Tips', titles: ['We built a zero-noise homelab', 'Testing NVMe throughput at 14 GB/s'] },
    { channel: 'Kuplinov Play', titles: ['Ночной марафон инди-хорроров', 'Разбор лучших финалов года'] },
    { channel: 'Boiler Room', titles: ['Fred again.. London Live Set', 'Four Tet x Floating Points Set'] },
  ];

  const events: NormalizedEvent[] = [];
  const mediaEvents: NormalizedMediaEvent[] = [];
  const startBase = Date.UTC(2024, 1, 1, 10, 0, 0);
  let ts = startBase;
  let idx = 0;
  const totalTarget = 960;

  while (idx < totalTarget) {
    const pickCh = rng() < 0.45 ? channels[Math.floor(rng() * 3)] : pick(rng, channels);
    const bingeLen = rng() < 0.24 ? 3 + Math.floor(rng() * 5) : 1;

    for (let k = 0; k < bingeLen && idx < totalTarget; k++) {
      const hourOffset = rng() < 0.35 ? (22 + (idx % 4)) % 24 : 11 + (idx % 10);
      const d = new Date(ts + 86_400_000 * (rng() < 0.6 ? 0 : 1));
      d.setUTCHours(hourOffset, Math.floor(rng() * 55), Math.floor(rng() * 50), 0);
      ts = Math.max(ts + 420_000, d.getTime());

      const isShort = rng() < 0.23;
      const baseTitle = pick(rng, pickCh.titles);
      const title = isShort ? `${baseTitle} #shorts` : baseTitle;
      const rowId = `yt_demo_${idx++}`;

      events.push({
        event_id: rowId,
        thread_id: threadId,
        source_type: 'youtube',
        event_kind: 'visit',
        ts_ms: ts,
        sender_id: `yt_${pickCh.channel.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        sender_name: pickCh.channel,
        text_content: title,
        char_count: title.length,
        word_count: countWords(title),
        question_count: countQuestions(title),
        has_code: false,
        has_media: false,
        emojis: extractEmojis(title),
        domain: 'youtube.com',
        meta_subtype: isShort ? 'shorts' : 'video',
      });

      mediaEvents.push({
        media_id: rowId,
        thread_id: threadId,
        source_type: 'youtube',
        ts_ms: ts,
        creator_name: pickCh.channel,
        item_title: title,
        album_or_sub: isShort ? 'shorts' : 'video',
        ms_played: 0,
        is_skipped: false,
        is_shuffle: false,
        platform: 'youtube',
      });
    }
  }

  return { format: 'youtube', threads, events, mediaEvents };
}

export function generateWhatsAppDemo(): DemoDataset {
  const rng = createRng(0x57415453);
  const threads: NormalizedThread[] = [
    {
      thread_id: 'wa_demo_chat_1',
      source_type: 'whatsapp',
      title: 'WhatsApp: Alina (Personal)',
      thread_kind: 'personal_chat',
      extra_count: 0,
    },
    {
      thread_id: 'wa_demo_group_2',
      source_type: 'whatsapp',
      title: 'Weekend Mountains & Roadtrips',
      thread_kind: 'private_group',
      extra_count: 0,
    },
  ];

  const senders = [
    { id: 'wa_you', name: 'Alex' },
    { id: 'wa_alina', name: 'Alina' },
    { id: 'wa_timur', name: 'Timur' },
  ];

  const phrases = [
    'Доброе утро! Ты уже выехал на вокзал или ещё собираешься? 🚕',
    'Лови локацию на карте https://maps.google.com/maps?q=alps и закинь в заметки',
    'Слушай, а билеты на https://booking.com/trips уже подтвердили или ждём бронь?',
    'Wait check this café photo spot, we should definitely stop here before sunset 🔥❤️',
    'Окей, я на связи после 19:00, набери как освободишься 👍😂',
    'Кстати вот трек в дорогу https://youtube.com/watch?v=dQw4w9WgXcQ',
    'I sent the receipts and PDF itinerary, check if the dates match!',
    'Погнали в пятницу вечером? Захвати термос и пауэрбанк 🙏✨',
  ];

  const events: NormalizedEvent[] = [];
  let ts = Date.UTC(2024, 3, 1, 9, 15, 0);
  let seq = 0;

  while (events.length < 1400) {
    const thread = events.length % 3 === 0 ? threads[1] : threads[0];
    const initiator = thread.thread_id === 'wa_demo_chat_1'
      ? (rng() < 0.55 ? senders[0] : senders[1])
      : pick(rng, senders);
    const responder = initiator.id === senders[0].id ? senders[1] : senders[0];
    const burst = 1 + Math.floor(rng() * 5);

    const d = new Date(ts + 3600_000 * (2 + Math.floor(rng() * 14)));
    d.setUTCHours((10 + (seq % 14)) % 24, Math.floor(rng() * 55), 0, 0);
    ts = Math.max(ts + 90_000, d.getTime());

    for (let i = 0; i < burst && events.length < 1400; i++) {
      ts += Math.floor((18 + rng() * 95) * 1000);
      const isMedia = rng() < 0.12;
      events.push(
        makeDemoEvent({
          id: `wa_d_${seq++}`,
          threadId: thread.thread_id,
          sourceType: 'whatsapp',
          eventKind: isMedia ? 'service' : 'message',
          tsMs: ts,
          senderId: initiator.id,
          senderName: initiator.name,
          text: isMedia ? '' : pick(rng, phrases),
          hasMedia: isMedia,
          metaSubtype: isMedia ? 'media_omitted' : null,
        }),
      );
    }

    if (events.length < 1400 && rng() < 0.78) {
      ts += Math.floor((60 + rng() * 1800) * 1000);
      events.push(
        makeDemoEvent({
          id: `wa_d_${seq++}`,
          threadId: thread.thread_id,
          sourceType: 'whatsapp',
          tsMs: ts,
          senderId: responder.id,
          senderName: responder.name,
          text: pick(rng, phrases),
        }),
      );
    }
  }

  return { format: 'whatsapp', threads, events };
}

export function generateDiscordDemo(): DemoDataset {
  const rng = createRng(0x44495343);
  const threads: NormalizedThread[] = [
    {
      thread_id: 'dc_srv_eng',
      source_type: 'discord',
      title: '#core-engineering',
      thread_kind: 'channel',
      extra_count: 0,
    },
    {
      thread_id: 'dc_dm_max',
      source_type: 'discord',
      title: 'DM · @denis_ml',
      thread_kind: 'channel',
      extra_count: 0,
    },
    {
      thread_id: 'dc_srv_lounge',
      source_type: 'discord',
      title: '#voice-lounge-memes',
      thread_kind: 'channel',
      extra_count: 0,
    },
  ];

  const authors = [
    { id: 'dc_u1', name: 'kiran_dev' },
    { id: 'dc_u2', name: 'denis_ml' },
    { id: 'dc_u3', name: 'nova_ui' },
    { id: 'dc_u4', name: 'you' },
  ];

  const lines = [
    'Pushed the WebAssembly worker fix to https://github.com/org/repo/pull/42 — mind checking benchmark latency?',
    'Read that paper on https://arxiv.org/abs/2402.12345 last night, KV cache compression is wild 🤔🚀',
    'Кто сегодня в войс после 22:00 по мск? Заодно покажу новый профайлер 🔥',
    'Repro snippet:\n```ts\nconst worker = new Worker(new URL("./xray.worker.ts", import.meta.url), { type: "module" });\n```',
    'Uploaded weights to https://huggingface.co/datasets/demo-trace and pinned the thread 📌',
    'LGTM! Zero alloc spikes after streaming the zip entries directly into DuckDB 👏😂',
    'Drop the staging invite link from https://discord.gg/local-xray so QA can test tonight?',
  ];

  const events: NormalizedEvent[] = [];
  let ts = Date.UTC(2024, 5, 10, 14, 0, 0);
  let seq = 0;

  while (events.length < 1500) {
    const ch = threads[events.length % threads.length];
    const sender = pick(rng, authors);
    const other = authors[(authors.indexOf(sender) + 1) % authors.length];
    const streak = 1 + Math.floor(rng() * 4);
    const hourBias = rng() < 0.45 ? (21 + (seq % 5)) % 24 : 13 + (seq % 8);
    const d = new Date(ts + 3600_000 * (1 + Math.floor(rng() * 8)));
    d.setUTCHours(hourBias, Math.floor(rng() * 59), 0, 0);
    ts = Math.max(ts + 60_000, d.getTime());

    for (let k = 0; k < streak && events.length < 1500; k++) {
      ts += Math.floor((12 + rng() * 80) * 1000);
      const isStickerOrFile = rng() < 0.08;
      events.push(
        makeDemoEvent({
          id: `dc_d_${seq++}`,
          threadId: ch.thread_id,
          sourceType: 'discord',
          eventKind: isStickerOrFile ? 'service' : 'message',
          tsMs: ts,
          senderId: sender.id,
          senderName: sender.name,
          text: isStickerOrFile ? '' : pick(rng, lines),
          hasMedia: isStickerOrFile || rng() < 0.14,
          metaSubtype: isStickerOrFile ? 'attachment_only' : null,
        }),
      );
    }

    if (events.length < 1500 && rng() < 0.8) {
      ts += Math.floor((35 + rng() * 900) * 1000);
      events.push(
        makeDemoEvent({
          id: `dc_d_${seq++}`,
          threadId: ch.thread_id,
          sourceType: 'discord',
          tsMs: ts,
          senderId: other.id,
          senderName: other.name,
          text: pick(rng, lines),
        }),
      );
    }
  }

  return { format: 'discord', threads, events };
}

export function generateClaudeAiDemo(): DemoDataset {
  const rng = createRng(0x434c4155);
  const threads: NormalizedThread[] = [];
  const events: NormalizedEvent[] = [];

  const topics = [
    'System Architecture Trade-off Review',
    'PostgreSQL Query Plan & Index Tuning',
    'Zero-Copy Binary Protocol Design',
    'Bilingual Copywriting & Launch Narrative',
    'DuckDB Aggregate Optimization',
    'TypeScript Discriminated Union Refactor',
  ];

  const userPrompts = [
    'Please review this streaming zip parser design for memory bounds and edge cases?',
    'Could you rewrite this SQL query using QUALIFY instead of a nested CTE, thank you!',
    'Пожалуйста, помоги сформулировать короткий пост для Hacker News без маркетинговой воды.',
    'Thanks! What happens if an arbitrary UTF-8 multi-byte character splits across a chunk boundary?',
    'Can you compare DuckDB-Wasm batch inserts vs row-by-row prepared statements? 🙏',
    'Проверь пожалуйста эту регулярку на ReDoS при длинных строках:\n```ts\nconst re = /^(\\d{1,4})\\/(\\d{1,2})/;\n```',
  ];

  const assistantReplies = [
    'Pass `{ stream: true }` to `TextDecoder.decode(chunk, { stream: true })` so incomplete UTF-8 sequences buffer safely between 64 KB slices.',
    'Here is the cleaner `QUALIFY` formulation:\n```sql\nSELECT thread_id, ts_ms FROM events QUALIFY ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY ts_ms DESC) = 1;\n```',
    'For zero-exfiltration guarantees, isolate all parsing inside a dedicated Web Worker and verify outgoing payloads with `PerformanceObserver`.',
    'Ключевое отличие в том, что `INSERT INTO ... SELECT * FROM read_json(...)` минимизирует FFI-пересечения в Wasm и держит пропускную способность выше 100k строк/с.',
  ];

  const baseTs = Date.UTC(2024, 6, 1, 12, 0, 0);
  const convCount = 96;

  for (let c = 0; c < convCount; c++) {
    const threadId = `claude_ai_demo_${c}`;
    threads.push({
      thread_id: threadId,
      source_type: 'claude_ai',
      title: `${pick(rng, topics)} #${c + 1}`,
      thread_kind: 'conversation',
      extra_count: 0,
    });

    const turns = 4 + Math.floor(rng() * 5);
    const d = new Date(baseTs + Math.floor((c / convCount) * 420 * 86_400_000));
    d.setUTCHours(pick(rng, [10, 14, 17, 20, 22, 23, 0, 1]), Math.floor(rng() * 58), 0, 0);
    let ts = d.getTime();

    for (let t = 0; t < turns; t++) {
      const prompt = pick(rng, userPrompts);
      events.push(
        makeDemoEvent({
          id: `${threadId}_u_${t}`,
          threadId,
          sourceType: 'claude_ai',
          tsMs: ts,
          senderId: 'user',
          senderName: 'User',
          text: prompt,
          metaSubtype: 'user',
        }),
      );

      ts += Math.floor((6 + rng() * 24) * 1000);
      const reply = pick(rng, assistantReplies);
      events.push(
        makeDemoEvent({
          id: `${threadId}_a_${t}`,
          threadId,
          sourceType: 'claude_ai',
          tsMs: ts,
          senderId: 'assistant',
          senderName: 'Claude',
          text: reply,
          metaSubtype: 'assistant',
        }),
      );
      ts += Math.floor((45 + rng() * 240) * 1000);
    }
  }

  return { format: 'claude_ai', threads, events };
}

export function generateClaudeCodeDemo(): DemoDataset {
  const rng = createRng(0x43434c49);
  const sessions = [
    { id: 'cc_01f8a210', title: '01f8a210 · Streaming ZIP Central Directory', compactions: 2 },
    { id: 'cc_02b7c930', title: '02b7c930 · DuckDB-Wasm Schema & Indexes', compactions: 1 },
    { id: 'cc_03e4d180', title: '03e4d180 · Export Guides Modal & i18n Audit', compactions: 1 },
    { id: 'cc_04a9f050', title: '04a9f050 · Vitest & TypeScript Strict Mode', compactions: 0 },
  ];

  const threads: NormalizedThread[] = sessions.map((s) => ({
    thread_id: s.id,
    source_type: 'claude_code',
    title: s.title,
    thread_kind: 'antigravity_session',
    extra_count: s.compactions,
  }));

  const prompts = [
    'Refactor the streaming JSON parser to handle nested arrays without loading the entire file into RAM.',
    'Run typecheck and vitest, then fix any union exhaustiveness errors in the adapters.',
    'Добавь обработку iOS дат с квадратными скобками до проверки JSON-массивов в detector.ts',
    'Inspect `engine.ts` for potential prepared-statement leaks on invalid user SQL queries.',
  ];
  const replies = [
    'Updated `detector.ts` so `WHATSAPP_PREFIX_RE` executes prior to JSON array detection.\n```ts\nif (WHATSAPP_PREFIX_RE.test(clean)) return "whatsapp";\n```',
    'All 27 Vitest assertions and `tsc --noEmit` completed with exit code 0 via `Bash`.',
    'Wrapped query execution inside `try/finally` so temporary DuckDB files drop deterministically.',
  ];
  const tools = ['Bash', 'Read', 'Edit', 'Grep', 'Glob', 'Write', 'WebFetch'];

  const events: NormalizedEvent[] = [];
  const antigravitySteps: NormalizedAntigravityStep[] = [];
  let ts = Date.UTC(2026, 8, 12, 11, 0, 0);
  let seq = 0;

  for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
    const sess = sessions[sIdx];
    let stepNum = 0;
    let cacheBase = 14_000;

    for (let turn = 0; turn < 12; turn++) {
      ts += Math.floor((140 + rng() * 1900) * 1000);
      const prompt = pick(rng, prompts);
      events.push(
        makeDemoEvent({
          id: `${sess.id}:e:${seq}`,
          threadId: sess.id,
          sourceType: 'claude_code',
          tsMs: ts,
          senderId: 'user',
          senderName: 'User',
          text: prompt,
          metaSubtype: 'user',
        }),
      );
      antigravitySteps.push({
        step_id: `${sess.id}:s:${seq++}`,
        thread_id: sess.id,
        step_index: stepNum++,
        step_type: 'USER_INPUT',
        ts_ms: ts,
        input_tokens: 0,
        cache_read_tokens: 0,
        output_tokens: 0,
        thinking_chars: 0,
        reply_chars: 0,
        tool_call_count: 0,
        tool_names: [],
      });

      const loops = 2 + (turn % 3);
      for (let l = 0; l < loops; l++) {
        ts += Math.floor((2 + rng() * 11) * 1000);
        const toolBatch = Array.from({ length: 1 + (l % 2) }, () => pick(rng, tools));
        const inputTok = Math.floor(1400 + rng() * 3800);
        const cacheTok = cacheBase;
        const outTok = Math.floor(280 + rng() * 1100);
        cacheBase += Math.floor(inputTok * 0.7);

        events.push(
          makeDemoEvent({
            id: `${sess.id}:e:${seq}`,
            threadId: sess.id,
            sourceType: 'claude_code',
            eventKind: 'service',
            tsMs: ts,
            senderId: 'claude_code',
            senderName: 'Claude Code',
            text: '',
            metaSubtype: 'tool_use',
          }),
        );
        antigravitySteps.push({
          step_id: `${sess.id}:s:${seq++}`,
          thread_id: sess.id,
          step_index: stepNum++,
          step_type: 'PLANNER_RESPONSE',
          ts_ms: ts,
          input_tokens: inputTok,
          cache_read_tokens: cacheTok,
          output_tokens: outTok,
          thinking_chars: Math.floor(600 + rng() * 2600),
          reply_chars: 0,
          tool_call_count: toolBatch.length,
          tool_names: toolBatch,
        });
      }

      ts += Math.floor((3 + rng() * 9) * 1000);
      const reply = pick(rng, replies);
      events.push(
        makeDemoEvent({
          id: `${sess.id}:e:${seq}`,
          threadId: sess.id,
          sourceType: 'claude_code',
          tsMs: ts,
          senderId: 'claude_code',
          senderName: 'Claude Code',
          text: reply,
          metaSubtype: 'assistant',
        }),
      );
      antigravitySteps.push({
        step_id: `${sess.id}:s:${seq++}`,
        thread_id: sess.id,
        step_index: stepNum++,
        step_type: 'PLANNER_RESPONSE',
        ts_ms: ts,
        input_tokens: Math.floor(1100 + rng() * 1800),
        cache_read_tokens: cacheBase,
        output_tokens: Math.floor(420 + rng() * 900),
        thinking_chars: Math.floor(400 + rng() * 1200),
        reply_chars: reply.length,
        tool_call_count: 0,
        tool_names: [],
      });
    }

    if (sess.compactions > 0) {
      ts += 30_000;
      antigravitySteps.push({
        step_id: `${sess.id}:s:${seq++}`,
        thread_id: sess.id,
        step_index: stepNum++,
        step_type: 'CHECKPOINT',
        ts_ms: ts,
        input_tokens: 0,
        cache_read_tokens: 0,
        output_tokens: 0,
        thinking_chars: 0,
        reply_chars: 0,
        tool_call_count: 0,
        tool_names: [],
      });
    }
  }

  return { format: 'claude_code', threads, events, antigravitySteps };
}

export function generateTikTokDemo(): DemoDataset {
  const rng = createRng(0x54494b54);
  const threadId = 'tiktok_activity';
  const threads: NormalizedThread[] = [
    {
      thread_id: threadId,
      source_type: 'tiktok',
      title: 'TikTok Export',
      thread_kind: 'video',
      extra_count: 0,
    },
  ];

  const creators = [
    '@fireship_dev',
    '@ai.daily.lab',
    '@3blue1brown',
    '@tokyo.streetfood',
    '@synth_builds',
    '@minimal.setup',
    '@cat.exe',
    '@rust.internals',
  ];
  const searches = [
    'duckdb wasm browser demo',
    'mechanical keyboard thock switches',
    'kyoto night alley food',
    'typescript tips tricks',
    'neovim config 2026',
  ];

  const events: NormalizedEvent[] = [];
  const mediaEvents: NormalizedMediaEvent[] = [];
  let ts = Date.UTC(2024, 7, 1, 22, 0, 0);
  let seq = 0;

  while (events.length < 1200) {
    const creator = rng() < 0.42 ? creators[Math.floor(rng() * 3)] : pick(rng, creators);
    const streakLen = rng() < 0.25 ? 2 + Math.floor(rng() * 4) : 1;

    for (let k = 0; k < streakLen && events.length < 1200; k++) {
      const lateHour = rng() < 0.55 ? (22 + (seq % 5)) % 24 : 13 + (seq % 8);
      const d = new Date(ts + (rng() < 0.72 ? 45_000 : 86_400_000));
      d.setUTCHours(lateHour, Math.floor(rng() * 59), Math.floor(rng() * 55), 0);
      ts = Math.max(ts + 25_000, d.getTime());

      const id = `tt_d_${seq++}`;
      const url = `https://www.tiktok.com/${creator}/video/${7300000000000 + seq}`;

      events.push(
        makeDemoEvent({
          id,
          threadId,
          sourceType: 'tiktok',
          eventKind: 'visit',
          tsMs: ts,
          senderId: `tt_${creator.slice(1)}`,
          senderName: creator,
          text: url,
          domain: 'tiktok.com',
          metaSubtype: 'watch',
        }),
      );
      mediaEvents.push({
        media_id: id,
        thread_id: threadId,
        source_type: 'tiktok',
        ts_ms: ts,
        creator_name: creator,
        item_title: url,
        album_or_sub: 'watch',
        ms_played: 0,
        is_skipped: false,
        is_shuffle: false,
        platform: 'watch',
      });

      if (rng() < 0.24 && events.length < 1200) {
        const likeId = `tt_d_${seq++}`;
        ts += 2000;
        events.push(
          makeDemoEvent({
            id: likeId,
            threadId,
            sourceType: 'tiktok',
            eventKind: 'service',
            tsMs: ts,
            senderId: `tt_${creator.slice(1)}`,
            senderName: creator,
            text: url,
            domain: 'tiktok.com',
            metaSubtype: 'like',
          }),
        );
        mediaEvents.push({
          media_id: likeId,
          thread_id: threadId,
          source_type: 'tiktok',
          ts_ms: ts,
          creator_name: creator,
          item_title: url,
          album_or_sub: 'like',
          ms_played: 0,
          is_skipped: false,
          is_shuffle: false,
          platform: 'like',
        });
      }

      if (rng() < 0.07 && events.length < 1200) {
        const searchId = `tt_d_${seq++}`;
        const term = pick(rng, searches);
        ts += 5000;
        events.push(
          makeDemoEvent({
            id: searchId,
            threadId,
            sourceType: 'tiktok',
            eventKind: 'service',
            tsMs: ts,
            senderId: 'tiktok_search',
            senderName: 'Search',
            text: term,
            domain: 'tiktok.com',
            metaSubtype: 'search',
          }),
        );
        mediaEvents.push({
          media_id: searchId,
          thread_id: threadId,
          source_type: 'tiktok',
          ts_ms: ts,
          creator_name: 'Search',
          item_title: term,
          album_or_sub: 'search',
          ms_played: 0,
          is_skipped: false,
          is_shuffle: false,
          platform: 'search',
        });
      }
    }
  }

  return { format: 'tiktok', threads, events, mediaEvents };
}

export function generateTwitterDemo(): DemoDataset {
  const rng = createRng(0x58545754);
  const threads: NormalizedThread[] = [
    {
      thread_id: 'twitter_posts',
      source_type: 'twitter',
      title: 'X / Twitter Posts & Replies',
      thread_kind: 'social',
      extra_count: 0,
    },
    {
      thread_id: 'twitter_likes',
      source_type: 'twitter',
      title: 'X / Twitter Likes',
      thread_kind: 'social',
      extra_count: 0,
    },
  ];

  const handles = ['@karpathy', '@levelsio', '@antirez', '@dan_abramov', '@simonw', '@mitsuhiko'];
  const clients = ['Twitter Web App', 'Twitter for iPhone', 'Twitter for Android', 'TweetDeck'];
  const originalTweets = [
    'Just benchmarked DuckDB-Wasm running SQL window functions over 200k local rows inside a Web Worker — zero server round-trips 🚀 https://github.com/wioledead/takeout-xray',
    'Local-first analytics feels like cheating: drop a 500MB Google Takeout zip and keep 100% of your data on your own CPU.',
    'Daily reminder that streaming JSON parsers beat JSON.parse() whenever you touch decade-old exports from https://news.ycombinator.com 🔥',
    'Late-night debugging thoughts: why do we upload private archives to SaaS dashboards when WASM is right here in the browser?',
    'Weekend build log: wired up Snowflake ID timestamp decoding for Twitter likes with bitwise BigInt shifts ✨ https://arxiv.org/abs/2401.00001',
    'Nothing beats a clean dark dashboard with monospace tabular-nums and sub-100ms SQL aggregations.',
  ];
  const replyTemplates = [
    'Totally agree — streaming directly from the zip central directory keeps peak RSS tiny!',
    'Tried this pattern on Chrome history + Spotify streams and got sub-second cold start ⚡',
    'Curious how you handled chunk boundaries on UTF-8 multi-byte emojis without regex backtracking?',
    'Same here, local SQLite and DuckDB are replacing whole backend stacks this year 😂',
  ];
  const rtBodies = [
    'RT @karpathy: Zero-copy browser compute plus local SQL engines is quietly unlocking personal software again.',
    'RT @levelsio: Ship small, keep infra at zero dollars, let users inspect everything on their own machine.',
    'RT @simonw: DuckDB reading newline-delimited JSON in WebAssembly is astonishingly fast.',
    'RT @antirez: Simplicity in data formats ages ten times better than clever schemas.',
  ];
  const likedSnippets = [
    'Thread on streaming binary decompression vs loading full blobs into browser memory.',
    'Why 24x7 circadian heatmaps expose late-night coding binges better than calendar apps.',
    'Minimalist dark UI design tokens & monospace typography checklist for dev tools.',
    'How Twitter Snowflake IDs encode creation timestamps down to the millisecond.',
  ];

  const events: NormalizedEvent[] = [];
  const mediaEvents: NormalizedMediaEvent[] = [];
  let ts = Date.UTC(2024, 2, 1, 10, 0, 0);
  let seq = 0;

  while (seq < 1200) {
    const gapHours = rng() < 0.16 ? 20 + Math.floor(rng() * 36) : 2 + Math.floor(rng() * 14);
    ts += gapHours * 3600_000 + Math.floor(rng() * 1800_000);
    const d = new Date(ts);
    const preferredHour = rng() < 0.34 ? (22 + (seq % 5)) % 24 : 11 + (seq % 11);
    d.setUTCHours(preferredHour, Math.floor(rng() * 60), 0, 0);
    ts = Math.max(ts + 30_000, d.getTime());

    const roll = rng();
    const kind: 'tweet' | 'reply' | 'retweet' =
      roll < 0.44 ? 'tweet' : roll < 0.78 ? 'reply' : 'retweet';
    const client =
      rng() < 0.48
        ? clients[0]
        : rng() < 0.8
          ? clients[1]
          : rng() < 0.94
            ? clients[2]
            : clients[3];

    let targetHandle = '@self';
    let text = '';
    if (kind === 'retweet') {
      const rtText = pick(rng, rtBodies);
      const rtHandleMatch = rtText.match(/^RT\s+(@[A-Za-z0-9_]+)/);
      targetHandle = rtHandleMatch ? rtHandleMatch[1] : pick(rng, handles);
      text = rtText;
    } else if (kind === 'reply') {
      targetHandle = pick(rng, handles);
      text = `${targetHandle} ${pick(rng, replyTemplates)}`;
    } else {
      const mentionSomeone = rng() < 0.25 ? pick(rng, handles) : '@self';
      targetHandle = mentionSomeone;
      const baseText = pick(rng, originalTweets);
      text = mentionSomeone === '@self' ? baseText : `${baseText} cc ${mentionSomeone}`;
    }

    const isViral = kind === 'tweet' && rng() < 0.08;
    const likesReceived =
      kind === 'retweet'
        ? 0
        : isViral
          ? 140 + Math.floor(rng() * 1200)
          : Math.floor(rng() * (kind === 'tweet' ? 38 : 14));
    const hasMedia = kind !== 'retweet' && rng() < 0.18;
    const rowId = `tw_d_${seq++}`;
    const senderLabel =
      kind === 'tweet' && targetHandle === '@self' ? 'Original Posts' : targetHandle;

    events.push(
      makeDemoEvent({
        id: rowId,
        threadId: 'twitter_posts',
        sourceType: 'twitter',
        eventKind: kind === 'retweet' ? 'service' : 'message',
        tsMs: ts,
        senderId: `tw_${senderLabel}`,
        senderName: senderLabel,
        text,
        hasMedia,
        metaSubtype: kind,
      }),
    );

    mediaEvents.push({
      media_id: rowId,
      thread_id: 'twitter_posts',
      source_type: 'twitter',
      ts_ms: ts,
      creator_name: targetHandle,
      item_title: text,
      album_or_sub: client,
      ms_played: likesReceived,
      is_skipped: kind === 'retweet',
      is_shuffle: hasMedia,
      platform: kind,
    });

    if (rng() < 0.34 && seq < 1200) {
      const likeId = `tw_like_d_${seq++}`;
      const likedAuthor = pick(rng, handles);
      const likeText = pick(rng, likedSnippets);
      const likeTs = ts + 45_000;
      events.push(
        makeDemoEvent({
          id: likeId,
          threadId: 'twitter_likes',
          sourceType: 'twitter',
          eventKind: 'service',
          tsMs: likeTs,
          senderId: `tw_${likedAuthor}`,
          senderName: likedAuthor,
          text: likeText,
          domain: 'x.com',
          metaSubtype: 'like',
        }),
      );
      mediaEvents.push({
        media_id: likeId,
        thread_id: 'twitter_likes',
        source_type: 'twitter',
        ts_ms: likeTs,
        creator_name: likedAuthor,
        item_title: likeText,
        album_or_sub: 'Like',
        ms_played: 0,
        is_skipped: false,
        is_shuffle: false,
        platform: 'like',
      });
    }
  }

  return { format: 'twitter', threads, events, mediaEvents };
}

export function generateDemoDataset(kind: DemoKind): DemoDataset {
  switch (kind) {
    case 'telegram':
      return generateTelegramDemo();
    case 'whatsapp':
      return generateWhatsAppDemo();
    case 'discord':
      return generateDiscordDemo();
    case 'chatgpt':
      return generateChatGptDemo();
    case 'claude_ai':
      return generateClaudeAiDemo();
    case 'antigravity':
      return generateAntigravityDemo();
    case 'claude_code':
      return generateClaudeCodeDemo();
    case 'youtube':
      return generateYouTubeDemo();
    case 'spotify':
      return generateSpotifyDemo();
    case 'tiktok':
      return generateTikTokDemo();
    case 'twitter':
      return generateTwitterDemo();
    case 'chrome':
      return generateChromeDemo();
  }
}
