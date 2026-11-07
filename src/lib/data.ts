import { useEffect, useState } from "react";
import { publicUrl } from "./url";

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  const key = `json:${path}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(publicUrl(`data/${path}`), { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.json();
      })
    );
  }
  return cache.get(key) as Promise<T>;
}

export function loadText(path: string): Promise<string> {
  const key = `text:${path}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(publicUrl(`data/${path}`), { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`${path}: ${r.status}`);
        return r.text();
      })
    );
  }
  return cache.get(key) as Promise<string>;
}

/** JSON 을 불러오는 훅. 실패하면 fallback 을 돌려준다 (파일이 아직 없는 데이터셋 대비). */
export function useJson<T>(path: string | null, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    loadJson<T>(path)
      .then((v) => alive && setValue(v))
      .catch(() => alive && setValue(fallback));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return value;
}

export function useText(path: string | null): string | null {
  const [state, setState] = useState<{ path: string | null; value: string | null }>({ path: null, value: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    loadText(path)
      .then((v) => alive && setState({ path, value: v }))
      .catch(() => alive && setState({ path, value: "" }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state.path === path ? state.value : null;
}

/** md 파일의 frontmatter 를 떼고 본문만 돌려준다. */
export function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  if (end < 0) return md;
  return md.slice(end + 4).replace(/^\s*\n/, "");
}
