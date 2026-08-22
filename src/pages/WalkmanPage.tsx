import { useEffect, useRef, useState } from "react";
import type { PlaylistItem } from "../types";
import { formatTime, useYouTubeAudio } from "../hooks/useYouTubeAudio";
import styles from "./WalkmanPage.module.css";

interface WalkmanPageProps {
  playlist: PlaylistItem[];
  onBack: () => void;
}

/** Rotating-reel cassette, the vinyl stand-in from the reference layout. */
function Cassette({ spinning }: { spinning: boolean }) {
  const reel = (cx: number) => (
    <g className={`${styles.reel} ${spinning ? styles.reelSpin : ""}`} style={{ transformOrigin: `${cx}px 88px` }}>
      <circle cx={cx} cy={88} r={26} fill="none" stroke="currentColor" strokeWidth={3} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <line
          key={a}
          x1={cx}
          y1={88}
          x2={cx + 22 * Math.cos((a * Math.PI) / 180)}
          y2={88 + 22 * Math.sin((a * Math.PI) / 180)}
          stroke="currentColor"
          strokeWidth={3}
        />
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 300 190" className={styles.cassette} role="img" aria-label="cassette tape">
      {/* shell */}
      <rect x={6} y={6} width={288} height={178} rx={12} fill="none" stroke="currentColor" strokeWidth={4} />
      {/* label strip, blank on purpose */}
      <rect x={26} y={22} width={248} height={38} fill="currentColor" opacity={0.08} />
      {/* reel window */}
      <rect x={58} y={62} width={184} height={52} rx={26} fill="none" stroke="currentColor" strokeWidth={3} />
      {reel(96)}
      {reel(204)}
      {/* tape between reels */}
      <line x1={122} y1={88} x2={178} y2={88} stroke="currentColor" strokeWidth={5} opacity={0.5} />
      {/* screws */}
      {[
        [18, 18],
        [282, 18],
        [18, 172],
        [282, 172],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="currentColor" opacity={0.5} />
      ))}
      {/* capstan holes */}
      <circle cx={110} cy={152} r={6} fill="none" stroke="currentColor" strokeWidth={3} />
      <circle cx={190} cy={152} r={6} fill="none" stroke="currentColor" strokeWidth={3} />
    </svg>
  );
}

/** The ring around the cassette doubles as the transport dial: it fills with
    the playhead, and dragging around it scrubs through the song. */
function DialRing({
  progress,
  seekable,
  onSeek,
}: {
  progress: number;
  seekable: boolean;
  onSeek: (p: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [preview, setPreview] = useState<number | null>(null);
  const p = Math.max(0, Math.min(1, preview ?? progress));

  const fractionAt = (e: { clientX: number; clientY: number }) => {
    const rect = svg.current!.getBoundingClientRect();
    let a =
      Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)) +
      Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    return a / (Math.PI * 2);
  };

  const knobX = 50 + 47 * Math.sin(p * Math.PI * 2);
  const knobY = 50 - 47 * Math.cos(p * Math.PI * 2);

  return (
    <svg ref={svg} viewBox="0 0 100 100" className={styles.dial}>
      <circle cx={50} cy={50} r={47} className={styles.dialTrack} />
      <circle
        cx={50}
        cy={50}
        r={47}
        pathLength={100}
        strokeDasharray={`${p * 100} 100`}
        className={`${styles.dialProgress} ${seekable ? styles.dialOn : ""}`}
        transform="rotate(-90 50 50)"
      />
      {seekable && (
        <>
          <circle cx={knobX} cy={knobY} r={3.2} className={styles.dialKnob} />
          <circle
            cx={50}
            cy={50}
            r={47}
            className={styles.dialHit}
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as Element).setPointerCapture(e.pointerId);
              setPreview(fractionAt(e));
            }}
            onPointerMove={(e) => {
              if (dragging.current) setPreview(fractionAt(e));
            }}
            onPointerUp={(e) => {
              dragging.current = false;
              (e.target as Element).releasePointerCapture(e.pointerId);
              onSeek(fractionAt(e));
              setPreview(null);
            }}
          />
        </>
      )}
    </svg>
  );
}

/**
 * WALKMAN: the playlist. Playback runs through the YouTube IFrame API so the
 * page learns real durations by itself and the dial ring can scrub the song.
 */
export default function WalkmanPage({ playlist, onBack }: WalkmanPageProps) {
  const [index, setIndex] = useState(0);
  const { playing, duration, time, knownDurations, play, pause, seekTo, stop } = useYouTubeAudio();

  const active: PlaylistItem | undefined = playlist[index];
  const activeDuration = duration || (active?.videoId ? (knownDurations[active.videoId] ?? 0) : 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
      if (e.key === "ArrowDown") setIndex((i) => Math.min(i + 1, playlist.length - 1));
      if (e.key === "ArrowUp") setIndex((i) => Math.max(i - 1, 0));
      if (e.key === "ArrowRight" && activeDuration) seekTo(Math.min(time + 5, activeDuration));
      if (e.key === "ArrowLeft" && activeDuration) seekTo(Math.max(time - 5, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, playlist.length, activeDuration, time, seekTo]);

  const select = (i: number) => {
    const track = playlist[i];
    if (i === index) {
      if (!track?.videoId) return;
      if (playing) pause();
      else play(track.videoId);
      return;
    }
    setIndex(i);
    if (track?.videoId) play(track.videoId);
    else stop();
  };

  if (!active) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>등록된 트랙이 없습니다</p>
        <button type="button" className={styles.back} onClick={onBack}>
          ← BACK TO DESK
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← W/M
        </button>
        <div className={styles.masthead}>
          <strong>LIMBIC SYSTEM</strong>
          <span>MUSIC STREAMING</span>
        </div>
        <span className={styles.cats}>{playlist.length} TRACKS</span>
      </header>

      <div className={styles.split}>
        <section className={styles.media}>
          <div className={`${styles.discRing} ${playing ? styles.discRingOn : ""}`}>
            <DialRing
              progress={activeDuration ? time / activeDuration : 0}
              seekable={Boolean(active.videoId) && activeDuration > 0}
              onSeek={(p) => seekTo(p * activeDuration)}
            />
            <Cassette spinning={playing} />
          </div>
          <div className={styles.mediaTime}>
            <span>{playing ? "PLAYING" : "STOPPED"}</span>
            <span>
              {formatTime(time)} / {formatTime(activeDuration)}
            </span>
          </div>
          <div className={styles.lyrics}>
            {active.lyrics ? (
              <pre>{active.lyrics}</pre>
            ) : (
              <p className={styles.lyricsEmpty}>가사가 등록되지 않았습니다</p>
            )}
          </div>
        </section>

        <section className={styles.list}>
          <h1 className={styles.bigTitle}>{active.title}</h1>
          <p className={styles.bigSub}>{active.artist || "—"}</p>

          <h2 className={styles.listLabel}>PLAYLIST</h2>
          <ol className={styles.tracks}>
            {playlist.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`${styles.track} ${i === index ? styles.trackActive : ""}`}
                  onClick={() => select(i)}
                >
                  <span className={styles.trackNum}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.trackMain}>
                    <span className={styles.trackTitle}>
                      {t.title}
                      {i === index && (
                        <em className={styles.trackState}>{playing ? "❚❚" : t.videoId ? "▶" : "NO AUDIO"}</em>
                      )}
                    </span>
                    <span className={styles.trackArtist}>{t.artist}</span>
                  </span>
                  <span className={styles.trackTime}>
                    {t.videoId ? formatTime(knownDurations[t.videoId] ?? 0) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
