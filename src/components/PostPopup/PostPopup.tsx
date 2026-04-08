import { useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PostWithContent } from "../../types";
import styles from "./PostPopup.module.css";

interface PostPopupProps {
  post: PostWithContent;
  onClose: () => void;
}

export default function PostPopup({ post, onClose }: PostPopupProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleScrollClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div className={styles.overlay} data-dark-bg onClick={handleOverlayClick}>
      <div className={styles.scrollArea} onClick={handleScrollClick}>
        <div className={styles.popup} data-light-bg>
          <div className={styles.header}>
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
            <span className={styles.date}>{post.date}</span>
            <h2 className={styles.title}>{post.title}</h2>
          </div>

          <div className={styles.body}>
            <Markdown rehypePlugins={[rehypeRaw]}>
              {post.content.replace(/\n---(\n|$)/g, "\n\n---\n\n")}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
