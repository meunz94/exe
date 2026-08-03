import { useCallback, useEffect, useRef } from "react";

/**
 * Drives a pill label that trails the pointer — the reference site's "hold to
 * skim" / "click to close" affordance.
 *
 * The label is positioned imperatively via `transform` inside a rAF loop rather
 * than through React state: pointer moves fire far faster than a sensible
 * render cadence, and re-rendering per move would drop frames on the showcase.
 *
 * The loop lives entirely inside an effect and parks itself when the pill is
 * hidden, so an idle showcase costs nothing.
 */
export function useFollowCursor<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const target = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const startLoop = useRef<() => void>(() => {});

  useEffect(() => {
    let frame: number | undefined;
    let seeded = false;
    const cur = { x: 0, y: 0 };

    const loop = () => {
      const el = ref.current;
      if (!el || !active.current) {
        // park: the next show()/move() restarts us
        frame = undefined;
        seeded = false;
        return;
      }

      // jump to the pointer on the first frame so the pill doesn't fly in
      // from the viewport origin
      if (!seeded) {
        cur.x = target.current.x;
        cur.y = target.current.y;
        seeded = true;
      }

      cur.x += (target.current.x - cur.x) * 0.18;
      cur.y += (target.current.y - cur.y) * 0.18;
      el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) translate(-50%, -50%)`;

      frame = requestAnimationFrame(loop);
    };

    startLoop.current = () => {
      if (frame === undefined) frame = requestAnimationFrame(loop);
    };

    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      startLoop.current = () => {};
    };
  }, []);

  const move = useCallback((e: { clientX: number; clientY: number }) => {
    target.current = { x: e.clientX, y: e.clientY };
    if (active.current) startLoop.current();
  }, []);

  const show = useCallback(
    (e?: { clientX: number; clientY: number }) => {
      if (e) target.current = { x: e.clientX, y: e.clientY };
      active.current = true;
      if (ref.current) ref.current.style.opacity = "1";
      startLoop.current();
    },
    []
  );

  const hide = useCallback(() => {
    active.current = false;
    if (ref.current) ref.current.style.opacity = "0";
  }, []);

  return { ref, show, hide, move };
}
