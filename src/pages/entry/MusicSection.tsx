import { useState } from "react";
import type { PlaylistItem, YoutubeVideo } from "../../types";
import styles from "../EntryPage.module.css";

interface MusicSectionProps {
  playlist: PlaylistItem[];
  videos: YoutubeVideo[];
}

/**
 * Tracks and clips. Video sits alongside music rather than in its own tab —
 * both are timed media and neither has the volume to stand alone.
 */
export default function MusicSection({ playlist, videos }: MusicSectionProps) {
  const [openLyrics, setOpenLyrics] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  if (playlist.length === 0 && videos.length === 0) {
    return <p className={styles.empty}>등록된 트랙이 없습니다</p>;
  }

  return (
    <>
      {playlist.length > 0 && (
        <div className={styles.rows}>
          {playlist.map((track, i) => {
            const expanded = openLyrics === track.id;
            return (
              <div key={track.id}>
                <button
                  type="button"
                  className={`${styles.row} ${track.lyrics ? styles.rowInteractive : ""}`}
                  onClick={() => track.lyrics && setOpenLyrics(expanded ? null : track.id)}
                  aria-expanded={track.lyrics ? expanded : undefined}
                >
                  <span className={styles.rowNum}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{track.title}</span>
                    <span className={styles.rowSub}>{track.artist}</span>
                  </span>
                  <span className={styles.rowRight}>
                    {track.lyrics ? (expanded ? "− " : "+ ") : ""}
                    {track.duration}
                  </span>
                </button>
                {expanded && track.lyrics && (
                  <p className={styles.rowNote}>{track.lyrics}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {videos.length > 0 && (
        <div className={styles.block}>
          <div className={styles.blockHead}>
            <span>Video</span>
            <span>{String(videos.length).padStart(2, "0")}</span>
          </div>
          <div className={styles.grid}>
            {videos.map((v, i) => (
              <div key={v.id}>
                {playing === v.id ? (
                  <div className={styles.videoFrame}>
                    <iframe
                      src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1&rel=0`}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.card}
                    onClick={() => setPlaying(v.id)}
                  >
                    <span className={styles.videoThumb}>
                      <img
                        src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                      />
                    </span>
                    <span className={styles.cardTop}>
                      <span className={styles.cardNum}>
                        {String(i + 1).padStart(8, "0")}
                      </span>
                      <span>▶</span>
                    </span>
                    <h3 className={styles.cardTitle}>{v.title}</h3>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
