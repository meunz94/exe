import { useEffect, useMemo, useState } from "react";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { useJson } from "../lib/data";
import { dotDate, pad2, shortDate } from "../lib/format";
import { Link, useRouter } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { LogMeta, SubjectsFile } from "../lib/types";
import { publicUrl } from "../lib/url";

const PER_PAGE = 12;

/** § 04 Log — 라벨 그리드 (사진 라벨은 두 칸) · 검색 · 구분(ORIGINAL/AU) 필터 · 페이지 */
export function Log() {
  const { pair, to } = useSite();
  const { navigate } = useRouter();
  useTitle(`Log — ${pair.name}`);
  const logs = useJson<LogMeta[]>(pairPath(pair, "logs.json"), []);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const [filter, setFilter] = useState<"all" | "ORIGINAL" | "AU">("all");
  const [q, setQ] = useState("");
  const params = new URLSearchParams(window.location.search);
  const page = Math.max(1, Number(params.get("p") ?? 1));

  const codeOf = (k: LogMeta["kind"]) => (k === "AU" ? "AU" : "OR");

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return logs
      .filter((l) => filter === "all" || l.kind === filter)
      .filter((l) => !needle || `${l.title} ${l.subtitle} ${l.tags.join(" ")} ${l.excerpt} ${l.kind}`.toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, filter, q, subjects]);

  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const shown = items.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  useEffect(() => {
    if (page !== 1 && (q || filter !== "all")) navigate(to("log"), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  const filters: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "ORIGINAL", label: "ORIGINAL" },
    { id: "AU", label: "AU" },
  ];

  const total = logs.length;

  return (
    <div className="page log">
      <Header />
      <div className="lg-wrap">
        <div className="lg-head">
          <div className="tl-head-text">
            <h1 className="page-title">
              Log<sup>[{total}]</sup>
            </h1>
            <span className="page-sub">단문 로그 백업</span>
          </div>
          <div className="lg-tools">
            <div className="lg-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <label htmlFor="log-q" className="sr-only">
                로그 검색
              </label>
              <input id="log-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목, 대사, 태그로 검색" />
              <span className="mono muted">{pad2(items.length)}</span>
            </div>
            <div role="group" aria-label="구분" className="dot-tabs">
              {filters.map((f) => (
                <button key={f.id} type="button" className="dot-tab" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg-grid">
          {shown.map((l) => (
            <Link
              key={l.id}
              to={to("log", l.id)}
              aria-label={`No.${l.no} ${l.title}`}
              className={`lbl ${l.photo ? "tall" : ""}`}
            >
              <span className="lbl-no display">No. {l.no}</span>
              <span className="lbl-meta mono muted">
                <span className="desktop-only">{dotDate(l.date)}</span>
                <span className="mobile-only">{shortDate(l.date)}</span>
                <span>{l.kind}</span>
              </span>
              {l.photo ? (
                <span className="lbl-photo">
                  {l.photo === "placeholder" ? <span className="lbl-photo-ph mono">[로그 사진 · 흑백 크롭]</span> : <img src={publicUrl(l.photo)} alt="" loading="lazy" />}
                  <span aria-hidden="true" className="lbl-corner tl" />
                  <span aria-hidden="true" className="lbl-corner br" />
                  <span className="lbl-fig mono">FIG. 1</span>
                </span>
              ) : null}
              <span className="lbl-title">{l.title}</span>
              <span className="lbl-notes">
                <span className="mono lbl-notes-k">{l.locked ? "LOCKED" : "NOTES"}</span>
                <span className="lbl-excerpt muted" style={{ WebkitLineClamp: l.photo ? 4 : 2 }}>
                  {l.locked ? "비밀번호가 있어야 읽을 수 있는 글이에요." : l.subtitle || l.excerpt}
                </span>
                {l.photo && l.quote?.who ? (
                  <span className="lbl-quote desktop-only">
                    <span className="display">{l.quote.who.toUpperCase()}</span>
                    <span>{l.quote.text}</span>
                  </span>
                ) : null}
              </span>
              <span className="lbl-foot mono">
                <span className="lbl-tags">{l.tags.map((t) => `#${t}`).join(" ")}</span>
                <span className="muted desktop-only">
                  {pair.code}-{l.no}-{codeOf(l.kind)}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {items.length === 0 ? <p className="muted center-note">검색 결과가 없어요.</p> : null}

        {pages > 1 ? (
          <nav aria-label="페이지" className="lg-pages mono">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} to={`${to("log")}${n === 1 ? "" : `?p=${n}`}`} aria-current={n === cur ? "page" : undefined} className={n === cur ? "on" : "muted"}>
                {pad2(n)}
                {n === cur ? <span className="lg-page-dot" /> : null}
              </Link>
            ))}
            {cur < pages ? <Link to={`${to("log")}?p=${cur + 1}`}>→</Link> : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
