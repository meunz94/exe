import { useEffect, useRef, useState } from "react";
import { Figure } from "../components/Figure";
import ThemeToggle from "../components/ThemeToggle";
import { useTitle } from "../components/Head";
import { MobileMenu, SECTIONS } from "../components/Header";
import { PairSwitch } from "../components/PairSwitch";
import { BgmPlayer } from "../components/BgmPlayer";
import { useJson } from "../lib/data";
import { useFeed } from "../lib/feed";
import { dayOf, isRecent, monthAbbr, pad2 } from "../lib/format";
import { Link } from "../lib/router";
import { playNavTick } from "../lib/click";
import { pairPath, useSite } from "../lib/site";
import type { SubjectsFile } from "../lib/types";

export function Landing() {
  const { pair, to, theme, toggleTheme } = useSite();
  useTitle(pair.name);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const feed = useFeed(pair, to);
  const [slide, setSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const lastWheel = useRef(0);

  const slides = pair.slides.length ? pair.slides : [{ left: "", right: "", caption: "" }];
  const go = (i: number) => setSlide(Math.max(0, Math.min(slides.length - 1, i)));

  // 로고의 * — 누르면 한 바퀴 돈다 (돌아가는 동안 다시 눌러도 무시)
  const [spin, setSpin] = useState(false);
  const starRef = useRef<HTMLElement>(null);
  // 글리프의 잉크 중심을 재서 회전축으로 삼는다 — 글자 상자 중심으로 돌리면 * 가 원을 그린다
  useEffect(() => {
    const el = starRef.current;
    if (!el) return;
    const apply = () => {
      const cs = getComputedStyle(el);
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText("*");
      const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
      const halfLeading = (lineH - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
      const baseline = halfLeading + m.fontBoundingBoxAscent;
      const cy = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      const cx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2; // 잉크 가로 중심 (원점 기준)
      el.style.transformOrigin = `${cx}px ${cy}px`;
    };
    apply();
    document.fonts?.ready.then(apply);
  }, [pair.id]);

  const touchY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const y0 = touchY.current;
    const y1 = e.changedTouches[0]?.clientY;
    touchY.current = null;
    if (y0 == null || y1 == null || Math.abs(y0 - y1) < 40) return;
    go(slide + (y0 > y1 ? 1 : -1));
  };

  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (Math.abs(e.deltaY) < 8 || now - lastWheel.current < 700) return;
    lastWheel.current = now;
    go(slide + (e.deltaY > 0 ? 1 : -1));
  };

  const a = subjects[0];
  const b = subjects[1];
  const latest = feed[0];
  const cap = slides[slide]?.caption ?? "";
  // 모바일에선 아래 제목을 마지막 단어 앞에서 줄바꿈한다 ("THIS IS" / "ME*"). 글자 크기는 가장 긴 줄 기준.
  const bottomWords = pair.titleBottom.trim().split(/\s+/);
  const bottomLast = bottomWords[bottomWords.length - 1];
  const bottomHead = bottomWords.slice(0, -1).join(" ");
  const bottomLen = Math.max(bottomHead.length, bottomLast.length + 1);

  return (
    <div
      className="landing"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ "--top-len": pair.titleTop.length, "--bottom-len": bottomLen } as React.CSSProperties}
    >
      {/* 좌상단 — 페어 이름 */}
      <Link to={to()} className="ld-brand display wide">
        {pair.name}
        <br />
        <span className="ld-tagline">{pair.tagline}</span>
      </Link>

      {/* 모바일 메뉴 버튼 */}
      <button type="button" className="ld-menu display mobile-only" onClick={() => setMenu(true)}>
        Menu
      </button>

      {/* 우상단 — 다른 페어로 (모바일은 메뉴 안) */}
      <PairSwitch className="desktop-only" />

      {/* 슬라이드 선택 바 */}
      {slides.length > 1 ? (
        <div role="group" aria-label="이미지 선택" className="ld-bars desktop-only">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`이미지 ${i + 1} 보기`}
              aria-current={i === slide ? "true" : undefined}
              onClick={() => go(i)}
            >
              <span style={{ width: i === slide ? 22 : 14, opacity: i === slide ? 1 : 0.3 }} />
            </button>
          ))}
        </div>
      ) : null}

      {/* 가운데 구성 */}
      <section aria-label="캐릭터" className="ld-stage">
        <div className="ld-comp">
          <span aria-hidden="true" className="ld-big ld-big-top display">
            {pair.titleTop}
          </span>

          {slides.map((s, i) => {
            // 한쪽에만 이미지가 있으면 2인 합본으로 보고 넓은 캡슐 하나를 가운데에 둔다
            const solo = !!s.left !== !!s.right ? s.left || s.right : "";
            return (
              <div
                key={i}
                aria-hidden={i !== slide}
                className={`ld-slide${solo ? " solo" : ""}`}
                style={{ opacity: i === slide ? 1 : 0, transform: `translateX(${solo ? "-50%" : "-46%"}) translateY(${i === slide ? 0 : i < slide ? -24 : 24}px)` }}
              >
                {solo ? (
                  <Figure src={solo} label="[이미지 — 2인]" width={400} height={500} className="ld-fig-solo" />
                ) : (
                  <>
                    <Figure src={s.left} label={a ? `[${a.name} · 투명 PNG]` : "[이미지 — 왼쪽]"} width={220} height={500} className="ld-fig-a" />
                    <Figure src={s.right} label={b ? `[${b.name} · 투명 PNG]` : "[이미지 — 오른쪽]"} width={196} height={450} alt className="ld-fig-b" />
                  </>
                )}
              </div>
            );
          })}

          <h1 aria-label={pair.name} className={`ld-big ld-big-bottom display${bottomHead ? " two-line" : ""}`}>
            {bottomHead ? <span className="ld-big-head">{bottomHead} </span> : null}
            {bottomLast}
            <sup
              ref={starRef}
              aria-hidden="true"
              className={`star${spin ? " spin" : ""}`}
              onClick={() => setSpin(true)}
              onAnimationEnd={() => setSpin(false)}
            >
              *
            </sup>
          </h1>

          {b ? (
            <span className="ld-label ld-label-b">
              {b.no} {b.label}
              <br />
              {b.name}
            </span>
          ) : null}
          {a ? (
            <span className="ld-label ld-label-a">
              {a.no} {a.label}
              <br />
              {a.name}
            </span>
          ) : null}

          <div className="ld-abstract">
            <div className="rule-label">
              <span>Abstract</span>
            </div>
            <p>
              <b>{pair.abstractTitle}</b>
              {pair.abstractSub ? (
                <>
                  <br />
                  <span className="muted">{pair.abstractSub}</span>
                </>
              ) : null}
            </p>
            {pair.synopsis ? <p className="muted ld-synopsis">{pair.synopsis}</p> : null}
          </div>
        </div>

        {/* 우측 메뉴 */}
        <nav aria-label="주요 메뉴" className="ld-nav display desktop-only">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={to(s.id)} onClick={playNavTick}>
              {s.label}
            </Link>
          ))}
        </nav>

        {/* 최근 글 */}
        <nav aria-label="최근 글" className="ld-recent">
          <span className="mono muted">recent —</span>
          {feed.slice(1, 4).map((f, i) => (
            <Link key={f.kind + f.id} to={f.to}>
              {f.title}
              {i === 0 && isRecent(f.date) ? <sup className="accent"> new</sup> : null}
            </Link>
          ))}
        </nav>
      </section>

      {/* 좌하단 — BGM */}
      <BgmPlayer />

      {/* 우하단 — LATEST */}
      <Link to={latest?.to ?? to("diary")} className="ld-latest">
        <span className="display ld-latest-k">LATEST</span>
        <span className="display ld-latest-title desktop-only">{latest?.title ?? "[최근 글 제목]"}</span>
        <span className="ld-latest-foot">
          <span className="ld-latest-arrow">↗</span>
          <span className="display ld-latest-date">
            <span className="mobile-only ld-latest-mtitle">{latest?.title ?? "[최근 글]"}<br /></span>
            {latest ? (
              <>
                {dayOf(latest.date)}
                <br className="desktop-only" />
                <span className="ld-latest-mon"> {monthAbbr(latest.date)}</span>
              </>
            ) : null}
          </span>
        </span>
      </Link>

      {/* 캡션 */}
      {cap ? (
        <div className="ld-cap mono muted desktop-only">
          Fig. {pad2(slide + 1)} — {cap}
        </div>
      ) : null}

      <ThemeToggle theme={theme} onToggle={toggleTheme} className="ld-theme desktop-only" />


      {menu ? <MobileMenu onClose={() => setMenu(false)} /> : null}
    </div>
  );
}
