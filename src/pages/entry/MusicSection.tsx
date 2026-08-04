import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaylistItem, YoutubeVideo } from "../../types";
import shared from "../EntryPage.module.css";
import styles from "./MusicSection.module.css";

interface MusicSectionProps {
  playlist: PlaylistItem[];
  videos: YoutubeVideo[];
}

/** One disc on the rail. */
interface Disc {
  id: string;
  title: string;
  artist?: string;
  duration?: string;
  lyrics?: string;
  /** Absent = nothing to play; the disc is display-only. */
  videoId?: string;
}

/** Must match `.disc` width and `.rail` gap in the stylesheet. */
const DISC_REM = 13;
const GAP_REM = 2.2;
const DISC_REM_SM = 9.5;
const GAP_REM_SM = 1.4;

/** Pointer travel (px) past which a press counts as a drag, not a click. */
const DRAG_SLOP = 6;
/** How much a flick's speed carries into the landing disc. */
const FLING = 0.16;

/**
 * Music: a rail of CDs you scroll through, the active track's lyrics alongside,
 * and the video playing faintly on the disc face itself.
 *
 * Tracks and standalone videos are merged into one rail. The playlist carries
 * lyrics but no video ids yet; the video entries carry ids but no lyrics — so
 * the deck is immediately playable for the latter and lights up for the former
 * as `videoId` gets filled in.
 */
