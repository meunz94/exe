import { useEffect, useRef } from "react";

/**
 * Line-by-line text reveal, in the spirit of Splitting.js but without the
 * dependency.
 *
 * Splits the element's text into word spans, measures which words share an
 * `offsetTop` to recover the *rendered* lines (so the reveal follows real
 * wrapping rather than markup), wraps each line in a clipping span, then slides
 * the lines up from below when the element scrolls into view.
 *
 * Re-splits on resize because line breaks move with the viewport.
 */
export function useSplitReveal<T extends HTMLElement>(
  text: string,
  options: { delay?: number; stagger?: number; disabled?: boolean } = {}
) {
  const { delay = 0, stagger = 60, disabled = false } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (disabled || reduced) {
      el.textContent = text;
      return;
    }

    let observer: IntersectionObserver | undefined;

    const split = () => {
      observer?.disconnect();

      // 1. lay the words out so the browser can tell us where lines break
      el.textContent = "";
      const words = text.split(/(\s+)/).filter((w) => w.length > 0);
      const spans = words.map((w) => {
        const span = document.createElement("span");
        span.style.display = "inline-block";
        span.style.whiteSpace = "pre";
        span.textContent = w;
        el.appendChild(span);
        return span;
      });

      // 2. group by rendered offsetTop → those are the visual lines
      const lines: HTMLSpanElement[][] = [];
      let lastTop: number | null = null;
      for (const span of spans) {
        if (span.textContent?.trim() === "" && lines.length === 0) continue;
        const top = span.offsetTop;
        if (lastTop === null || Math.abs(top - lastTop) > 1) {
          lines.push([span]);
          lastTop = top;
        } else {
          lines[lines.length - 1].push(span);
        }
      }

      // 3. rebuild as clip-wrapped lines that start translated below
      el.textContent = "";
      const inners: HTMLElement[] = [];
      lines.forEach((line) => {
        const outer = document.createElement("span");
        outer.style.display = "block";
        outer.style.overflow = "hidden";

        const inner = document.createElement("span");
        inner.style.display = "block";
        inner.style.transform = "translateY(105%)";
        inner.style.willChange = "transform";
        inner.textContent = line.map((s) => s.textContent).join("");

        outer.appendChild(inner);
        el.appendChild(outer);
        inners.push(inner);
      });

      // 4. release them on first intersection
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          inners.forEach((inner, i) => {
            inner.style.transition = `transform 900ms var(--ease-out-expo) ${delay + i * stagger}ms`;
            inner.style.transform = "translateY(0)";
          });
          observer?.disconnect();
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    };

    split();

    // Only re-split on width changes; vertical resize doesn't move line breaks.
    let lastWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      split();
    };
    window.addEventListener("resize", onResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [text, delay, stagger, disabled]);

  return ref;
}

/**
 * Adds `revealed` to an element the first time it scrolls into view, so plain
 * CSS transitions can drive the animation. Used for anything that isn't text.
 */
export function useRevealOnScroll<T extends HTMLElement>(
  className: string,
  threshold = 0.2
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          el.classList.add(className);
          observer.disconnect();
        });
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [className, threshold]);

  return ref;
}
