import { createContext, useCallback, useContext, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";

/**
 * 아주 작은 history 라우터. 경로는 [페어 접두어] + 섹션 + id 로 이뤄진다.
 *   /                  기본 페어 랜딩
 *   /profile/vance     기본 페어의 섹션
 *   /kizu              다른 페어 랜딩
 *   /kizu/log/128      다른 페어의 섹션
 */
export interface Route {
  /** 경로의 페어 접두어 (기본 페어면 "") */
  pairId: string;
  section: string;
  id: string;
  /** 네 번째 조각 (예: /au/chips/<칩>) */
  sub: string;
  /** 전체 경로 */
  path: string;
}

interface RouterCtx {
  route: Route;
  navigate: (to: string, replace?: boolean) => void;
  /** 앱 안에서 이동해 온 기록이 있으면 브라우저 뒤로가기(보던 목록·스크롤 복원), 없으면 fallback 경로로 */
  back: (fallback: string) => void;
}

const Ctx = createContext<RouterCtx | null>(null);

function stripBase(pathname: string): string {
  let base = import.meta.env.BASE_URL || "/";
  if (!base.endsWith("/")) base += "/";
  const p = pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname;
  return p || "/";
}

export function parseRoute(pathname: string, pairIds: string[], defaultPair: string): Route {
  const parts = stripBase(pathname).split("/").filter(Boolean).map(decodeURIComponent);
  let pairId = "";
  if (parts.length && parts[0] !== defaultPair && pairIds.includes(parts[0])) pairId = parts.shift() ?? "";
  else if (parts.length && parts[0] === defaultPair) parts.shift();
  const [section = "", id = "", sub = ""] = parts;
  return { pairId, section, id, sub, path: stripBase(pathname) };
}

export function RouterProvider({ pairIds, defaultPair, children }: { pairIds: string[]; defaultPair: string; children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    let base = import.meta.env.BASE_URL || "/";
    if (!base.endsWith("/")) base += "/";
    const href = base + to.replace(/^\/+/, "");
    const depth = Number(window.history.state?.depth ?? 0);
    if (replace) window.history.replaceState({ depth }, "", href);
    else window.history.pushState({ depth: depth + 1 }, "", href);
    setPathname(window.location.pathname);
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(
    (fallback: string) => {
      if (Number(window.history.state?.depth ?? 0) > 0) window.history.back();
      else navigate(fallback, true);
    },
    [navigate],
  );

  const route = useMemo(() => parseRoute(pathname, pairIds, defaultPair), [pathname, pairIds, defaultPair]);
  const value = useMemo(() => ({ route, navigate, back }), [route, navigate, back]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("RouterProvider 밖에서 useRouter 가 호출됨");
  return ctx;
}

/** 페어 접두어를 붙인 경로 */
export function withPair(pairId: string, section = "", id = "", sub = ""): string {
  const parts = [pairId, section, id, sub].filter(Boolean).map(encodeURIComponent);
  return "/" + parts.join("/");
}

export function Link({
  to,
  children,
  className,
  style,
  onClick,
  ...rest
}: { to: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const { navigate } = useRouter();
  const external = /^(https?:)?\/\//.test(to) || to.startsWith("mailto:");
  let base = import.meta.env.BASE_URL || "/";
  if (!base.endsWith("/")) base += "/";
  const href = external ? to : base + to.replace(/^\/+/, "");
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (external || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={href} className={className} style={style} onClick={handle} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...rest}>
      {children}
    </a>
  );
}