export default function MusicSection({ playlist, videos }: MusicSectionProps) {
  const discs = useMemo<Disc[]>(
    () => [
      ...playlist.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        lyrics: t.lyrics,
        videoId: t.videoId,
      })),
      ...videos.map((v) => ({ id: v.id, title: v.title, videoId: v.videoId })),
    ],
    [playlist, videos]
  );

  const [index, setIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  /** Distance between disc centres, in px. */
  const [step, setStep] = useState((DISC_REM + GAP_REM) * 16);

  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  /** Live drag bookkeeping — refs so pointer moves don't trigger renders. */
  const drag = useRef({ active: false, startX: 0, startLeft: 0, lastX: 0, lastT: 0, vx: 0 });
  /** Set when a press turned into a drag, so the trailing click doesn't play. */
  const movedFar = useRef(false);

  // Scroll offsets are in px, so the rem-based step is resolved against the real
  // root font size and the active breakpoint. Deliberately derived from rem and
  // viewport width only — never from a measured element. The rail's centring
  // padding is pure CSS for the same reason; measuring layout and writing back a
  // value that changes it used to run away.
  useEffect(() => {
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const small = window.innerWidth <= 900;
      const disc = (small ? DISC_REM_SM : DISC_REM) * rem;
      const gap = (small ? GAP_REM_SM : GAP_REM) * rem;
      setStep(disc + gap);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(discs.length - 1, i)),
    [discs.length]
  );

  /** Scrolls a disc to the centre; snapping settles it exactly. */
  const scrollToDisc = useCallback(
    (i: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      stage.scrollTo({ left: clamp(i) * step, behavior: "smooth" });
    },
    [clamp, step]
  );

  // Scroll position is the source of truth for which disc is active, so native
  // snapping, touch swipes and the keyboard all feed the same path.
  const onScroll = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || step <= 0) return;
    const next = clamp(Math.round(stage.scrollLeft / step));
    setIndex((prev) => {
      if (prev === next) return prev;
      // Landing on a different disc stops playback — two tracks at once is
      // never what you want.
      setPlayingId(null);
      return next;
    });
  }, [clamp, step]);

  // A plain vertical wheel is mapped onto the rail, but only while the rail can
  // still move that way. At either end the event is left alone so the page keeps
  // scrolling — otherwise the pointer would be trapped on the deck.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      // Horizontal intent (trackpad swipe, shift+wheel) the scroller already
      // handles natively.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const max = stage.scrollWidth - stage.clientWidth;
      const atStart = stage.scrollLeft <= 1;
      const atEnd = stage.scrollLeft >= max - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;

      e.preventDefault();
      stage.scrollLeft += e.deltaY;
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  // Drag-to-scrub. Only mouse pointers are handled: touch already pans the
  // scroller natively, and intercepting it would fight the browser's own
  // momentum. Snapping is switched off for the duration — with `mandatory` on,
  // every scrollLeft write during a drag gets yanked back to the nearest disc.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;

    drag.current = {
      active: true,
      startX: e.clientX,
      startLeft: stage.scrollLeft,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    };
    movedFar.current = false;
    // Capture is deliberately NOT taken here. Capturing on pointerdown makes the
    // browser retarget the trailing `click` to the capture element, so the
    // disc's own onClick never fires and a plain click stops playing anything.
    // It's taken below, once the press has actually become a drag.
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d.active || !stage) return;

    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > DRAG_SLOP && !movedFar.current) {
      movedFar.current = true;
      setDragging(true);
      // Now that it's a drag, capture so moves keep arriving even if the
      // pointer leaves the deck.
      stage.setPointerCapture(e.pointerId);
    }

    // px per ms, smoothed a little so a single jittery sample can't dominate
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.vx = 0.7 * d.vx + 0.3 * ((e.clientX - d.lastX) / dt);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;

    stage.scrollLeft = d.startLeft - dx;
  }, []);

  const endDrag = useCallback(() => {
    const d = drag.current;
    const stage = stageRef.current;
    if (!d.active || !stage) return;
    const wasDrag = movedFar.current;
    d.active = false;
    setDragging(false);

    // A press that never moved is a click; leave the scroll position alone and
    // let the disc's onClick handle it.
    if (!wasDrag || step <= 0) return;
    // Land on a disc, letting a flick carry past the nearest one.
    const from = stage.scrollLeft / step;
    const carry = Math.max(-2, Math.min(2, -d.vx * FLING * (step / 100)));
    scrollToDisc(Math.round(from + carry));
  }, [step, scrollToDisc]);

  const toggle = useCallback(
    (i: number) => {
      // A press that turned into a drag must not also toggle playback.
      if (movedFar.current) {
        movedFar.current = false;
        return;
      }
      if (i !== clamp(index)) {
        scrollToDisc(i);
        return;
      }
      const disc = discs[i];
      if (!disc?.videoId) return;
      setPlayingId((p) => (p === disc.id ? null : disc.id));
    },
    [index, clamp, discs, scrollToDisc]
  );

  if (discs.length === 0) {
    return <p className={shared.empty}>등록된 트랙이 없습니다</p>;
  }

  const active = discs[clamp(index)];
  const isPlaying = playingId === active.id;

  return (
    <div className={styles.wrap}>
      <aside className={styles.lyrics}>
        <div className={styles.lyricsHead}>
          <span>Lyrics</span>
          <span>{active.duration ?? "—"}</span>
        </div>
        {active.lyrics ? (
          <div className={styles.lyricsBody}>{active.lyrics}</div>
        ) : (
          <p className={styles.lyricsEmpty}>가사가 등록되지 않았습니다</p>
        )}
      </aside>

      <div className={styles.deck}>
        <div className={styles.stageWrap}>
        <div
          className={`${styles.stage} ${dragging ? styles.dragging : ""}`}
          ref={stageRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDragStart={(e) => e.preventDefault()}
          tabIndex={0}
          role="listbox"
          aria-label="트랙 선택 — 드래그하거나 스크롤"
        >
          <div className={styles.rail}>
            {discs.map((d, i) => {
              const activeDisc = i === clamp(index);
              const spinning = activeDisc && isPlaying;
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`${styles.disc} ${activeDisc ? styles.discActive : ""}`}
                  onClick={() => toggle(i)}
                  role="option"
                  aria-selected={activeDisc}
                  aria-label={d.title}
                >
                  {/* iridescent pressing — this is what spins */}
                  <span className={`${styles.discFace} ${spinning ? styles.discSpin : ""}`} />

                  {/* The video sunk into the disc: circular-clipped, blurred and
                      screen-blended so it reads as a reflection in the plastic
                      rather than a video in a hole. Deliberately does NOT
                      rotate — a reflection wouldn't. */}
                  {spinning && d.videoId && (
                    <span className={styles.discVideo}>
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${d.videoId}?autoplay=1&rel=0&controls=0&modestbranding=1&playsinline=1`}
                        title={d.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </span>
                  )}

                  {/* gloss sweep above the reflection, spinning with the disc */}
                  <span className={`${styles.discGloss} ${spinning ? styles.discSpin : ""}`} />

                  {/* label ring + spindle hole, always upright and on top */}
                  <span className={styles.discHub} />
                  <span className={styles.discNum}>{String(i + 1).padStart(2, "0")}</span>

                  {activeDisc && d.videoId && (
                    <span className={styles.discPlay}>{spinning ? "❚❚" : "▶"}</span>
                  )}
                  {activeDisc && !d.videoId && (
                    <span className={styles.discMuted}>no audio linked</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaMain}>
            <h3 className={styles.trackTitle}>{active.title}</h3>
            <span className={styles.trackSub}>
              {[active.artist, active.duration].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
          <span className={styles.counter}>
            {String(clamp(index) + 1).padStart(2, "0")} / {String(discs.length).padStart(2, "0")}
          </span>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => toggle(clamp(index))}
            disabled={!active.videoId}
          >
            {isPlaying ? "❚❚ Pause" : "▶ Play"}
          </button>
          <span className={styles.hint}>드래그하거나 스크롤해서 넘기세요</span>
        </div>
      </div>
    </div>
  );
}
