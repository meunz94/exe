import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DsButton } from "../au/NintendoScene";
import { setChipBrand } from "../au/chipTexture";
import { setScreenAccent } from "../au/screenTextures";
import { TABS, type TopScreenHandle } from "../au/screenTextures";
import { contentFor, type Chip, type DsTab } from "../au/types";
import { useJson } from "../lib/data";
import { useRouter } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { AuChip } from "../lib/types";
import { useTitle } from "../components/Head";

const NintendoScene = lazy(() => import("../au/NintendoScene"));

/** 760px 이하: 3D DS 를 엄지로 다루기 어려우니 메뉴를 진짜 버튼으로 */
function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/**
 * AU 칩 라이브러리 — 잠든 DS 위에 카트리지 고리. 스크롤로 돌리고 앞의 칩을 누르면 꽂히며 DS 가 열린다.
 * 상세 모드에선 칩 케이스가 팝업 옆에 떠 있고, 나머지는 DS 본체에서 조작(터치 메뉴·십자키·A/B).
 * 경로: /au/chips, /au/chips/<칩 id>
 */
export function AuChips({ chipId }: { chipId: string }) {
  const { pair, to } = useSite();
  const { navigate } = useRouter();
  useTitle(`AU — ${pair.name}`);
  const data = useJson<AuChip[]>(pairPath(pair, "au.json"), []);
  const chips = useMemo<Chip[]>(() => data.map((c) => ({ id: c.id, title: c.title, description: c.description })), [data]);
  const mobile = useMobile();
  const [mode, setMode] = useState<"carousel" | "detail">("carousel");
  const [inserting, setInserting] = useState(false);
  const [view, setView] = useState<"menu" | "zoom">("menu");
  const [activeChip, setActiveChip] = useState<Chip | null>(null);
  const [tab, setTab] = useState<DsTab>("profile");
  const [topHandle, setTopHandle] = useState<TopScreenHandle | null>(null);
  const touchY = useRef<number | null>(null);

  useEffect(() => setChipBrand(pair.name), [pair.name]);
  useEffect(() => setScreenAccent(pair.accent), [pair.accent]);

  const content = useMemo(() => {
    const full = activeChip ? data.find((c) => c.id === activeChip.id) : null;
    return full ? contentFor(full) : null;
  }, [activeChip, data]);

  const requestClose = useCallback(() => {
    setMode("carousel");
    setView("menu");
    if (chipId) navigate(to("au", "chips"), true);
  }, [chipId, navigate, to]);

  const jumpToChip = useCallback((chip: Chip) => {
    setActiveChip(chip);
    setTab("profile");
    setView("menu");
    setMode("detail");
  }, []);

  // 딥링크: /au/chips/<id>
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current || chips.length === 0) return;
    consumed.current = true;
    const chip = chipId ? chips.find((c) => c.id === chipId) : null;
    if (!chip) return;
    const t = window.setTimeout(() => jumpToChip(chip), 0);
    return () => window.clearTimeout(t);
  }, [chips, chipId, jumpToChip]);

  // 라우터의 뒤로가기(chipId 가 비면 고리로)
  useEffect(() => {
    if (!consumed.current) return;
    if (!chipId && mode === "detail") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("carousel");
      setView("menu");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipId]);

  const onTopClick = useCallback(() => {
    setView((v) => {
      if (v === "zoom") return "menu";
      requestClose();
      return v;
    });
  }, [requestClose]);

  const onPickTab = useCallback((t: DsTab) => {
    setTab(t);
    setView("zoom");
  }, []);

  const onButton = useCallback((btn: DsButton) => {
    if (btn === "A") setView("zoom");
    if (btn === "B") setView("menu");
    if (btn === "padUp" || btn === "padDown") {
      setView("menu");
      setTab((cur) => {
        const i = TABS.findIndex((t) => t.id === cur);
        return TABS[(i + (btn === "padDown" ? 1 : TABS.length - 1)) % TABS.length].id;
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode !== "detail") return navigate(to("au"));
      if (view === "zoom") setView("menu");
      else requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, view, requestClose, navigate, to]);

  const dark = inserting || mode === "detail";

  return (
    <div className="chips">
      <div className={`chips-shade ${dark ? "on" : ""}`} />
      {content?.bg && <div className={`chips-bg ${dark ? "on" : ""}`} style={{ backgroundImage: `url(${content.bg})` }} />}

      <div className="chips-canvas">
        <Suspense fallback={<div className="chips-loading mono">LOADING CARTRIDGES...</div>}>
          <NintendoScene
            chips={chips}
            mode={mode}
            activeChip={activeChip}
            content={content}
            tab={tab}
            zoomed={mode === "detail" && view === "zoom"}
            compact={mobile}
            onInsert={(chip) => {
              setActiveChip(chip);
              setTab("profile");
              setView("menu");
              setInserting(true);
              navigate(to("au", "chips", chip.id));
            }}
            onOpened={() => {
              setInserting(false);
              setMode("detail");
            }}
            onCloseRequest={onTopClick}
            onClosed={() => setActiveChip(null)}
            onPickTab={onPickTab}
            onButton={onButton}
            onTopHandle={setTopHandle}
          />
        </Suspense>
      </div>

      {mode === "carousel" && (
        <div className={inserting ? "chips-fading" : undefined}>
          <header className="chips-top mono">
            <button type="button" className="chips-back" onClick={() => navigate(to("au"))}>
              ← HOME
            </button>
          </header>
          {chips.length ? null : <p className="chips-hint mono">등록된 칩이 없어요</p>}
        </div>
      )}

      {mode === "detail" && activeChip && content && (
        <>
          {view === "menu" && mobile && (
            <aside className="chips-sheet">
              <span className="chips-sheet-kind mono">AU.CHIP</span>
              <h2 className="chips-sheet-title">{activeChip.title}</h2>
              <p className="chips-sheet-body mono">{content.synopsis || "등록된 시놉시스가 없습니다."}</p>
              <div className="chips-sheet-tabs">
                {TABS.map((t) => (
                  <button key={t.id} type="button" className="chips-sheet-tab" onClick={() => onPickTab(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </aside>
          )}

          {view === "menu" && !mobile && (
            <aside className="chips-info">
              <span className="chips-info-kind mono">AU.CHIP — NOW PLAYING</span>
              <h2 className="chips-info-title">{activeChip.title}</h2>
              <div className="chips-info-body mono">
                {(content.synopsis || "등록된 시놉시스가 없습니다.")
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
              </div>
            </aside>
          )}

          {view === "zoom" && topHandle && (
            <div className="chips-zoom" onClick={() => setView("menu")}>
              <div
                className="chips-zoom-screen"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => topHandle.scrollBy(e.deltaY * 0.5)}
                onTouchStart={(e) => {
                  touchY.current = e.touches[0]?.clientY ?? null;
                }}
                onTouchMove={(e) => {
                  const y = e.touches[0]?.clientY;
                  if (y == null || touchY.current == null) return;
                  topHandle.scrollBy((touchY.current - y) * 1.4);
                  touchY.current = y;
                }}
                ref={(el) => {
                  if (el && topHandle.canvas.parentElement !== el) el.appendChild(topHandle.canvas);
                }}
              />
              {mobile && (
                <div className="chips-zoom-tabs" onClick={(e) => e.stopPropagation()}>
                  {TABS.map((t) => (
                    <button key={t.id} type="button" className="chips-zoom-tab" aria-pressed={tab === t.id} onClick={() => onPickTab(t.id)}>
                      {t.label}
                    </button>
                  ))}
                  <button type="button" className="chips-zoom-tab" onClick={() => setView("menu")}>
                    닫기
                  </button>
                </div>
              )}
            </div>
          )}

          <button type="button" className="chips-eject mono" onClick={requestClose}>
            ← EJECT
          </button>
        </>
      )}
    </div>
  );
}
