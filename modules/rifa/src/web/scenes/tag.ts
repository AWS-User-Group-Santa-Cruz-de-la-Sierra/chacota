/** Useful width of the duende's chest sign, in its own units (the sign is 156 wide). */
export const TAG_WIDTH = 140;
export const TAG_MAX_FONT = 36;
export const TAG_MIN_FONT = 14;
/** Characters that fit at the largest size: the display font averages about 0.56 em per glyph. */
const FULL_CHARS = 7;

function chars(name: string): number {
  return Array.from(name.normalize('NFC').trim()).length;
}

/** Font size for a name on the sign: 36 up to 7 characters, then smaller in proportion, never below 14. */
export function fitTagFont(name: string): number {
  const n = chars(name);
  if (n <= FULL_CHARS) return TAG_MAX_FONT;
  return Math.max(TAG_MIN_FONT, Math.floor((TAG_MAX_FONT * FULL_CHARS) / n));
}

/** True when the name overflows even at the smallest size, so the sign squeezes it to `TAG_WIDTH`. */
export function tagNeedsSqueeze(name: string): boolean {
  return chars(name) * fitTagFont(name) > TAG_MAX_FONT * FULL_CHARS;
}
