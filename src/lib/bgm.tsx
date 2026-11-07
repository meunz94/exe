import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Track } from "./types";

/**
 * 화면 밖에 숨긴 YouTube IFrame Player 하나로 BGM 을 재생한다. 앱 전체에서 공유되므로
 * 페이지를 옮겨도 계속 들리고, 페어가 바뀌면 그 페어의 목록으로 페이드 아웃 → 페이드 인 한다.
 * 목록은 끝나면 처음으로 돌아가 반복한다 (한 곡이면 그 곡을 반복).
 */
interface YTPlayer {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  setVolume: (v: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
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

const FADE_MS = 700;
/** 사용자가 직접 멈춘 뒤엔 같은 탭에서 다시 자동 재생하지 않는다 */
const PAUSED_KEY = "bgm:paused";

export interface Bgm {
  playing: boolean;
  toggle: () => void;
  play: (track: Track) => void;
  /** 이전/다음 곡 — 재생 중이면 바로 이어 재생, 아니면 곡만 바꿔 둔다 */
  prev: () => void;
  next: () => void;
  current: Track | undefined;
  available: boolean;
  tracks: Track[];
}

function useBgmPlayer(tracks: Track[]): Bgm {
  const playable = useMemo(() => tracks.filter((t) => t.videoId), [tracks]);
  const key = playable.map((t) => t.videoId).join(",");
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  // 들어오면 바로 재생을 원한다 (직접 멈춘 적이 있으면 제외)
  const wantPlay = useRef(sessionStorage.getItem(PAUSED_KEY) !== "1");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = playable[index] ?? playable[0];
  const indexRef = useRef(index);
  const lenRef = useRef(playable.length);
  useEffect(() => {
    indexRef.current = index;
    lenRef.current = playable.length;
  });
  const lastLoaded = useRef<string | undefined>(undefined);
  /** 페이드 아웃이 끝나면 실을 곡 — 그동안 아래 곡 전환 effect 가 먼저 실어 버리지 않게 */
  const pendingLoad = useRef<string | undefined>(undefined);
  const lastKey = useRef(key);
  const firstId = key.split(",")[0];
  const fadeTimer = useRef<number | null>(null);
  /** 새 곡이 실제로 PLAYING 이 되면 할 일(페이드 인). 로딩 중엔 YouTube 가 setVolume 을 버리므로 기다렸다 한다 */
  const afterPlaying = useRef<(() => void) | undefined>(undefined);
  const afterPlayingTimer = useRef<number | null>(null);

  const fadeDone = useRef<(() => void) | undefined>(undefined);
  // 볼륨을 target 까지 서서히 옮긴다. 진행 중인 페이드가 있으면 끊되, 그 뒤에 하기로 한 일(곡 교체 등)은 바로 실행해
  // 어떤 순서로 끊겨도 새 곡이 안 실리는 일이 없게 한다
  const fadeTo = useCallback((target: number, ms: number, done?: () => void) => {
    if (fadeTimer.current) {
      window.clearInterval(fadeTimer.current);
      fadeTimer.current = null;
      const prev = fadeDone.current;
      fadeDone.current = undefined;
      prev?.();
    }
    const p = player.current;
    if (!p) return done?.();
    fadeDone.current = done;
    const from = p.getVolume();
    const start = performance.now();
    fadeTimer.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const e = t * (2 - t); // ease-out
      p.setVolume(Math.round(from + (target - from) * e));
      if (t >= 1) {
        if (fadeTimer.current) window.clearInterval(fadeTimer.current);
        fadeTimer.current = null;
        fadeDone.current = undefined;
        // 플레이어가 값을 늦게 받는 일이 있어 끝난 뒤 한 번 더 확인해 맞춘다
        window.setTimeout(() => {
          if (!fadeTimer.current && player.current === p && p.getVolume() !== target) p.setVolume(target);
        }, 500);
        done?.();
      }
    }, 40);
  }, []);

  /** 곡을 실은 뒤 PLAYING 이 되면 fn 실행. 오래 안 오면(네트워크 등) 그냥 실행한다 */
  const whenPlaying = useCallback((fn: () => void) => {
    if (afterPlayingTimer.current) window.clearTimeout(afterPlayingTimer.current);
    afterPlaying.current = fn;
    afterPlayingTimer.current = window.setTimeout(() => {
      afterPlayingTimer.current = null;
      const f = afterPlaying.current;
      afterPlaying.current = undefined;
      f?.();
    }, 5000);
  }, []);

  /**
   * 자동 재생. 브라우저는 사용자 조작 전엔 소리 나는 재생을 막으므로, 먼저 그냥 시도하고
   * 막히면 음소거로 틀어 둔 뒤 첫 클릭·키 입력에 소리를 켠다.
   */
  const autoplay = useCallback(() => {
    const p = player.current;
    if (!p || !window.YT) return;
    p.setVolume(100);
    p.playVideo();
    window.setTimeout(() => {
      if (!wantPlay.current || !player.current || !window.YT) return;
      if (player.current.getPlayerState() === window.YT.PlayerState.PLAYING) return;
      player.current.mute();
      player.current.playVideo();
      const unlock = () => {
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
        const q = player.current;
        if (!q || !wantPlay.current) return;
        q.unMute();
        q.setVolume(100);
        q.playVideo();
      };
      window.addEventListener("pointerdown", unlock, true);
      window.addEventListener("keydown", unlock, true);
    }, 900);
  }, []);

