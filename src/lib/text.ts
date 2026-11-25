// Headline/caption text helpers: parse *emphasis* marks and pair script words with TTS word timings.
import type { Word } from "./types";

export type Token = { text: string; emph: boolean };
export type TimedToken = Token & { start: number; end: number };

/** "I grew to *40,000* followers" -> tokens with emph flags (split on whitespace). */
export const tokenize = (say: string): Token[] => {
  const out: Token[] = [];
  const re = /\*([^*]+)\*|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(say))) {
    if (m[1] !== undefined) {
      for (const part of m[1].trim().split(/\s+/)) out.push({ text: part, emph: true });
    } else {
      const text = m[2];
      // pure punctuation right after an emphasized word ("*system*,") sticks to that word
      if (out.length && /^[\p{P}]+$/u.test(text) && say[m.index - 1] !== " ") out[out.length - 1].text += text;
      else out.push({ text, emph: false });
    }
  }
  return out;
};

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, "") // Arabic diacritics
    .replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Align script tokens to TTS words. Both are whitespace-split, so usually 1:1;
 * when counts differ we align greedily by normalized text and fall back to proportional timing.
 */
export const alignTokens = (tokens: Token[], words: Word[], sceneStart: number, sceneEnd: number): TimedToken[] => {
  const res: TimedToken[] = [];
  let j = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const want = norm(tk.text);
    let found = -1;
    for (let k = j; k < Math.min(words.length, j + 3); k++) {
      const have = norm(words[k].w);
      if (have === want || (want.length > 1 && have.startsWith(want)) || (have.length > 1 && want.startsWith(have))) {
        found = k;
        break;
      }
    }
    if (found === -1) {
      const p0 = i / tokens.length;
      const p1 = (i + 1) / tokens.length;
      const w = words[Math.min(words.length - 1, Math.max(0, j))];
      const start = w ? w.start : sceneStart + (sceneEnd - sceneStart) * p0;
      const end = w ? w.end : sceneStart + (sceneEnd - sceneStart) * p1;
      res.push({ ...tk, start, end });
      continue;
    }
    res.push({ ...tk, start: words[found].start, end: words[found].end });
    j = found + 1;
  }
  return res;
};

export const isRTL = (lang: string) => /^(ar|he|fa|ur)/i.test(lang);
