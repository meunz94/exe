import { useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PostWithContent } from "../../types";
import { publicUrl, displayDate } from "../../utils/publicUrl";
import { fixCjkEmphasis } from "../../utils/markdown";
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

  const heroSrc = post.imageUrl ? publicUrl(post.imageUrl) : null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.scrollArea} onClick={handleScrollClick}>
        <div className={styles.popup}>
          <div className={styles.titleBar}>
            <span className={styles.titleBarText}>{post.title}</span>
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>

          {heroSrc && (
            <div className={styles.heroImage}>
              <img src={heroSrc} alt="" />
            </div>
          )}

          <div className={styles.header}>
            <span className={styles.date}>{displayDate(post.date)}</span>
            <h2 className={styles.title}>{post.title}</h2>
          </div>

          <div className={styles.body}>
            <Markdown rehypePlugins={[rehypeRaw]}>
              {fixCjkEmphasis(post.content.replace(/\n---(\n|$)/g, "\n\n---\n\n"))}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
