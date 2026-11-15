import type { NormalizedEvent, NormalizedThread } from '../../types/domain';
import {
  countQuestions,
  countWords,
  extractEmojis,
  extractFirstDomain,
  hasCodeBlock,
} from '../../utils/textAnalysis';
import { runStreamingJsonParser, type StreamAdapterOptions } from './streamRunner';

interface RawChatGptPartObject {
  content_type?: string;
  asset_pointer?: string;
  text?: string;
}

interface RawChatGptMessage {
  id?: string;
  author?: { role?: string; name?: string };
  create_time?: number | null;
  content?: {
    content_type?: string;
    parts?: Array<string | RawChatGptPartObject | null>;
    text?: string;
  };
  metadata?: {
    attachments?: unknown[];
  };
}

interface RawMappingNode {
  id?: string;
  parent?: string | null;
  message?: RawChatGptMessage | null;
}

interface RawChatGptConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  create_time?: number | null;
  current_node?: string | null;
  mapping?: Record<string, RawMappingNode>;
}

function extractChatGptContent(message: RawChatGptMessage): {
  text: string;
  hasMedia: boolean;
} {
  let hasMedia = Boolean(
    message.metadata && Array.isArray(message.metadata.attachments) && message.metadata.attachments.length > 0,
  );

  const content = message.content;
  if (!content) {
    return { text: '', hasMedia };
  }

  if (Array.isArray(content.parts)) {
    const chunks: string[] = [];
    for (const part of content.parts) {
      if (typeof part === 'string') {
        if (part.length > 0) chunks.push(part);
      } else if (part && typeof part === 'object') {
        if (typeof part.text === 'string' && part.text.length > 0) {
          chunks.push(part.text);
        } else {
          hasMedia = true;
        }
        if (part.asset_pointer || part.content_type === 'image_asset_pointer') {
          hasMedia = true;
        }
      }
    }
    return { text: chunks.join('\n'), hasMedia };
  }

  if (typeof content.text === 'string') {
    return { text: content.text, hasMedia };
  }

  return { text: '', hasMedia };
}

export async function parseChatGptStream(options: StreamAdapterOptions): Promise<void> {
  let convIndex = 0;

  await runStreamingJsonParser(
    options,
    ['$.*'],
    (info, collector) => {
      if (info.stack.length !== 1 || !info.value || typeof info.value !== 'object') {
        return;
      }

      const conv = info.value as RawChatGptConversation;
      if (!conv.mapping || typeof conv.mapping !== 'object') {
        return;
      }

      const threadId = String(conv.id || conv.conversation_id || `chatgpt_conv_${convIndex}`);
      const title = String(conv.title || 'Untitled Conversation').trim() || 'Untitled Conversation';
      convIndex++;

      const mapping = conv.mapping;
      const visited = new Set<string>();
      const activeNodes: RawMappingNode[] = [];

      let currId: string | null | undefined = conv.current_node;
      if (!currId || !mapping[currId]) {
        // Fallback: find the message node with the latest create_time if current_node is missing
        let bestId: string | null = null;
        let bestTime = -1;
        for (const [nodeKey, candidate] of Object.entries(mapping)) {
          const t = candidate?.message?.create_time;
          if (typeof t === 'number' && Number.isFinite(t) && t >= bestTime) {
            bestTime = t;
            bestId = nodeKey;
          } else if (!bestId && candidate?.message) {
            bestId = nodeKey;
          }
        }
        currId = bestId;
      }

      while (currId && mapping[currId] && !visited.has(currId)) {
        visited.add(currId);
        activeNodes.push(mapping[currId]);
        currId = mapping[currId].parent;
      }
      activeNodes.reverse();

      const totalNodes = Object.keys(mapping).length;
      const extraCount = Math.max(0, totalNodes - visited.size);

      const convFallbackMs =
        typeof conv.create_time === 'number' && Number.isFinite(conv.create_time) && conv.create_time > 0
          ? Math.round(conv.create_time * 1000)
          : Date.now();

      let lastTsMs = convFallbackMs;
      let emittedForThread = 0;

      for (let i = 0; i < activeNodes.length; i++) {
        const node = activeNodes[i];
        const msg = node.message;
        if (!msg || !msg.author) continue;

        const role = String(msg.author.role || '');
        if (role !== 'user' && role !== 'assistant') continue;

        const { text, hasMedia } = extractChatGptContent(msg);
        if (!text && !hasMedia) continue;

        let tsMs: number;
        if (typeof msg.create_time === 'number' && Number.isFinite(msg.create_time) && msg.create_time > 0) {
          tsMs = Math.round(msg.create_time * 1000);
          if (tsMs < lastTsMs) {
            tsMs = lastTsMs + 1;
          }
        } else {
          tsMs = lastTsMs + 1;
        }
        lastTsMs = tsMs;

        const senderName = role === 'user' ? 'User' : 'ChatGPT';
        const event: NormalizedEvent = {
          event_id: `${threadId}_${String(msg.id || node.id || i)}`,
          thread_id: threadId,
          source_type: 'chatgpt',
          event_kind: 'message',
          ts_ms: tsMs,
          sender_id: role,
          sender_name: senderName,
          text_content: text,
          char_count: text.length,
          word_count: countWords(text),
          question_count: countQuestions(text),
          has_code: hasCodeBlock(text),
          has_media: hasMedia,
          emojis: extractEmojis(text),
          domain: extractFirstDomain(text, false),
          meta_subtype: role,
        };

        collector.pushEvent(event);
        emittedForThread++;
      }

      if (emittedForThread > 0 || extraCount > 0) {
        const thread: NormalizedThread = {
          thread_id: threadId,
          source_type: 'chatgpt',
          title,
          thread_kind: 'conversation',
          extra_count: extraCount,
        };
        collector.pushThread(thread);
      }
    },
  );
}
