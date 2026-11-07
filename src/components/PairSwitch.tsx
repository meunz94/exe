import { Link, withPair } from "../lib/router";
import { nextPair, useSite } from "../lib/site";
import { usePairRipple } from "./PairRipple";

/** 다른 페어로 넘어가는 카드 — 랜딩 우상단(데스크톱)과 모바일 메뉴 하단에서 같이 쓴다. 페어가 하나면 안 그린다. */
export function PairSwitch({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  const { site, pairs, pair, theme } = useSite();
  const { switchPair } = usePairRipple();
  const other = nextPair(pairs, pair);
  if (!other) return null;
  const prefix = other.id === site.defaultPair ? "" : other.id;
  const to = withPair(prefix);
  const color = theme === "dark" ? other.accentDark : other.accent;
  return (
    <Link
      to={to}
      className={`pair-sw ${className}`}
      aria-label={`다른 페어 페이지로 이동: ${other.name}`}
      onClick={(e) => {
        onClick?.();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        // 누른 지점(키보드면 카드 가운데)에서 파동이 번진다
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX || r.left + r.width / 2;
        const y = e.clientY || r.top + r.height / 2;
        switchPair(to, { x, y });
      }}
    >
      <span className="pair-sw-text">
        <span className="pair-sw-name display wide">
          {other.name}
          <span className="pair-sw-star" style={{ color }}>
            *
          </span>
        </span>
        <span className="pair-sw-sub">
          <span className="muted">{other.subjectsLine}</span>
          <span className="pair-sw-arrow" aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}
