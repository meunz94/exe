import { useMemo } from "react";
import { useJson } from "./data";
import { pairPath } from "./site";
import type { DiaryMeta, LogMeta, Pair } from "./types";

export interface FeedItem {
  kind: "log" | "diary";
  id: string;
  title: string;
  date: string;
  to: string;
}

/** 로그·일기를 날짜순으로 합친 최근 글 목록 (스토리는 날짜가 없어 제외) */
export function useFeed(pair: Pair, to: (section?: string, id?: string) => string): FeedItem[] {
  const logs = useJson<LogMeta[]>(pairPath(pair, "logs.json"), []);
  const diary = useJson<DiaryMeta[]>(pairPath(pair, "diary.json"), []);
  return useMemo(() => {
    const items: FeedItem[] = [
      ...logs.map((l) => ({ kind: "log" as const, id: l.id, title: l.title, date: l.date, to: to("log", l.id) })),
      ...diary.map((d) => ({ kind: "diary" as const, id: d.id, title: d.title, date: d.date, to: to("diary", d.id) })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [logs, diary, to]);
}
