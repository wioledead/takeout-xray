const EMOJI_REGEX = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"')\]}]+/i;
const SCHEME_REGEX = /^([a-z][a-z0-9+.-]*:\/\/)/i;

export function extractEmojis(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMOJI_REGEX);
  return matches ?? [];
}

function isWordCharCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    (code >= 0x0400 && code <= 0x04ff) // Cyrillic
  );
}

export function countWords(text: string): number {
  if (!text) return 0;
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    if (isWordCharCode(text.charCodeAt(i))) {
      if (!inWord) {
        inWord = true;
        count++;
      }
    } else {
      inWord = false;
    }
  }
  return count;
}

export function countQuestions(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 63) {
      count++;
    }
  }
  return count;
}

export function hasCodeBlock(text: string): boolean {
  return text.includes('```');
}

export function extractFirstDomain(textOrUrl: string, isDirectUrl = false): string | null {
  const raw = textOrUrl.trim();
  if (!raw) return null;

  const candidate = isDirectUrl ? raw : raw.match(URL_IN_TEXT_REGEX)?.[0];
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `${parsed.protocol.toLowerCase()}//`;
    }
    if (parsed.hostname) {
      return parsed.hostname.replace(/^www\./i, '').toLowerCase();
    }
    if (parsed.protocol) {
      return `${parsed.protocol.toLowerCase()}//`;
    }
  } catch {
    if (isDirectUrl) {
      const schemeMatch = candidate.match(SCHEME_REGEX);
      if (schemeMatch) {
        return schemeMatch[1].toLowerCase();
      }
      return 'unknown';
    }
  }

  return isDirectUrl ? 'unknown' : null;
}
