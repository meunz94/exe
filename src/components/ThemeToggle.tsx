import type { ThemeOrigin } from "../lib/theme";

/** 라이트/다크 전환 스위치 — PC 헤더·모바일 메뉴 공용. 누른 스위치 가운데를 새 테마가 번져 나오는 기준점으로 넘긴다 */
export default function ThemeToggle({ theme, onToggle, className = "" }: { theme: "light" | "dark"; onToggle: (origin?: ThemeOrigin) => void; className?: string }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="다크 모드"
      className={`theme-toggle mono ${className}`.trim()}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onToggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-knob" />
      </span>
    </button>
  );
}
