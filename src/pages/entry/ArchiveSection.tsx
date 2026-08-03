import { useMemo, useState } from "react";
import type { Board, Post, PostWithContent } from "../../types";
import { displayDate } from "../../utils/publicUrl";
import PostReader from "./PostReader";
import styles from "../EntryPage.module.css";

interface ArchiveSectionProps {
  posts: Post[];
  boards: Board[];
  loadingPostId: string | null;
  fetchContent: (post: Post) => Promise<PostWithContent>;
}

const ALL = "__all__";

export default function ArchiveSection({
  posts,
  boards,
  loadingPostId,
  fetchContent,
}: ArchiveSectionProps) {
  const [board, setBoard] = useState<string>(ALL);
  const [open, setOpen] = useState<PostWithContent | null>(null);

  const visible = useMemo(() => {
    const list = board === ALL ? posts : posts.filter((p) => p.boardId === board);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [posts, board]);

  if (posts.length === 0) {
    return <p className={styles.empty}>등록된 게시글이 없습니다</p>;
  }

  const openPost = async (post: Post) => {
    setOpen(await fetchContent(post));
  };

  return (
    <>
      {boards.length > 1 && (
        <div className={styles.chipRow}>
          {[{ id: ALL, name: "ALL", n: posts.length }, ...boards.map((b) => ({
            id: b.id,
            name: b.name,
            n: posts.filter((p) => p.boardId === b.id).length,
          }))].map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${styles.chip} ${styles.chipButton} ${board === f.id ? "" : styles.chipGhost}`}
              onClick={() => setBoard(f.id)}
            >
              ■ {f.name} {String(f.n).padStart(2, "0")}
            </button>
          ))}
        </div>
      )}

      <div className={styles.rows}>
        {visible.map((post, i) => (
          <button
            key={post.id}
            type="button"
            className={`${styles.row} ${styles.rowInteractive}`}
            onClick={() => openPost(post)}
            disabled={loadingPostId === post.id}
          >
            <span className={styles.rowNum}>{String(visible.length - i).padStart(3, "0")}</span>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{post.title}</span>
              <span className={styles.rowSub}>
                {post.boardId} · {displayDate(post.date)}
                {post.preview ? ` · ${post.preview}` : ""}
              </span>
            </span>
            <span className={styles.rowRight}>
              {loadingPostId === post.id ? "..." : "↗"}
            </span>
          </button>
        ))}
      </div>

      {open && <PostReader post={open} onClose={() => setOpen(null)} />}
    </>
  );
}
