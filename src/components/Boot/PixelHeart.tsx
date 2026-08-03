import { useMemo } from "react";
import styles from "./GlassDesktop.module.css";

/**
 * 8x8 pixel heart. `0` empty, `1` body, `2` highlight, `3` shade.
 */
const SPRITE = [
  "01100110",
  "12211221",
  "12211112",
  "12111113",
  "01111130",
  "00111300",
  "00013000",
  "00000000",
];

const FILL: Record<string, string> = {
  "1": "#ff3b5c",
  "2": "#ff9fb2",
  "3": "#a3122e",
};

/**
 * Slices stacked along Z to give the sprite real thickness.
 *
 * Head on they line up into a single heart; edge on you see the stack of cut
 * faces, which reads as a solid slab instead of the hairline a lone plane
 * collapses to. Spacing stays under a pixel so the slab looks continuous
 * rather than striped.
 */
const LAYERS = 28;
/** Total depth, in em — about a fifth of the sprite's width. */
const DEPTH = 0.62;

/** One rasterised sprite reused by every layer, rather than 16 sets of rects. */
function useSpriteUrl() {
  return useMemo(() => {
    const rows = SPRITE.length;
    const cols = SPRITE[0].length;
    const rects = SPRITE.flatMap((row, y) =>
      [...row].map((cell, x) =>
        cell === "0"
          ? ""
          : `<rect x='${x}' y='${y}' width='1' height='1' fill='${FILL[cell]}'/>`
      )
    ).join("");
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${cols} ${rows}' ` +
      `shape-rendering='crispEdges'>${rects}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, []);
}

export default function PixelHeart() {
  const sprite = useSpriteUrl();

  return (
    <span className={styles.heartStack} aria-hidden="true">
      <span className={styles.heartGlow} />
      {Array.from({ length: LAYERS }, (_, i) => {
        const t = i / (LAYERS - 1);
        return (
          <span
            key={i}
            className={styles.heartLayer}
            style={{
              backgroundImage: sprite,
              // centred on Z so the spin pivots through the middle of the slab
              transform: `translateZ(${(t - 0.5) * DEPTH}em)`,
              // Both outer faces stay lit and the interior darkens, so the
              // exposed side reads as a shaded edge from either direction.
              filter: `brightness(${1 - 0.45 * Math.sin(Math.PI * t)})`,
            }}
          />
        );
      })}
    </span>
  );
}
