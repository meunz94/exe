/**
 * Per-destination transition colours.
 *
 * `ink` fills the screen, `text` is the stacked wordmark on top of it — so the
 * The light fill of the pair (mid green) gets dark type; the darker ones get light.
 */
export interface WipeInk {
  ink: string;
  text: string;
}

export const WIPE_INKS: Record<string, WipeInk> = {
  profile: { ink: "var(--px-green-mid)", text: "rgba(6, 24, 12, 0.86)" },
  archive: { ink: "var(--px-blue)", text: "rgba(232, 238, 255, 0.94)" },
  music: { ink: "var(--px-green-deep)", text: "rgba(238, 255, 244, 0.94)" },
  gallery: { ink: "var(--px-blue-deep)", text: "rgba(226, 232, 255, 0.92)" },
  entry: { ink: "var(--px-green-mid)", text: "rgba(6, 24, 12, 0.86)" },
};

export const DEFAULT_INK: WipeInk = WIPE_INKS.entry;
