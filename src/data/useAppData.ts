import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  AppData,
  Agent,
  Post,
  PostWithContent,
  Board,
  Notice,
  PlaylistItem,
  TimelineEvent,
  AuItem,
  SidebarItem,
  DisciplinaryRecord,
} from "../types";
import { publicUrl } from "../utils/publicUrl";

const EMPTY: AppData = {
  sidebarItems: [],
  agents: [],
  posts: [],
  boards: [],
  notices: [],
  au: [],
  playlist: [],
  timeline: [],
  disciplinary: [],
};

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(publicUrl("data/db.json")).then((r) => {
        if (!r.ok) throw new Error(`db.json: HTTP ${r.status} (${publicUrl("data/db.json")})`);
        return r.json();
      }),
      fetch(publicUrl("data/playlist.json")).then((r) => {
        if (!r.ok) throw new Error(`playlist.json: HTTP ${r.status} (${publicUrl("data/playlist.json")})`);
        return r.json() as Promise<PlaylistItem[]>;
      }),
      fetch(publicUrl("data/timeline.json")).then((r) => {
        if (!r.ok) throw new Error(`timeline.json: HTTP ${r.status} (${publicUrl("data/timeline.json")})`);
        return r.json() as Promise<TimelineEvent[]>;
      }),
      fetch(publicUrl("data/posts.json")).then((r) => {
        if (!r.ok) throw new Error(`posts.json: HTTP ${r.status} (${publicUrl("data/posts.json")})`);
        return r.json() as Promise<{ posts: Post[]; boards: Board[] }>;
      }),
    ])
      .then(([db, playlist, timeline, postsData]) => {
        if (!cancelled) {
          setData({
            ...db,
            playlist,
            timeline,
            posts: postsData.posts,
            boards: postsData.boards,
          });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

export function filterByCategory<T extends { category?: string }>(
  items: T[],
  category: string
): T[] {
  return items.filter((item) => item.category === category);
}

export function useFilteredData(data: AppData, activeCategory: string) {
  const agents = useMemo(
    () => filterByCategory<Agent>(data.agents, activeCategory),
    [data.agents, activeCategory]
  );
  const posts = useMemo(
    () => filterByCategory<Post>(data.posts, activeCategory),
    [data.posts, activeCategory]
  );
  const boards = useMemo(
    () => filterByCategory<Board>(data.boards, activeCategory),
    [data.boards, activeCategory]
  );
  const notices = useMemo(
    () => filterByCategory<Notice>(data.notices, activeCategory),
    [data.notices, activeCategory]
  );
  const playlist = useMemo(
    () => filterByCategory<PlaylistItem>(data.playlist, activeCategory),
    [data.playlist, activeCategory]
  );
  const timeline = useMemo(
    () => filterByCategory<TimelineEvent>(data.timeline, activeCategory),
    [data.timeline, activeCategory]
  );
  const disciplinary = useMemo(
    () => filterByCategory<DisciplinaryRecord>(data.disciplinary, activeCategory),
    [data.disciplinary, activeCategory]
  );
  const au: AuItem[] = data.au;
  const sidebarItems: SidebarItem[] = data.sidebarItems;

  return { sidebarItems, agents, posts, boards, notices, playlist, timeline, disciplinary, au };
}

export function useFetchPostContent() {
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);

  const fetchContent = useCallback(
    async (post: Post): Promise<PostWithContent> => {
      setLoadingPostId(post.id);
      try {
        const url = post.contentPath
          ? publicUrl(`data/${post.contentPath}`)
          : publicUrl(`data/posts/${post.id}.md`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let content = await res.text();
        content = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
        return { ...post, content };
      } catch {
        return { ...post, content: "(본문을 불러올 수 없습니다.)" };
      } finally {
        setLoadingPostId(null);
      }
    },
    []
  );

  return { fetchContent, loadingPostId };
}
