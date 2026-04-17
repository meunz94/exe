import { useState } from "react";
import type { YoutubeVideo } from "../../types";
import styles from "./YoutubePlayer.module.css";

interface YoutubePlayerProps {
  videos: YoutubeVideo[];
}

export default function YoutubePlayer({ videos }: YoutubePlayerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);

  if (videos.length === 0) return null;

  const video = videos[currentIdx];

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>VIDEO</h3>
      <div className={styles.playerWrapper}>
        <iframe
          src={`https://www.youtube.com/embed/${video.videoId}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p className={styles.title}>{video.title}</p>
      {videos.length > 1 && (
        <div className={styles.nav}>
          <button
            className={styles.navButton}
            onClick={() => setCurrentIdx((i) => (i - 1 + videos.length) % videos.length)}
          >
            ‹
          </button>
          <span className={styles.navCounter}>
            {currentIdx + 1} / {videos.length}
          </span>
          <button
            className={styles.navButton}
            onClick={() => setCurrentIdx((i) => (i + 1) % videos.length)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
