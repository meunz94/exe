import { useMemo } from "react";
import { CommentThreads } from "../components/Comments";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { Markdown } from "../components/Markdown";
import { splitFootnotes } from "../lib/content";
import { stripFrontmatter, useJson, useText } from "../lib/data";
import { koreanDate, pad2, parseDate, shortDate, weekdayAbbr } from "../lib/format";
import { Link, useRouter } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { Comment, DiaryMeta } from "../lib/types";

/** § 05 Diary — 하루 단위로 읽는 일기. 같은 날 여러 편이면 아래로 이어지고, 이전/다음은 다른 날짜로 넘어간다 */
export function Diary({ id }: { id: string }) {
  const { pair, site, to } = useSite();
  const { navigate } = useRouter();
  const entries = useJson<DiaryMeta[]>(pairPath(pair, "diary.json"), []);
  const comments = useJson<Comment[]>("comments.json", []);

  // 날짜별 묶음 (목록은 최신순이므로 묶음도 최신 날짜부터)
  const days = useMemo(() => {
    const map = new Map<string, DiaryMeta[]>();
    for (const e of entries) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    return [...map.entries()].map(([date, list]) => ({ date, list: [...list].sort((a, b) => a.no - b.no) }));
  }, [entries]);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  // 주소에 글이 없으면 오늘 날짜를 먼저 보여준다. 오늘 일기가 없으면 빈 오늘 페이지(달력·이전 날짜 이동은 그대로)
  const picked = id ? entries.find((e) => e.id === id || String(e.no) === id) : undefined;
  const virtualToday = { date: todayKey, list: [] as DiaryMeta[] };
  const dayIdx = picked ? days.findIndex((d) => d.date === picked.date) : days.findIndex((d) => d.date === todayKey);
  const day = dayIdx >= 0 ? days[dayIdx] : id ? undefined : virtualToday;
  const first = day?.list[0];
  useTitle(`${first ? `${shortDate(first.date)} ${first.title}` : "Diary"} — ${pair.name}`);
  const aiOn = site.aiBoards.includes("diary");

  // 달력: 이 날의 달. 글이 있는 날은 진하게, 이 날은 강조색
  const d = day ? parseDate(day.date) : null;
  const cal = useMemo(() => {
    if (!d) return { lead: 0, days: 0, byDay: new Map<number, DiaryMeta>() };
    const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const byDay = new Map<number, DiaryMeta>();
    for (const x of entries) {
      const xd = parseDate(x.date);
      if (xd && xd.getFullYear() === d.getFullYear() && xd.getMonth() === d.getMonth() && !byDay.has(xd.getDate())) byDay.set(xd.getDate(), x);
    }
    return { lead: (firstOfMonth.getDay() + 6) % 7, days: n, byDay };
  }, [d, entries]);

  // 이전 = 더 오래된 날짜(idx+1), 다음 = 더 최근 날짜(idx-1). 빈 오늘 페이지면 오늘보다 오래된 첫 날짜가 이전
  const prev = dayIdx >= 0 ? days[dayIdx + 1] : days.find((x) => x.date < todayKey);
  const next = dayIdx >= 0 ? days[dayIdx - 1] : undefined;
  const dayLabel = (x: { date: string; list: DiaryMeta[] }) => `${shortDate(x.date)}${x.list.length > 1 ? ` (${x.list.length})` : ""}`;

  if (!day) {
    return (
      <div className="page diary">
        <Header />
        <p className="muted center-note">아직 일기가 없어요.</p>
      </div>
    );
  }

  const wd = weekdayAbbr(day.date);
  const yy = d ? d.getFullYear() : "";
  const mm = d ? pad2(d.getMonth() + 1) : "";
  const dd = d ? pad2(d.getDate()) : "";

  return (
    <div className="page diary">
      <Header />
      <div className="dy-wrap">
        <aside className="dy-side">
          <div role="text" aria-label={koreanDate(day.date)} className="dy-date">
            <span aria-hidden="true" className="mono muted dy-year">
              {yy}
            </span>
            <span aria-hidden="true" className="dy-date-row">
              <span className="display dy-day">
                {mm}
                <span className="accent">.</span>
                {dd}
              </span>
              <span className="display dy-wd accent">
                {wd.split("").map((ch, i) => (
                  <span key={i}>{ch}</span>
                ))}
              </span>
            </span>
          </div>
          <div aria-hidden="true" className="dy-cal mono">
            {Array.from({ length: cal.lead }, (_, i) => (
              <span key={`l${i}`} />
            ))}
            {Array.from({ length: cal.days }, (_, i) => {
              const n = i + 1;
              // 오늘은 강조색, 일기가 있는 날은 글자색(라이트 검정 · 다크 흰색), 나머지는 흐리게
              const isToday = !!d && today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth() && today.getDate() === n;
              const target = cal.byDay.get(n);
              return (
                <span
                  key={n}
                  style={{ color: isToday ? "var(--accent)" : target ? "var(--fg)" : "var(--muted)", fontWeight: isToday || target ? 600 : 400, cursor: target || isToday ? "pointer" : "default" }}
                  // 오늘은 일기가 없어도 오늘 페이지로 간다
                  onClick={() => (target ? navigate(to("diary", target.id)) : isToday ? navigate(to("diary")) : undefined)}
                >
                  {n}
                </span>
              );
            })}
          </div>
          <div className="dy-nav desktop-only">
            {prev ? (
              <Link to={to("diary", prev.list[0].id)} className="muted">
                ← {dayLabel(prev)} {prev.list[0].title}
              </Link>
            ) : null}
            {next ? (
              <Link to={to("diary", next.list[0].id)} className="muted">
                {dayLabel(next)} {next.list[0].title} →
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="dy-main">
          {day.list.length ? (
            day.list.map((e) => <Entry key={e.id} e={e} pairId={pair.id} comments={comments} aiOn={aiOn} />)
          ) : (
            <p className="muted dy-none">오늘은 일기가 없어요.</p>
          )}
        </div>

        <div className="dy-nav mobile-only">
          {prev ? (
            <Link to={to("diary", prev.list[0].id)} className="muted">
              ← {dayLabel(prev)}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={to("diary", next.list[0].id)} className="muted">
              {dayLabel(next)} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 일기 한 편 — 본문 + 옆 여백의 코멘트 */
function Entry({ e, pairId, comments, aiOn }: { e: DiaryMeta; pairId: string; comments: Comment[]; aiOn: boolean }) {
  const raw = useText(`${pairId}/${e.path}`);
  const { body } = useMemo(() => splitFootnotes(stripFrontmatter(raw ?? "")), [raw]);
  const mine = useMemo(() => comments.filter((c) => c.target === "diary" && c.targetId === e.id && (!c.pair || c.pair === pairId)), [comments, e.id, pairId]);
  return (
    <section className="dy-entry" id={e.id}>
      <article className="dy-article">
        <div className="dy-article-head">
          <span className="mono muted dy-no">No. {pad2(e.no)}</span>
          <h1 className="dy-title">{e.title}</h1>
          {e.author ? <span className="accent dy-author">({e.author})</span> : null}
        </div>
        {raw === null ? null : <Markdown md={body} className="body14" />}
      </article>
      <aside aria-label="AI 코멘트" className="dy-comments">
        {mine.length ? <CommentThreads comments={mine} /> : aiOn ? <span className="mono muted dy-empty">— No comment</span> : null}
      </aside>
    </section>
  );
}
