// Brand rule: the Samsung logo may only sit in the top or bottom band of a
// banner — never floating in the middle over the artwork.
export const LOGO_TOP_MAX_PCT = 15; // top band: 0 .. 15% from the top edge
export const LOGO_BOTTOM_MIN_PCT = 75; // bottom band: 75% .. bottom edge

/** Snap a dragged y-position into whichever legal band is nearest. */
export function snapLogoY(yPct, logoHeightPct = 8) {
  const bottomMax = Math.max(LOGO_BOTTOM_MIN_PCT, 100 - logoHeightPct);
  const midpoint = (LOGO_TOP_MAX_PCT + LOGO_BOTTOM_MIN_PCT) / 2;
  if (yPct < midpoint) {
    return Math.max(0, Math.min(LOGO_TOP_MAX_PCT, yPct));
  }
  return Math.max(LOGO_BOTTOM_MIN_PCT, Math.min(bottomMax, yPct));
}

export function logoZone(yPct) {
  if (yPct <= LOGO_TOP_MAX_PCT) return "top";
  if (yPct >= LOGO_BOTTOM_MIN_PCT) return "bottom";
  return "invalid";
}
