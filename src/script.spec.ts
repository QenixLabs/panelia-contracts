import { describe, expect, it } from 'vitest';
import { SCRIPT_LIMITS, countWords } from './script.js';

// n words separated by single spaces.
const words = (n: number) => Array.from({ length: n }, () => 'panel').join(' ');

describe('SCRIPT_LIMITS', () => {
  it('allows 20 to 3,000 words and stores up to 30,000 characters', () => {
    expect(SCRIPT_LIMITS).toEqual({ minWords: 20, maxWords: 3000, maxChars: 30_000 });
  });
});

describe('countWords', () => {
  it('counts English words and ignores punctuation and extra spaces', () => {
    expect(countWords('Aoi climbs the stairs.  "Wait!" Ren shouts.')).toBe(7);
  });

  it('counts a contraction as one word', () => {
    expect(countWords("Don't look down, it's a long fall.")).toBe(7);
  });

  it('counts screenplay headings and cues line by line', () => {
    expect(countWords('INT. ROOFTOP - NIGHT\nAOI\nWe have to move.')).toBe(8);
  });

  it('splits Japanese with the ICU dictionary', () => {
    expect(countWords('私は学生です')).toBe(4); // 私 | は | 学生 | です
  });

  it('splits Korean on spaces', () => {
    expect(countWords('나는 학교에 간다')).toBe(3);
  });

  it('returns 0 for punctuation-only input', () => {
    expect(countWords('... !? — "" () ***')).toBe(0);
  });

  it('does not count emoji', () => {
    expect(countWords('🎉🔥👍')).toBe(0);
    expect(countWords('Great job 🎉 Aoi!')).toBe(3);
  });

  it('returns 0 for empty and whitespace-only input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts exactly at the minimum boundary (19 / 20)', () => {
    expect(countWords(words(19))).toBe(19);
    expect(countWords(words(20))).toBe(20);
    expect(countWords(words(19)) < SCRIPT_LIMITS.minWords).toBe(true);
    expect(countWords(words(20)) >= SCRIPT_LIMITS.minWords).toBe(true);
  });

  it('counts exactly at the maximum boundary (3000 / 3001)', () => {
    expect(countWords(words(3000))).toBe(3000);
    expect(countWords(words(3001))).toBe(3001);
    expect(countWords(words(3000)) <= SCRIPT_LIMITS.maxWords).toBe(true);
    expect(countWords(words(3001)) > SCRIPT_LIMITS.maxWords).toBe(true);
  });
});
