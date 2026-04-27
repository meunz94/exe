import { useState, useMemo, useEffect } from "react";
import type { Post, Board } from "../../types";
import { displayDate } from "../../utils/publicUrl";
import styles from "./PostList.module.css";

const PAGE_SIZE = 5;

interface PostListProps {
  posts: Post[];
  boards: Board[];
  onPostClick: (post: Post) => void;
  loadingPostId: string | null;
}

export default function PostList({
  posts,
  boards,
  onPostClick,
  loadingPostId,
}: PostListProps) {
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const postCountByBoard = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of posts) {
      counts[p.boardId] = (counts[p.boardId] || 0) + 1;
    }
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const list = activeBoardId
      ? posts.filter((p) => p.boardId === activeBoardId)
      : posts;
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [posts, activeBoardId]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const pagedPosts = useMemo(
    () => filteredPosts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredPosts, page]
  );

  useEffect(() => {
    setPage(0);
  }, [activeBoardId, posts]);

  const handleTagClick = (boardId: string) => {
    setActiveBoardId((prev) => (prev === boardId ? null : boardId));
  };

  return (
    <div className={styles.window}>
      <div className={styles.titleBar}>
        <div className={styles.titleBarDots}>
          <span className={styles.dotRed} />
          <span className={styles.dotYellow} />
          <span className={styles.dotGreen} />
        </div>
        <span className={styles.titleBarText}>Archive</span>
        <div className={styles.titleBarSpacer} />
      </div>

      {boards.length > 0 && (
        <div className={styles.boardTags}>
          <span
            className={
              activeBoardId === null ? styles.boardTagActive : styles.boardTag
            }
            onClick={() => setActiveBoardId(null)}
          >
            전체
          </span>
          {boards.map((board) => (
            <span
              key={board.id}
              className={
                activeBoardId === board.id
                  ? styles.boardTagActive
                  : styles.boardTag
              }
              onClick={() => handleTagClick(board.id)}
            >
              {board.name}
              <span className={styles.tagCount}>{postCountByBoard[board.id] || 0}</span>
            </span>
          ))}
        </div>
      )}

      <div className={styles.windowBody}>
        {filteredPosts.length === 0 ? (
          <div className={styles.empty}>등록된 게시글이 없습니다.</div>
        ) : (
          <div className={styles.list}>
            {pagedPosts.map((post) => (
              <div
                key={post.id}
                className={
                  loadingPostId === post.id
                    ? styles.itemLoading
                    : styles.item
                }
                onClick={() => onPostClick(post)}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>{post.title}</span>
                  <span className={styles.itemDate}>{displayDate(post.date)}</span>
                </div>
                <p className={styles.itemPreview}>{post.preview}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.statusBar}>
        <span className={styles.statusText}>
          {filteredPosts.length === 0
            ? "0개"
            : `${filteredPosts.length}개 중 ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, filteredPosts.length)}`}
        </span>
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ‹
          </button>
          <span className={styles.pageInfo}>
            {page + 1} / {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
