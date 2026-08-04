import { useEffect } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PostWithContent } from "../../types";
import { displayDate } from "../../utils/publicUrl";
import { fixCjkEmphasis } from "../../utils/markdown";
import { hasHangul } from "../../utils/text";
import styles from "./EntryDetail.module.css";

interface PostReaderProps {
  post: PostWithContent;
  onClose: () => void;
}

/** Full-bleed reader for an archive entry, replacing the old Win98 popup. */
export default function PostReader({ post, onClose }: PostReaderProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("scrollLocked");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("scrollLocked");
    };
  }, [onClose]);

  return (
    <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={post.title}>
      <div className={styles.bar}>
        <button type="button" className={styles.close} onClick={onClose}>
          ← Close
        </button>
        <span className={styles.spacer} />
        <span className={styles.meta}>
          {post.boardId} / {displayDate(post.date)}
        </span>
      </div>

      <div className={styles.readHead}>
        <span className={styles.kicker}>{displayDate(post.date)}</span>
        <h1 className={`${styles.readTitle} ${hasHangul(post.title) ? styles.titleCjk : ""}`}>
          {post.title}
        </h1>
      </div>

      <article className={styles.article}>
        <Markdown rehypePlugins={[rehypeRaw]}>{fixCjkEmphasis(post.content)}</Markdown>
      </article>
    </div>
  );
}
