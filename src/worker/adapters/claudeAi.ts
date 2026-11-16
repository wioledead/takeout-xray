import type { NormalizedThread } from '../../types/domain';
import {
  buildNormalizedEvent,
  extractTextFromBlocks,
  stableShortHash,
} from './streamHelpers';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

interface RawClaudeAiMessage {
  uuid?: string;
  text?: string;
  sender?: string;
  created_at?: string | number;
  content?: unknown;
  files?: unknown[];
  attachments?: unknown[];
}

interface RawClaudeAiConversation {
  uuid?: string;
  id?: string;
  name?: string;
  created_at?: string | number;
  chat_messages?: RawClaudeAiMessage[];
}

function parseClaudeTsMs(raw: unknown, fallbackMs: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }
  return fallbackMs > 0 ? fallbackMs + 1 : 0;
}

/**
 * Streams Claude.ai `conversations.json` array entries into normalized threads and events.
 * Uses `sender_id = 'user' | 'assistant'` and `meta_subtype = 'user' | 'assistant'` so
 * the AI Prompt & Code Lens works seamlessly across ChatGPT and Claude.ai exports.
 */
export async function parseClaudeAiStream(options: StreamAdapterOptions): Promise<void> {
  let convIndex = 0;

  await runStreamingJsonParser(
    options,
    ['$.*'],
    (info, collector) => {
      if (info.stack.length !== 1 || !info.value || typeof info.value !== 'object') {
        return;
      }

      const conv = info.value as RawClaudeAiConversation;
      if (!Array.isArray(conv.chat_messages)) {
        return;
      }

      const rawId = conv.uuid || conv.id || `claude_conv_${convIndex}`;
      const threadId = `cl_${stableShortHash(String(rawId))}`;
      const title = String(conv.name || 'Claude Conversation').trim() || 'Claude Conversation';
      convIndex++;

      let lastTsMs = parseClaudeTsMs(conv.created_at, 0);
      let emittedForThread = 0;
      let extraBlockTurns = 0;

      for (let i = 0; i < conv.chat_messages.length; i++) {
        const msg = conv.chat_messages[i];
        if (!msg || typeof msg !== 'object') continue;

        const rawSender = String(msg.sender || '').toLowerCase();
        const isUser = rawSender === 'human' || rawSender === 'user';
        const isAssistant = rawSender === 'assistant';
        if (!isUser && !isAssistant) continue;

        const blocks = extractTextFromBlocks(msg.content);
        const plainText = typeof msg.text === 'string' ? msg.text.trim() : '';
        const text = blocks.text.trim() || plainText;
        const hasMedia =
          blocks.hasMedia ||
          (Array.isArray(msg.files) && msg.files.length > 0) ||
          (Array.isArray(msg.attachments) && msg.attachments.length > 0);

        if (!text && !hasMedia) continue;

        if (blocks.thinkingChars > 0 || blocks.toolNames.length > 0) {
          extraBlockTurns++;
        }

        let tsMs = parseClaudeTsMs(msg.created_at, lastTsMs);
        if (tsMs === 0) tsMs = Date.now();
        if (lastTsMs > 0 && tsMs <= lastTsMs) {
          tsMs = lastTsMs + 1;
        }
        lastTsMs = tsMs;

        const role = isUser ? 'user' : 'assistant';
        const event = buildNormalizedEvent({
          eventId: `${threadId}_${String(msg.uuid || i)}`,
          threadId,
          sourceType: 'claude_ai',
          eventKind: 'message',
          tsMs,
          senderId: role,
          senderName: isUser ? 'User' : 'Claude',
          textContent: text,
          hasMedia,
          metaSubtype: role,
        });

        collector.pushEvent(event);
        emittedForThread++;
      }

      if (emittedForThread > 0) {
        const thread: NormalizedThread = {
          thread_id: threadId,
          source_type: 'claude_ai',
          title,
          thread_kind: 'conversation',
          extra_count: extraBlockTurns,
        };
        collector.pushThread(thread);
      }
    },
  );
}
