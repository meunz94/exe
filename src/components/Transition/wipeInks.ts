/**
 * Per-destination transition colours.
 *
 * `ink` fills the screen, `text` is the stacked wordmark on top of it — so the
 * light fills (cream, grey) get dark type and the saturated ones get light.
 */
export interface WipeInk {
  ink: string;
  text: string;
}

export const WIPE_INKS: Record<string, WipeInk> = {
  profile: { ink: "var(--px-red)", text: "rgba(255, 255, 255, 0.88)" },
  archive: { ink: "var(--px-blue)", text: "rgba(226, 230, 242, 0.92)" },
  music: { ink: "var(--px-cream)", text: "rgba(20, 18, 14, 0.82)" },
  gallery: { ink: "var(--px-lightgrey)", text: "rgba(14, 14, 18, 0.82)" },
  entry: { ink: "var(--px-red)", text: "rgba(255, 255, 255, 0.88)" },
};

export const DEFAULT_INK: WipeInk = WIPE_INKS.entry;
