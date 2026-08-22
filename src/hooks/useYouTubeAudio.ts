import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Headless YouTube playback via the IFrame Player API — unlike a bare embed
 * it reports duration/position and can seek, which drives the walkman dial.
 */

interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const DURATION_CACHE_KEY = "wm-durations";

function readDurationCache(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DURATION_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useYouTubeAudio() {
  const holder = useRef<HTMLDivElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const currentId = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  /** learned video lengths, persisted so the list can show them next visit */
  const [knownDurations, setKnownDurations] = useState<Record<string, number>>(readDurationCache);

  useEffect(() => {
    let cancelled = false;
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:-10px;top:-10px";
    document.body.appendChild(el);
    holder.current = el;

    loadApi().then(() => {
      if (cancelled || !window.YT) return;
      player.current = new window.YT.Player(el, {
        width: 200,
        height: 120,
        playerVars: { playsinline: 1, controls: 0, rel: 0 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (!window.YT) return;
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
            if (e.data === window.YT.PlayerState.PLAYING && player.current) {
              const d = player.current.getDuration();
              if (d > 0 && currentId.current) {
                setDuration(d);
                const id = currentId.current;
                setKnownDurations((known) => {
                  if (known[id] === d) return known;
                  const next = { ...known, [id]: d };
                  try {
                    localStorage.setItem(DURATION_CACHE_KEY, JSON.stringify(next));
                  } catch {
                    /* storage may be unavailable */
                  }
                  return next;
                });
              }
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      el.remove();
    };
  }, []);

  // Track the playhead while something plays.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const p = player.current;
      if (!p) return;
      setTime(p.getCurrentTime());
      const d = p.getDuration();
      if (d > 0) setDuration(d);
    }, 500);
    return () => window.clearInterval(id);
  }, [playing]);

  const play = useCallback((videoId: string) => {
    if (!player.current) return;
    if (currentId.current !== videoId) {
      currentId.current = videoId;
      setTime(0);
      setDuration(0);
      player.current.loadVideoById(videoId);
    } else {
      player.current.playVideo();
    }
  }, []);

  const pause = useCallback(() => player.current?.pauseVideo(), []);

  const seekTo = useCallback((seconds: number) => {
    player.current?.seekTo(seconds, true);
    setTime(seconds);
  }, []);

  const stop = useCallback(() => {
    player.current?.pauseVideo();
    setTime(0);
  }, []);

  return { playing, duration, time, knownDurations, play, pause, seekTo, stop };
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—:—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
