import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { BgmPlayer } from "./BgmPlayer";
import { createPortal } from "react-dom";
import { Link, useRouter } from "../lib/router";
import { useSite } from "../lib/site";
import { PairSwitch } from "./PairSwitch";
import { playNavTick } from "../lib/click";

export const SECTIONS: { id: string; label: string; ko: string }[] = [
  { id: "profile", label: "Profile", ko: "프로필" },
  { id: "timeline", label: "Timeline", ko: "타임라인" },
  { id: "story", label: "Story", ko: "스토리" },
  { id: "log", label: "Log", ko: "로그" },
  { id: "diary", label: "Diary", ko: "일기장" },
  { id: "gallery", label: "Gallery", ko: "갤러리" },
  { id: "links", label: "Links", ko: "이웃 · 방명록" },
];

export function sectionNo(id: string): string {
  const i = SECTIONS.findIndex((s) => s.id === id);
  return String(i + 1).padStart(2, "0");
}

/**
 * 섹션 페이지 상단 바. 왼쪽 페어 이름, 가운데 메뉴(현재 섹션에 점), 오른쪽은
 * "§ 01" 같은 섹션 번호 또는 "← Log" 같은 뒤로가기.
 * 모바일에선 메뉴가 Menu 버튼 → 전체 화면 목록으로 바뀐다.
 */
export function Header({ right, back }: { right?: React.ReactNode; back?: { to: string; label: string } }) {
  const { pair, to, theme, toggleTheme } = useSite();
  const { route, back: goBack } = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="hdr">
        <span className="hdr-brand-wrap">
          <Link to={to()} className="hdr-brand display wide">
            {pair.name}
          </Link>
          {back ? (
            <Link
              to={back.to}
              className="hdr-back mono"
              onClick={(e) => {
                // 보던 목록(페이지·필터·스크롤)으로 돌아간다. 직접 링크로 들어왔으면 목록 첫 화면
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                goBack(back.to);
              }}
            >
              ← {back.label}
            </Link>
          ) : null}
        </span>
        <nav aria-label="주요 메뉴" className="hdr-nav desktop-only">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={to(s.id)} aria-current={route.section === s.id ? "page" : undefined} onClick={playNavTick}>
              {s.label}
              <span className="hdr-dot" />
            </Link>
          ))}
        </nav>
        <span className="hdr-right desktop-only">
          {right ?? null}
          <BgmPlayer compact />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </span>
        <button type="button" className="hdr-menu display mobile-only" onClick={() => setOpen(true)}>
          Menu
        </button>
      </header>
      {open ? <MobileMenu onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function MobileMenu({ onClose }: { onClose: () => void }) {
  const { pair, to, theme, toggleTheme } = useSite();
  const { route } = useRouter();
  // 페이지 전환 애니메이션(transform)이 걸린 조상 안에서는 fixed 가 뷰포트 기준이 아니게 되므로 body 로 꺼낸다.
  // body 는 .app 바깥이라 페어 강조색을 직접 넘겨준다.
  const accent = theme === "dark" ? pair.accentDark : pair.accent;
  return createPortal(
    <div className="mmenu" role="dialog" aria-label="메뉴" style={{ "--accent": accent } as React.CSSProperties}>
      <header className="mmenu-head">
        <span className="mmenu-tools">
          <ThemeToggle theme={theme} onToggle={toggleTheme} className="mmenu-theme" />
          <BgmPlayer compact />
        </span>
        <button type="button" className="mmenu-close display" onClick={onClose}>
          Close <span>×</span>
        </button>
      </header>
      <h1 className="mmenu-title display wide">
        {pair.abstractTitle}
        <span className="accent">.</span>
      </h1>
      <nav aria-label="주요 메뉴" className="mmenu-nav">
        {SECTIONS.map((s, i) => {
          const cur = route.section === s.id;
          return (
            <Link
              key={s.id}
              to={to(s.id)}
              onClick={() => {
                playNavTick();
                onClose();
              }}
            >
              <span className="mono" style={{ color: cur ? "var(--accent)" : "var(--muted)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mmenu-label display wide">
                {s.label}
                {cur ? <span className="accent">.</span> : null}
              </span>
              <span className="mmenu-ko muted">{s.ko}</span>
            </Link>
          );
        })}
      </nav>
      <PairSwitch className="mmenu-pair" onClick={onClose} />
    </div>,
    document.body,
  );
}
