import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFollowCursor } from "../../hooks/useFollowCursor";
import styles from "./SkimShowcase.module.css";

interface SkimShowcaseProps {
  images: { id: string; url: string; caption?: string }[];
  /** Base pixels-per-second the strip drifts at. */
  speed?: number;
  label?: string;
}

/**
 * Infinite horizontal image strip.
 *
 * The strip auto-drifts; holding the pointer down speeds it up and scales it
 * slightly, and dragging scrubs it directly. Position is driven in a rAF loop
 * writing to `transform` — never React state — so a 60fps scroll doesn't cause
 * 60 renders per second.
 *
 * The list is rendered twice and the offset wraps modulo the width of one copy,
 * which makes the loop seamless without needing to recycle DOM nodes.
 */
export default function SkimShowcase({
  images,
  speed = 42,
  label = "Hold to skim",
}: SkimShowcaseProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<HTMLDivElement>(null);

  const offset = useRef(0);
  const halfWidth = useRef(0);
  const holding = useRef(false);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const dragVelocity = useRef(0);

  const [isHolding, setIsHolding] = useState(false);
  const { ref: cursorRef, show: showCursor, hide: hideCursor, move: moveCursor } =
    useFollowCursor<HTMLDivElement>();

  // One copy's width — the modulus for wrapping. Re-measured when images load
  // or the viewport changes, since items are sized in vw.
  const measure = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    halfWidth.current = loop.scrollWidth / 2;
  }, []);

  useLayoutEffect(() => {
    measure();
    const loop = loopRef.current;
    if (!loop) return;

    const observer = new ResizeObserver(measure);
    observer.observe(loop);

    // images arrive async and change scrollWidth as they decode
    const imgs = Array.from(loop.querySelectorAll("img"));
    imgs.forEach((img) => img.addEventListener("load", measure));

    return () => {
      observer.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", measure));
    };
  }, [measure, images]);

  useEffect(() => {
    const loop = loopRef.current;
    if (!loop) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (dragging.current) {
        // scrubbing: the pointer handler already moved `offset`
        offset.current += dragVelocity.current;
        dragVelocity.current *= 0.9;
      } else if (!reduced) {
        offset.current -= speed * (holding.current ? 3.2 : 1) * dt;
      }

      // Wrap into (-halfWidth, 0] so translateX never grows unbounded. Because
      // the second copy sits exactly halfWidth to the right, any offset in that
      // range is visually identical to the unwrapped one.
      const w = halfWidth.current;
      if (w > 0) {
        offset.current %= w;
        if (offset.current > 0) offset.current -= w;
      }

      loop.style.transform = `translate3d(${offset.current}px, 0, 0)`;
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speed]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    holding.current = true;
    dragging.current = false;
    lastX.current = e.clientX;
    dragVelocity.current = 0;
    setIsHolding(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      moveCursor(e);
      if (!holding.current) return;

      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;

      // a few pixels of travel promotes hold → drag
      if (Math.abs(dx) > 1) {
        dragging.current = true;
        offset.current += dx;
        dragVelocity.current = dx;
      }
    },
    [moveCursor]
  );

  const endHold = useCallback(() => {
    holding.current = false;
    dragging.current = false;
    setIsHolding(false);
  }, []);

  if (images.length === 0) return null;

  // Eager, not lazy. The strip is continuously transform-animated, and Chrome
  // won't re-evaluate a lazy image's visibility as it slides through the
  // viewport — the tiles just stay blank. These are ~80KB generated thumbnails
  // (see scripts/generate-gallery.mjs), so loading them up front is cheap;
  // `fetchPriority="low"` keeps them from competing with the rest of the page.
  const strip = (copy: string) =>
    images.map((img, i) => (
      <figure className={styles.item} key={`${copy}-${img.id}-${i}`}>
        <img
          src={img.url}
          alt={img.caption ?? ""}
          decoding="async"
          fetchPriority="low"
          draggable={false}
        />
      </figure>
    ));

  return (
    <>
      <div
        ref={rootRef}
        className={`${styles.showcase} ${isHolding ? styles.holding : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onPointerEnter={(e) => showCursor(e)}
        onPointerLeave={() => {
          endHold();
          hideCursor();
        }}
      >
        <div className={styles.scale}>
          <div className={styles.loop} ref={loopRef}>
            {strip("a")}
            {strip("b")}
          </div>
        </div>
      </div>

      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
        {label}
      </div>
    </>
  );
}
