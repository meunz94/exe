import { useCallback, useEffect, useState } from "react";
import type { YoutubeVideo } from "../../types";
import styles from "./MiniVideo.module.css";

interface MiniVideoProps {
  videos: YoutubeVideo[];
}

/**
 * Sticky monitor in the bottom-left corner playing the first available clip,
 * with a blinking REC tally. Clicking opens it fullscreen.
 *
 * The thumbnail is YouTube's own still rather than an embedded player, so the
 * landing page doesn't pay for an iframe until someone actually opens it.
 */
export default function MiniVideo({ videos }: MiniVideoProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const video = videos[0];

  const close = useCallback(() => setOpen(false), []);

  // Stay out of the way until the hero has scrolled past — otherwise the
  // monitor sits on top of the display type.
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!video) return null;

  return (
    <>
      <div className={`${styles.mini} ${visible ? styles.visible : ""}`}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setOpen(true)}
          aria-label={`${video.title} 재생`}
        >
          <img
            className={styles.thumb}
            src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
          />
          <span className={styles.rec}>
            <span className={styles.recDot} />
            rec
          </span>
        </button>
        <div className={styles.caption}>{video.title}</div>
      </div>

      {open && (
        <div
          className={styles.overlay}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
        >
          <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
            <iframe
              className={styles.frame}
              src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={close}
            aria-label="닫기"
          >
            <span />
            <span />
          </button>
        </div>
      )}
    </>
  );
}
