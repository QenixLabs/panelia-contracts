export const SCRIPT_LIMITS = { minWords: 20, maxWords: 3000, maxChars: 30_000 } as const;

// Created on first use, so importing the package has no side effects.
let segmenter: Intl.Segmenter | undefined;

/**
 * Word count shared by web and server. ICU word breaks: Japanese and Chinese are split by
 * ICU's dictionary, Korean by spaces; punctuation and emoji are not words. The server's count
 * is authoritative at the limits.
 */
export function countWords(text: string): number {
  segmenter ??= new Intl.Segmenter('en', { granularity: 'word' });
  let n = 0;
  for (const s of segmenter.segment(text)) if (s.isWordLike) n++;
  return n;
}
