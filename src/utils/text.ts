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
