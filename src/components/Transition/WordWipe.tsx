import { useEffect, useRef, useState } from "react";
import { DEFAULT_INK, type WipeInk } from "./wipeInks";
import styles from "./WordWipe.module.css";

/** Cover + stack-in. The swap happens as soon as the plate is opaque. */
const COVER_MS = 260;
const GROW_MS = 1000;
const CLEAR_MS = 540;

/** Rows in the stack — matches the reference's five-deep block. */
const ROWS = 5;

/** Size the hidden probe is measured at; the real size scales off it. */
const MEASURE_PX = 100;
/** Fraction of the viewport width the wordmark should span. */
const FILL = 0.9;
/**
 * Cap on horizontal stretch. Big Shoulders is a very condensed face — filling
 * the width at a size that still fits five rows needs ~2.7x, which reads as
 * distortion. 1.9x lands on roughly the reference's width-to-height ratio.
 */
const MAX_STRETCH = 1.9;
/** Must match `.row`'s line-height. */
const LINE_HEIGHT = 1.02;

interface WordWipeProps {
  word: string;
  ink?: WipeInk;
  /** Small readout printed over the fill. */
  note?: string;
  /**
   * Called once the fill is opaque — swap the content here so the change is
   * never visible. Fires well before the rows finish arriving.
   */
  onCovered: () => void;
  /** Called after the sheet has lifted and the new content is exposed. */
  onDone: () => void;
}

/**
 * Full-screen section transition: a solid fill with the destination's name
 * stacked five rows deep, sliding in from alternating sides.
 */
export default function WordWipe({ word, ink, note, onCovered, onDone }: WordWipeProps) {
  const [phase, setPhase] = useState<"grow" | "clear">("grow");
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [stretch, setStretch] = useState(1);
  const probeRef = useRef<HTMLSpanElement>(null);

  // Scale the wordmark to span the viewport. Words differ in length per
  // destination ("music" vs "403 NOSTELGIA FORBIDDEN"), so a fixed size would
  // either overflow or leave the fill half empty. Height is the other bound:
  // five rows still have to fit.
  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;

    const fit = () => {
      const natural = probe.getBoundingClientRect().width;
      if (!natural) return;

      const target = window.innerWidth * FILL;
      // Height comes first: five rows have to fill the viewport.
      const size = window.innerHeight / ROWS / LINE_HEIGHT;
      const widthAtSize = (natural / MEASURE_PX) * size;

      if (widthAtSize > target) {
        // Long labels ("403 NOSTELGIA FORBIDDEN") — shrink to fit rather than
        // squashing the letterforms.
        setFontSize(size * (target / widthAtSize));
        setStretch(1);
      } else {
        setFontSize(size);
        setStretch(Math.min(MAX_STRETCH, target / widthAtSize));
      }
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [word]);

  // The callbacks are read through refs so the timeline effect can depend on
  // nothing. Callers pass inline arrows, so their identity changes on every
  // parent render — and since `onCovered` itself triggers a parent render, an
  // effect that depended on them would tear down and restart its own timers
  // mid-transition, stretching the run and swallowing the next navigation.
  const covered = useRef(onCovered);
  const done = useRef(onDone);

  // Kept current in an effect rather than during render. Declared before the
  // timeline effect, so on mount it runs first — harmlessly, since useRef
  // already holds this render's values.
  useEffect(() => {
    covered.current = onCovered;
    done.current = onDone;
  });

  useEffect(() => {
    const timers = [
      // as soon as the fill is opaque, not when the animation ends
      window.setTimeout(() => covered.current(), COVER_MS),
      window.setTimeout(() => setPhase("clear"), GROW_MS),
      window.setTimeout(() => done.current(), GROW_MS + CLEAR_MS),
    ];
    // Runs once per mount — the caller remounts with a fresh key per transition.
    return () => timers.forEach(clearTimeout);
  }, []);

  const { ink: fill, text } = ink ?? DEFAULT_INK;

  return (
    <div
      className={styles.wipe}
      data-phase={phase}
      style={
        {
          "--wipe-ink": fill,
          "--wipe-text": text,
          ...(fontSize ? { "--row-size": `${fontSize}px` } : {}),
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {/* Off-screen probe: word widths differ per destination, so the display
          size is derived from the real measured width rather than guessed. */}
      <span className={styles.probe} ref={probeRef} style={{ fontSize: MEASURE_PX }}>
        {word}
      </span>

      <div className={styles.sheet}>
        {Array.from({ length: ROWS }, (_, i) => (
          <span
            key={i}
            className={styles.row}
            style={{ "--i": i } as React.CSSProperties}
          >
            {/* stretch lives on an inner span so it can't collide with the
                row's own translate-based entrance */}
            <span
              className={styles.rowInner}
              style={{ transform: `scaleX(${stretch})` }}
            >
              {word}
            </span>
          </span>
        ))}
      </div>
      {note && <span className={styles.tag}>{note}</span>}
    </div>
  );
}
