/** Hangul syllables, Jamo and compatibility Jamo. */
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

/**
 * True when a string contains Korean.
 *
 * The display face (Google Sans Flex) carries no Hangul, so Korean headings fall
 * back to a body font whose metrics don't survive the display face's tight
 * line-height — lines collide. Titles that hit this switch to a Korean stack.
 */
export function hasHangul(text: string): boolean {
  return HANGUL.test(text);
}

/** Letter-count threshold (spaces excluded) past which a title breaks in two. */
const BREAK_LETTERS = 15;

/**
 * Split an oversized title into two display lines.
 *
 * Multi-word titles at display sizes ("ROMANCE OVERCLOCK", "403 NOSTELGIA
 * FORBBIDEN") otherwise shrink to fit one line and come out tiny, especially
 * on phones. At 15+ letters across 2+ words, break at the word boundary that
 * leaves the two lines most even — so "403" stays with "NOSTELGIA" rather
 * than sitting alone. Shorter titles come back untouched as a single line.
 */
export function titleLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text];

  const letters = words.reduce((n, w) => n + w.length, 0);
  if (letters < BREAK_LETTERS) return [text];

  let bestAt = 1;
  let bestWidth = Infinity;
  for (let at = 1; at < words.length; at++) {
    const width = Math.max(
      words.slice(0, at).join(" ").length,
      words.slice(at).join(" ").length
    );
    if (width < bestWidth) {
      bestWidth = width;
      bestAt = at;
    }
  }
  return [words.slice(0, bestAt).join(" "), words.slice(bestAt).join(" ")];
}
