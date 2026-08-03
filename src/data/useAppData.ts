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
  AuPost,
  AuPostWithContent,
  AuGalleryImage,
  GalleryImage,
  SidebarItem,
  DisciplinaryRecord,
  YoutubeVideo,
} from "../types";
import { publicUrl } from "../utils/publicUrl";

const EMPTY: AppData = {
  sidebarItems: [],
  agents: [],
  posts: [],
  boards: [],
  notices: [],
  au: [],
  auPosts: [],
  playlist: [],
  timeline: [],
  disciplinary: [],
  gallery: [],
  youtube: [],
};

/**
 * Account databases, merged into one dataset.
 *
 * These used to be separate logins (vance / guest) rendering separate
 * desktops. They're now one continuous page, so their entries are simply
 * concatenated — the shared files (posts, gallery, timeline, playlist) already
 * tag every row with its category, so the existing per-category filtering does
 * the rest without changes.
 *
 * Later files win on scalar fields; array fields are appended in order.
 */
const DB_FILES = ["data/db.json", "data/guest.json"];

type RawDb = Partial<AppData> & Record<string, unknown>;

function mergeDbs(dbs: RawDb[]): RawDb {
  return dbs.reduce<RawDb>((acc, db) => {
    for (const [key, value] of Object.entries(db)) {
      const existing = acc[key];
      acc[key] = Array.isArray(value)
        ? [...(Array.isArray(existing) ? existing : []), ...value]
        : value;
    }
    return acc;
  }, {});
}

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      Promise.all(
        DB_FILES.map((file) =>
          fetch(publicUrl(file)).then((r) => {
            if (!r.ok) throw new Error(`${file}: HTTP ${r.status} (${publicUrl(file)})`);
            return r.json() as Promise<RawDb>;
          })
        )
      ).then(mergeDbs),
      // 노션 동기화 산출물. 파일이 있으면 (scripts/notion-sync.mjs 가 생성)
      // 담고 있는 키(notices 등)가 계정 파일의 같은 키를 통째로 대체한다.
      // 아직 동기화 전이라 파일이 없으면 조용히 무시.
      fetch(publicUrl("data/notion.json"))
        .then((r) => (r.ok ? (r.json() as Promise<RawDb>) : {}))
        .catch(() => ({} as RawDb)),
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
      fetch(publicUrl("data/au-posts.json")).then((r) => {
        if (!r.ok) throw new Error(`au-posts.json: HTTP ${r.status}`);
        return r.json() as Promise<{ posts: AuPost[] }>;
      }),
      fetch(publicUrl("data/gallery.json")).then((r) => {
        if (!r.ok) throw new Error(`gallery.json: HTTP ${r.status}`);
        return r.json() as Promise<GalleryImage[]>;
      }),
      fetch(publicUrl("data/au-gallery.json")).then((r) => {
        if (!r.ok) return {} as Record<string, AuGalleryImage[]>;
        return r.json() as Promise<Record<string, AuGalleryImage[]>>;
      }),
    ])
      .then(([db, notionDb, playlist, timeline, postsData, auPostsData, galleryData, auGalleryData]) => {
        if (!cancelled) {
          const auWithGallery: AuItem[] = (db.au ?? []).map((item: AuItem) => ({
            ...item,
            gallery: auGalleryData[item.id] ?? item.gallery ?? [],
          }));

          setData({
            // EMPTY first: the account files only carry the keys they use, so
            // this fills in whatever either of them omitted.
            ...EMPTY,
            ...db,
            ...notionDb,
            au: auWithGallery,
            playlist,
            timeline,
            posts: postsData.posts.map((p) => ({
              ...p,
              id: `${p.boardId}-${p.id}`,
            })),
            boards: postsData.boards,
            auPosts: auPostsData.posts.map((p) => ({
              ...p,
              id: `${p.auId}-${p.id}`,
            })),
            gallery: galleryData,
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
  const gallery = useMemo(
    () => filterByCategory<GalleryImage>(data.gallery, activeCategory),
    [data.gallery, activeCategory]
  );
  const youtube = useMemo(
    () => filterByCategory<YoutubeVideo>(data.youtube, activeCategory),
    [data.youtube, activeCategory]
  );
  const au: AuItem[] = data.au;
  const sidebarItems: SidebarItem[] = data.sidebarItems;

  return { sidebarItems, agents, posts, boards, notices, playlist, timeline, disciplinary, gallery, youtube, au };
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
        content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
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

export function useFetchAuPostContent() {
  const [loadingAuPostId, setLoadingAuPostId] = useState<string | null>(null);

  const fetchAuContent = useCallback(
    async (post: AuPost): Promise<AuPostWithContent> => {
      setLoadingAuPostId(post.id);
      try {
        const url = post.contentPath
          ? publicUrl(`data/${post.contentPath}`)
          : publicUrl(`data/au-posts/${post.id}.md`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let content = await res.text();
        content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
        return { ...post, content };
      } catch {
        return { ...post, content: "(본문을 불러올 수 없습니다.)" };
      } finally {
        setLoadingAuPostId(null);
      }
    },
    []
  );

  return { fetchAuContent, loadingAuPostId };
}
