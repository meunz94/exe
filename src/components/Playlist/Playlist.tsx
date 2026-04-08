import type { PlaylistItem } from "../../types";
import styles from "./Playlist.module.css";

interface PlaylistProps {
  items: PlaylistItem[];
}

export default function Playlist({ items }: PlaylistProps) {
  if (items.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>PLAYLIST</h3>
      <div className={styles.list}>
        {items.map((item, idx) => (
          <div key={item.id} className={styles.track}>
            <span className={styles.num}>{String(idx + 1).padStart(2, "0")}</span>
            <div className={styles.info}>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.artist}>{item.artist}</span>
            </div>
            <span className={styles.duration}>{item.duration}</span>
            {item.lyrics && (
              <div className={styles.tooltip}>
                <span className={styles.tooltipLabel}>♪</span>
                <p className={styles.tooltipText}>{item.lyrics}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
