import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "../lib/router";

/**
 * 페어 전환 연출 — 지금 화면을 그대로 복제해 위에 덮어 두고, 누른 자리에서 구멍이 물결처럼 번지며
 * 그 아래의 새 페어 랜딩이 드러난다. 복제본은 다 걷히면 치운다.
 */
interface Origin {
  x: number;
  y: number;
}
interface RippleCtx {
  /** 파동을 일으키며 경로를 바꾼다. 움직임 줄이기 설정이면 바로 이동 */
  switchPair: (to: string, origin: Origin) => void;
  /** 파동으로 들어온 경로 — 이 페이지는 페이드인을 하지 않는다 (파동이 걷힌 뒤 다시 깜빡이지 않도록) */
  noFadePath: string | null;
}
const Ctx = createContext<RippleCtx | null>(null);

const GROW_MS = 900;

export function PairRippleProvider({ children }: { children: ReactNode }) {
  const { navigate } = useRouter();
  const [ripple, setRipple] = useState<Origin | null>(null);
  const [noFadePath, setNoFadePath] = useState<string | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const switchPair = useCallback(
    (to: string, origin: Origin) => {
      const app = document.querySelector<HTMLElement>(".app");
      if (!app || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        navigate(to);
        return;
      }
      if (timer.current) window.clearTimeout(timer.current);
      // 지금 보이는 화면을 그대로 복제 — 스크롤 위치만큼 올려 붙여 뷰포트와 맞춘다
      const clone = app.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.left = "0";
      clone.style.top = `${-window.scrollY}px`;
      clone.style.width = `${document.documentElement.clientWidth}px`;
      clone.style.minHeight = "0";
      clone.setAttribute("inert", "");
      clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      setRipple(origin);
      setNoFadePath(to);
      // 복제본 컨테이너가 그려진 뒤 안에 넣고 경로를 바꾼다
      requestAnimationFrame(() => {
        ghostRef.current?.replaceChildren(clone);
        navigate(to);
        timer.current = window.setTimeout(() => setRipple(null), GROW_MS + 50);
      });
    },
    [navigate],
  );
  const value = useMemo(() => ({ switchPair, noFadePath }), [switchPair, noFadePath]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {ripple ? (
        <div className="pair-ripple" aria-hidden="true" style={{ "--rx": `${ripple.x}px`, "--ry": `${ripple.y}px` } as React.CSSProperties}>
          <div className="pair-ripple-ghost" ref={ghostRef} />
          <span className="pair-ripple-ring" />
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function usePairRipple(): RippleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("PairRippleProvider 밖에서 usePairRipple 이 호출됨");
  return ctx;
}
