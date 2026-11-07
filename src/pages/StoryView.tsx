import { useMemo } from "react";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { Markdown } from "../components/Markdown";
import { splitFootnotes } from "../lib/content";
import { stripFrontmatter, useJson, useText } from "../lib/data";
import { byVolAndPage, pad2 } from "../lib/format";
import { Link } from "../lib/router";
import { pairPath, useSite, useSubjectColors } from "../lib/site";
import type { Chapter, StoryMeta, SubjectsFile } from "../lib/types";

/** § 03 Story — 뷰어 (논문 레이아웃) */
export function StoryView({ id }: { id: string }) {
  const { pair, to } = useSite();
  const list = useJson<StoryMeta[]>(pairPath(pair, "stories.json"), []);
  const stories = [...list].sort(byVolAndPage);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const chapters = useJson<Chapter[]>(pairPath(pair, "timeline.json"), []);
  const idx = stories.findIndex((s) => s.id === id);
  const s = stories[idx];
  const chapterIdx = s?.chapter ? chapters.findIndex((c) => c.id === s.chapter) : -1;
  const raw = useText(s ? `${pair.id}/${s.path}` : null);
  useTitle(`${s?.title ?? "Story"} — ${pair.name}`);
  const { body, notes } = useMemo(() => splitFootnotes(stripFrontmatter(raw ?? "")), [raw]);
  // 목록은 1권부터 오름차순 — "이전 스토리" = 앞 권
  const prev = stories[idx - 1];
  const speakers: [string, string] = [subjects[0]?.name ?? "", subjects[1]?.name ?? ""];
  const speakerColors = useSubjectColors(subjects);

  return (
    <div className="page story-view">
      <Header back={{ to: to("story"), label: "Story" }} />
      {s ? (
        <article className="sv">
          <div className="sv-head">
            <span className="mono muted sv-vol">
              {pair.name} · VOL. {pad2(s.vol)}
              {s.pages ? ` · pp. ${s.pages}` : ""}
            </span>
            <h1 className="display sv-title">{s.title}</h1>
            <span className="sv-authors">
              {subjects.map((sub, j) => (
                <span key={sub.id}>
                  {j > 0 ? ", " : ""}
                  {sub.name}
                  <sup className="accent">{j + 1}</sup>
                </span>
              ))}
            </span>
            <span className="muted sv-affil">
              {s.affiliations.map((a, j) => (
                <span key={j}>
                  <sup>{j + 1}</sup>
                  {a}{"  "}
                </span>
              ))}
            </span>
          </div>

          <div className="sv-abstract">
            <span aria-hidden="true" className="sv-abs-rule" />
            <div>
              <span className="display sv-abs-k">Abstract</span>
              <p>{s.abstract}</p>
            </div>
          </div>

          {raw === null ? null : <Markdown md={body} speakers={speakers} speakerColors={speakerColors} />}

          <div aria-hidden="true" className="dots">
            ···
          </div>

          {notes.length ? (
            <ol className="sv-notes muted">
              {notes.map((n) => (
                <li key={n.n} id={`fn-${n.n}`}>
                  {n.text}
                </li>
              ))}
            </ol>
          ) : null}

          <nav aria-label="이전·다음" className="sv-nav">
            {prev ? (
              <Link to={to("story", prev.id)}>
                <span className="mono muted">← VOL. {pad2(prev.vol)}</span>
                {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {chapterIdx >= 0 ? (
              <Link to={`${to("timeline")}#${s.chapter}`} className="right">
                <span className="mono muted">TIMELINE {pad2(chapterIdx)} ↗</span>
                {chapters[chapterIdx]?.title ?? ""}
              </Link>
            ) : null}
          </nav>
        </article>
      ) : null}
    </div>
  );
}
