import type { NormalizedEvent, NormalizedThread } from '../../types/domain';
import {
  countQuestions,
  countWords,
  extractEmojis,
  extractFirstDomain,
} from '../../utils/textAnalysis';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

interface RawChromeHistoryItem {
  url?: string;
  title?: string;
  time_usec?: number | string;
  page_transition?: string;
  client_id?: string;
}

export async function parseChromeStream(options: StreamAdapterOptions): Promise<void> {
  const threadId = 'chrome_history';
  let seq = 0;

  await runStreamingJsonParser(
    options,
    ['$.Browser History.*'],
    (info, collector) => {
      if (
        info.stack.length !== 2 ||
        info.stack[1]?.key !== 'Browser History' ||
        !info.value ||
        typeof info.value !== 'object'
      ) {
        return;
      }

      const item = info.value as RawChromeHistoryItem;
      const timeUsec = Number(item.time_usec);
      if (!Number.isFinite(timeUsec) || timeUsec <= 0) {
        return;
      }

      const tsMs = Math.floor(timeUsec / 1000);
      const url = String(item.url || '').trim();
      const title = String(item.title || url || 'Untitled Page').trim() || 'Untitled Page';
      const domain = extractFirstDomain(url, true) ?? 'unknown';

      const clientId = String(item.client_id || 'chrome_local');
      const senderName = item.client_id
        ? `Device ${String(item.client_id).slice(0, 6)}`
        : 'Chrome';
      const transition = String(item.page_transition || 'LINK').toUpperCase();

      const event: NormalizedEvent = {
        event_id: `${threadId}_${seq++}`,
        thread_id: threadId,
        source_type: 'chrome_history',
        event_kind: 'visit',
        ts_ms: tsMs,
        sender_id: clientId,
        sender_name: senderName,
        text_content: title,
        char_count: title.length,
        word_count: countWords(title),
        question_count: countQuestions(title),
        has_code: false,
        has_media: false,
        emojis: extractEmojis(title),
        domain,
        meta_subtype: transition,
      };

      collector.pushEvent(event);
    },
    (collector) => {
      const thread: NormalizedThread = {
        thread_id: threadId,
        source_type: 'chrome_history',
        title: 'Chrome Browser History',
        thread_kind: 'browser',
        extra_count: 0,
      };
      collector.pushThread(thread);
    },
  );
}
