import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Pair, Site, Theme } from "./types";
import type { ThemeOrigin } from "./theme";
import { useRouter, withPair } from "./router";

export interface SiteCtx {
  site: Site;
  pairs: Pair[];
  pair: Pair;
  /** 경로 접두어로 쓸 페어 id (기본 페어면 "") */
  prefix: string;
  /** 현재 페어 기준 경로 생성 */
  to: (section?: string, id?: string, sub?: string) => string;
  theme: Theme;
  toggleTheme: (origin?: ThemeOrigin) => void;
}

const Ctx = createContext<SiteCtx | null>(null);

export function SiteProvider({
  site,
  pairs,
  theme,
  toggleTheme,
  children,
}: {
  site: Site;
  pairs: Pair[];
  theme: Theme;
  toggleTheme: (origin?: ThemeOrigin) => void;
  children: ReactNode;
}) {
  const { route } = useRouter();
  const value = useMemo<SiteCtx>(() => {
    const pair = pairs.find((p) => p.id === (route.pairId || site.defaultPair)) ?? pairs[0];
    const prefix = pair.id === site.defaultPair ? "" : pair.id;
    return {
      site,
      pairs,
      pair,
      prefix,
      to: (section = "", id = "", sub = "") => withPair(prefix, section, id, sub),
      theme,
      toggleTheme,
    };
  }, [site, pairs, route.pairId, theme, toggleTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * 인물별 이름 색 [첫 번째, 두 번째]. 인물 DB 의 테마색/테마색다크가 있으면 그것,
 * 없으면 라이트 모드는 두 번째 인물, 다크 모드는 첫 번째 인물이 페어 강조색.
 */
export function useSubjectColors(subjects: { color?: string; colorDark?: string }[]): [string, string] {
  const { theme } = useSite();
  const pick = (i: number) => {
    const s = subjects[i];
    const own = theme === "dark" ? s?.colorDark : s?.color;
    if (own) return own;
    const accentIdx = theme === "dark" ? 0 : 1;
    return i === accentIdx ? "var(--accent)" : "var(--fg)";
  };
  return [pick(0), pick(1)];
}

export function useSite(): SiteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("SiteProvider 밖에서 useSite 가 호출됨");
  return ctx;
}

/** 페어 데이터 파일 경로 */
export function pairPath(pair: Pair, file: string): string {
  return `${pair.id}/${file}`;
}

/** 다른 페어 (전환 버튼용) — 페어가 둘 이상일 때 현재 다음 것 */
export function nextPair(pairs: Pair[], current: Pair): Pair | null {
  if (pairs.length < 2) return null;
  const i = pairs.findIndex((p) => p.id === current.id);
  return pairs[(i + 1) % pairs.length];
}
