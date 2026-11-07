import { useEffect, useState } from "react";
import { useBgm } from "../lib/bgm";
import { pad2 } from "../lib/format";

/**
 * BGM 재생 버튼 + 곡 제목(누르면 플레이리스트 팝업).
 * 랜딩 좌하단은 기본형, 헤더·모바일 메뉴에선 `compact` 로 작게 쓴다.
 */
export function BgmPlayer({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const player = useBgm();
  const bgm = player.current ?? player.tracks[0];
  const [plOpen, setPlOpen] = useState(false);
  useEffect(() => {
    if (!plOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plOpen]);
  const listId = compact ? "bgm-playlist-mini" : "ld-playlist";
  // 도형이 꽉 차도록 뷰박스를 좁힌다
  const box = "4 2 16 20";
  const playIcon = (size: number) =>
    player.playing ? (
      <svg width={size} height={size} viewBox={box} fill="currentColor" aria-hidden="true">
        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
      </svg>
    ) : (
      <svg width={size} height={size} viewBox={box} fill="currentColor" aria-hidden="true">
        <path d="M7 4v16l13-8z" />
      </svg>
    );

  return (
    <div className={`ld-bgm ${compact ? "bgm-mini" : ""} ${className}`.trim()}>
      {/* 랜딩에선 재생 버튼이 밖에 있고, 작은 재생기는 팝업 안의 컨트롤러로만 조작한다 */}
      {compact ? null : (
        <button type="button" aria-label={player.playing ? "일시정지" : "BGM 재생"} onClick={player.toggle} disabled={!player.available} className="ld-play">
          {playIcon(14)}
        </button>
      )}
      <button type="button" className="ld-bgm-text" onClick={() => setPlOpen((v) => !v)} aria-expanded={plOpen} aria-controls={listId} aria-label="플레이리스트 열기">
        <span className="display ld-bgm-title">{bgm?.title || "[곡 제목]"}</span>
        {compact ? null : <span className="muted ld-bgm-track">{bgm?.artist || "[아티스트]"}</span>}
      </button>
      {plOpen ? (
        <div id={listId} className="ld-pl" role="dialog" aria-label="플레이리스트">
          <span className="ld-pl-head">
            <span className="ld-pl-name display narrow">
              Playlist
              <span className="accent">.</span>
            </span>
            <button type="button" className="ld-pl-close" onClick={() => setPlOpen(false)}>
              <span>Close</span>
              <span aria-hidden="true">×</span>
            </button>
          </span>
          {compact ? (
            <span className="ld-pl-ctl">
              <button type="button" aria-label="이전 곡" onClick={player.prev} disabled={!player.available}>
                <svg width="14" height="14" viewBox="2 2 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6 4h2v16H6zM20 4v16L9 12z" />
                </svg>
              </button>
              <button type="button" aria-label={player.playing ? "일시정지" : "재생"} onClick={player.toggle} disabled={!player.available} className="ld-pl-play">
                {playIcon(16)}
              </button>
              <button type="button" aria-label="다음 곡" onClick={player.next} disabled={!player.available}>
                <svg width="14" height="14" viewBox="2 2 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M16 4h2v16h-2zM4 4v16l11-8z" />
                </svg>
              </button>
            </span>
          ) : null}
          <ol className="ld-pl-list">
            {player.tracks.map((t, i) => {
              const cur = t.id === bgm?.id;
              return (
                <li key={t.id}>
                  <button type="button" className="ld-pl-item" aria-current={cur ? "true" : undefined} disabled={!t.videoId} onClick={() => player.play(t)}>
                    <span className="mono ld-pl-no">{cur && player.playing ? "▶" : pad2(i + 1)}</span>
                    <span className="ld-pl-line" />
                    <span className="ld-pl-text">
                      <span className="ld-pl-title">{t.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
