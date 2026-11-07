import { Chat } from "../components/Chat";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { Markdown } from "../components/Markdown";
import { splitFootnotes } from "../lib/content";
import { useJson } from "../lib/data";
import { pad2 } from "../lib/format";
import { Link } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { Chapter, StoryMeta, SubjectsFile } from "../lib/types";

/** § 02 Timeline — 챕터별 고정 번호 + 본문 + 장면 말풍선 + 관련 로그 */
export function Timeline() {
  const { pair, to } = useSite();
  useTitle(`Timeline — ${pair.name}`);
  const chapters = useJson<Chapter[]>(pairPath(pair, "timeline.json"), []);
  const stories = useJson<StoryMeta[]>(pairPath(pair, "stories.json"), []);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const storyOf = (id: string) => stories.find((s) => s.id === id);

  return (
    <div className="page timeline">
      <Header />
      <div className="tl-wrap">
        <div className="tl-head">
          <div className="tl-head-text">
            <h1 className="page-title">
              Timeline<sup>[{pad2(chapters.length)}]</sup>
            </h1>
            <span className="page-sub">{pair.abstractTitle}</span>
          </div>
        </div>

        {chapters.map((c, i) => {
          const numColor = c.major ? "var(--accent)" : "var(--fg)";
          const { body, notes } = splitFootnotes(c.body);
          return (
            <section key={c.id} id={c.id} className="tl-chapter" style={{ "--tl-dot": numColor } as React.CSSProperties}>
              <div className="tl-num-col">
                <div className="tl-sticky">
                  <span className="display tl-num" style={{ color: numColor }}>
                    {pad2(i)}
                  </span>
                  <span className="tl-meta mono">
                    <span className="tl-kind">{c.day}</span>
                  </span>
                </div>
              </div>
              <div aria-hidden="true" className="tl-axis desktop-only">
                <span className="tl-axis-line" />
                <span className="tl-axis-dot" style={{ background: numColor }} />
              </div>
              <div className="tl-body">
                <div className="tl-text">
                  <h2 className="tl-title">{c.title}</h2>
                  <Markdown md={body} className="body14" />
                  {notes.length ? (
                    <ol className="tl-notes muted">
                      {notes.map((n) => (
                        <li key={n.n} id={`fn-${n.n}`}>
                          {n.text}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
                {c.scenes.length ? (
                  <div className="tl-scenes">
                    {c.scenes.map((s) => (
                      <div key={s.no} className="tl-scene">
                        <span className="mono muted tl-scene-label">
                          SCENE {s.no}
                          {s.place ? ` · ${s.place}` : ""}
                        </span>
                        <Chat lines={s.lines} subjects={subjects} />
                      </div>
                    ))}
                  </div>
                ) : null}
                {c.stories.length ? (
                  <div className="tl-logs">
                    <span className="mono muted">Related story —</span>
                    {c.stories.map((id) => {
                      const s = storyOf(id);
                      return (
                        <Link key={id} to={to("story", id)}>
                          <span className="mono accent">{s ? `VOL. ${pad2(s.vol)}` : id}</span>
                          {s?.title ?? ""} <span aria-hidden="true">↗</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