  // 플레이어는 처음 곡이 생길 때 한 번만 만든다
  // 첫 곡 id 는 만들 때 한 번만 쓴다 — 이후 목록이 바뀌어도 플레이어는 그대로 두고 아래 effect 가 곡만 갈아 끼운다
  const firstRef = useRef(firstId);
  useEffect(() => {
    firstRef.current = firstId;
  }, [firstId]);
  const hasAny = !!firstId;
  useEffect(() => {
    const first = firstRef.current;
    if (!first || player.current) return;
    let cancelled = false;
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:-10px;top:-10px";
    document.body.appendChild(el);
    const holder = { el };
    loadApi().then(() => {
      if (cancelled || !window.YT) return;
      lastLoaded.current = first;
      player.current = new window.YT.Player(el, {
        width: 200,
        height: 120,
        videoId: first,
        playerVars: { playsinline: 1, controls: 0, rel: 0 },
        events: {
          onReady: () => {
            ready.current = true;
            if (wantPlay.current) autoplay();
          },
          onStateChange: (e: { data: number }) => {
            if (!window.YT) return;
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
            if (e.data === window.YT.PlayerState.PLAYING && afterPlaying.current) {
              const f = afterPlaying.current;
              afterPlaying.current = undefined;
              if (afterPlayingTimer.current) window.clearTimeout(afterPlayingTimer.current);
              afterPlayingTimer.current = null;
              f();
            }
            if (e.data === window.YT.PlayerState.ENDED) {
              // 목록 반복 — 한 곡이면 같은 곡을 처음부터 다시
              if (lenRef.current <= 1) {
                player.current?.seekTo(0, true);
                player.current?.playVideo();
              } else setIndex((i) => (i + 1) % lenRef.current);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (player.current) {
        player.current.destroy();
        player.current = null;
      }
      ready.current = false;
      lastLoaded.current = undefined;
      holder.el.remove();
    };
  }, [hasAny, autoplay]);

  // 목록이 바뀌면(페어 전환) 처음 곡으로. 재생 중이면 페이드 아웃 뒤 새 곡을 페이드 인
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    setIndex(0);
    const id = key.split(",")[0];
    const p = player.current;
    if (!p || !ready.current) return;
    if (!id) {
      if (wantPlay.current) fadeTo(0, FADE_MS, () => p.pauseVideo());
      lastLoaded.current = undefined;
      return;
    }
    if (lastLoaded.current === id) return;
    if (wantPlay.current) {
      pendingLoad.current = id;
      afterPlaying.current = undefined; // 앞선 전환이 기다리던 페이드 인은 버린다
      fadeTo(0, FADE_MS, () => {
        if (pendingLoad.current !== id) return;
        pendingLoad.current = undefined;
        lastLoaded.current = id;
        p.setVolume(0);
        p.loadVideoById(id);
        // 로딩(BUFFERING) 중에 보낸 볼륨은 YouTube 가 버리고 재생 시작 때 되돌리므로, 실제로 재생이 시작된 뒤 페이드 인
        whenPlaying(() => {
          p.setVolume(0);
          fadeTo(100, FADE_MS);
        });
      });
    } else {
      lastLoaded.current = id;
      p.cueVideoById(id);
    }
  }, [key, fadeTo, whenPlaying]);

  // 곡 전환: 재생 중(또는 재생 요청 상태)이면 바로 재생, 아니면 큐만 걸어 둔다. 페이드 뒤에 실을 곡이면 기다린다
  useEffect(() => {
    const id = current?.videoId;
    if (!id || !ready.current || !player.current || lastLoaded.current === id || pendingLoad.current === id) return;
    lastLoaded.current = id;
    if (wantPlay.current) player.current.loadVideoById(id);
    else player.current.cueVideoById(id);
  }, [current?.videoId]);

  // 안전장치: 어떤 경로로든 소리 없이(볼륨 0) 재생 중인 상태가 되면, 페이드 중이 아닐 때 볼륨을 되돌린다
  useEffect(() => {
    if (!playing || !wantPlay.current) return;
    const t = window.setTimeout(() => {
      const p = player.current;
      if (p && wantPlay.current && !fadeTimer.current && p.getVolume() === 0) p.setVolume(100);
    }, 50);
    return () => window.clearTimeout(t);
  }, [playing]);

  const toggle = useCallback(() => {
    if (!key) return;
    if (playing) {
      player.current?.pauseVideo();
      wantPlay.current = false;
      sessionStorage.setItem(PAUSED_KEY, "1");
    } else {
      wantPlay.current = true;
      sessionStorage.removeItem(PAUSED_KEY);
      if (ready.current) {
        player.current?.unMute();
        player.current?.setVolume(100);
        player.current?.playVideo();
      }
    }
  }, [playing, key]);

  /** 목록에서 곡을 고르면 그 곡부터 재생한다. */
  const play = (track: Track) => {
    const i = playable.findIndex((t) => t.id === track.id);
    if (i < 0) return;
    wantPlay.current = true;
    sessionStorage.removeItem(PAUSED_KEY);
    player.current?.unMute();
    if (i === indexRef.current) {
      if (ready.current) player.current?.playVideo();
    } else setIndex(i);
  };

  const step = (d: number) => {
    const n = playable.length;
    if (!n) return;
    setIndex((i) => (i + d + n) % n);
  };
  const prev = () => step(-1);
  const next = () => step(1);

  return { playing, toggle, play, prev, next, current, available: !!key, tracks };
}

const Ctx = createContext<Bgm | null>(null);

export function BgmProvider({ tracks, children }: { tracks: Track[]; children: ReactNode }) {
  const bgm = useBgmPlayer(tracks);
  return <Ctx.Provider value={bgm}>{children}</Ctx.Provider>;
}

export function useBgm(): Bgm {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("BgmProvider 밖에서 useBgm 이 호출됨");
  return ctx;
}
