import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Theme } from "./types";
import { playSwitchClick } from "./click";
export type { Theme };



function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function stored(): Theme | null {
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (q === "dark" || q === "light") return q;
    const t = localStorage.getItem("theme");
    return t === "dark" || t === "light" ? t : null;
  } catch {
    return null;
  }
}

export type ThemeOrigin = { x: number; y: number };

export function useTheme(): [Theme, (origin?: ThemeOrigin) => void] {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (stored()) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback((origin?: ThemeOrigin) => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* 저장 불가 환경 */
    }
    playSwitchClick(next === "dark");
    // 새 테마가 토글 자리에서 원형으로 번지며 덮인다 (View Transition). 색을 섞지 않으니 중간에 글자가 묻히지 않는다.
    // 지원하지 않는 브라우저(Firefox 등)나 움직임 줄이기 설정이면 바로 바꾼다.
    const root = document.documentElement;
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (!vt || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(next);
      return;
    }
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    vt.call(document, () => {
      flushSync(() => setTheme(next));
      root.dataset.theme = next; // 스냅샷이 찍히기 전에 적용되어야 하므로 effect 를 기다리지 않는다
    });
  }, [theme]);

  return [theme, toggle];
}
