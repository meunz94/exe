import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "../types";
import { TABS } from "../components/Nintendo/screenTextures";
import type { DsButton } from "../components/Nintendo/NintendoScene";
import type { TopScreenHandle } from "../components/Nintendo/screenTextures";
import {
  chipsFrom,
  contentFor,
  type Chip,
  type DsTab,
} from "../types/nintendo";
import styles from "./NintendoPage.module.css";

const NintendoScene = lazy(() => import("../components/Nintendo/NintendoScene"));

interface NintendoPageProps {
  data: AppData;
  onBack: () => void;
}

/**
 * NINTENDO: a ring of cartridges over a sleeping DS. Scroll spins the ring;
 * clicking the front chip slots it in and the DS unfolds. In detail mode the
 * chip floats beside a popup holding the title/synopsis, and everything else
 * is operated on the DS itself — touch the menu (or use the pad/A/B) and the
 * top screen zooms up to read.
 */
const chipIdFromPath = () => window.location.pathname.split("/")[2] ?? null;

/** Phones get a different detail layout — the 3D DS is too small to operate
    with a thumb, so the menu moves to real buttons and the screen fills the
    width. */
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

export default function NintendoPage({ data, onBack }: NintendoPageProps) {
  const chips = useMemo(() => chipsFrom(data), [data]);
  const mobile = useMobile();
  const [mode, setMode] = useState<"carousel" | "detail">("carousel");
  /** true from the moment a chip is clicked until the DS finishes opening —
      drives the slow crossfade into the dark detail backdrop */
  const [inserting, setInserting] = useState(false);
  const [view, setView] = useState<"menu" | "zoom">("menu");
  const [activeChip, setActiveChip] = useState<Chip | null>(null);
  const [tab, setTab] = useState<DsTab>("profile");
  /** live top-screen handle from the scene — its canvas doubles as the
      centered zoom view, its scrollBy drives the wheel */
  const [topHandle, setTopHandle] = useState<TopScreenHandle | null>(null);
  /** last touch Y while dragging the zoomed screen */
  const touchY = useRef<number | null>(null);

  const content = useMemo(
    () => (activeChip ? contentFor(activeChip, data) : null),
    [activeChip, data]
  );

  const requestClose = useCallback(() => {
    setMode("carousel");
    setView("menu");
    if (chipIdFromPath()) window.history.pushState(null, "", "/nintendo");
  }, []);

  /** Opens a chip's detail directly (deep link / history navigation). */
  const jumpToChip = useCallback((chip: Chip) => {
    setActiveChip(chip);
    setTab("profile");
    setView("menu");
    setMode("detail");
  }, []);

  // Deep link: /nintendo/<chipId> opens that cartridge once the data is in.
  const consumedDeepLink = useRef(false);
  useEffect(() => {
    if (consumedDeepLink.current || chips.length === 0) return;
    consumedDeepLink.current = true;
    const wanted = chipIdFromPath();
    const chip = wanted ? chips.find((c) => c.id === wanted) : null;
    if (!chip) return;
    const t = window.setTimeout(() => jumpToChip(chip), 0);
    return () => window.clearTimeout(t);
  }, [chips, jumpToChip]);

  // Browser back/forward within the section.
  useEffect(() => {
    const onPop = () => {
      if (!window.location.pathname.startsWith("/nintendo")) return;
      const wanted = chipIdFromPath();
      const chip = wanted ? chips.find((c) => c.id === wanted) : null;
      if (chip) jumpToChip(chip);
      else {
        setMode("carousel");
        setView("menu");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [chips, jumpToChip]);

  // Top-screen click: reading mode backs out to the menu; menu mode ejects.
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
        const next = (i + (btn === "padDown" ? 1 : TABS.length - 1)) % TABS.length;
        return TABS[next].id;
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode !== "detail") return onBack();
      if (view === "zoom") setView("menu");
      else requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, view, requestClose, onBack]);

  const dark = inserting || mode === "detail";

  return (
    <div className={styles.page}>
      {/* crossfade into the dark detail backdrop while the DS opens */}
      <div className={`${styles.shade} ${dark ? styles.shadeOn : ""}`} />
      {content?.bg && (
        <div
          className={`${styles.bg} ${dark ? styles.bgOn : ""}`}
          style={{ backgroundImage: `url(${content.bg})` }}
        />
      )}

      <div className={styles.canvas}>
        <Suspense fallback={<div className={styles.loading}>LOADING CARTRIDGES...</div>}>
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
              window.history.pushState(null, "", `/nintendo/${chip.id}`);
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

      {/* carousel chrome */}
      {mode === "carousel" && (
        <div className={inserting ? styles.chromeFading : undefined}>
          <header className={styles.top}>
            <button type="button" className={styles.back} onClick={onBack}>
              ← DESK
            </button>
            <span className={styles.title}>CHIP LIBRARY — {chips.length} CARTRIDGES</span>
          </header>
          <p className={styles.hint}>스크롤로 칩 돌리기 · 앞의 칩을 클릭해 삽입</p>
        </div>
      )}

      {/* detail chrome */}
      {mode === "detail" && activeChip && content && (
        <>
          <div className={styles.logo}>
            <strong>{activeChip.title}</strong>
            <span>{activeChip.kind === "series" ? "SERIES" : "ALTERNATE UNIVERSE"}</span>
          </div>

          {view === "menu" && mobile && (
            <aside className={styles.sheet}>
              <span className={styles.sheetKind}>
                {activeChip.kind === "series" ? "SERIES.CHIP" : "AU.CHIP"}
              </span>
              <h2 className={styles.sheetTitle}>{activeChip.title}</h2>
              <p className={styles.sheetBody}>
                {content.synopsis || activeChip.description || "등록된 시놉시스가 없습니다."}
              </p>
              <div className={styles.sheetTabs}>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.sheetTab}
                    onClick={() => onPickTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </aside>
          )}

          {view === "menu" && !mobile && (
            <aside className={styles.info}>
              <span className={styles.infoKind}>
                {activeChip.kind === "series" ? "SERIES.CHIP" : "AU.CHIP"} — NOW PLAYING
              </span>
              <h2 className={styles.infoTitle}>{activeChip.title}</h2>
              <div className={styles.infoBody}>
                {(content.synopsis || activeChip.description || "등록된 시놉시스가 없습니다.")
                  .split("\n")
                  .filter(Boolean)
                  .map((line) => (
                    <p key={line}>{line}</p>
                  ))}
              </div>
            </aside>
          )}

          {view === "zoom" && topHandle && (
            <div className={styles.zoomWrap} onClick={() => setView("menu")}>
              <div
                className={styles.zoomScreen}
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
                  if (el && topHandle.canvas.parentElement !== el) {
                    el.appendChild(topHandle.canvas);
                  }
                }}
              />
              {mobile && (
                <div className={styles.zoomTabs} onClick={(e) => e.stopPropagation()}>
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.zoomTab} ${tab === t.id ? styles.zoomTabOn : ""}`}
                      onClick={() => onPickTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.zoomTab}
                    onClick={() => setView("menu")}
                  >
                    닫기
                  </button>
                </div>
              )}
            </div>
          )}

          <p className={styles.dsHint}>
            {view === "zoom"
              ? mobile
                ? "위아래로 밀어 스크롤"
                : "휠: 스크롤 · 바깥 클릭 또는 B: 메뉴로"
              : mobile
                ? "아래 버튼으로 열람 · 닌텐도를 끌어 돌려볼 수 있어요"
                : "터치 화면에서 메뉴 선택 · 십자키/A/B 조작 가능 · 상단 화면 클릭: 닫기"}
          </p>

          <button type="button" className={styles.eject} onClick={requestClose}>
            ← EJECT
          </button>
        </>
      )}
    </div>
  );
}
