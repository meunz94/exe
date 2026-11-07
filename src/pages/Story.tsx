import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { useJson } from "../lib/data";
import { byVolAndPage, pad2 } from "../lib/format";
import { Link } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { StoryMeta, SubjectsFile } from "../lib/types";

/** § 03 Story — 논문 표지처럼 보이는 카드 목록 */
export function Story() {
  const { pair, to } = useSite();
  useTitle(`Story — ${pair.name}`);
  const raw = useJson<StoryMeta[]>(pairPath(pair, "stories.json"), []);
  // 1권부터 오름차순
  const stories = [...raw].sort(byVolAndPage);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });

  return (
    <div className="page story">
      <Header />
      <div className="st-wrap">
        <div className="st-head">
          <div className="tl-head-text">
            <h1 className="page-title">
              Story<sup>[{pad2(stories.length)}]</sup>
            </h1>
            <span className="page-sub">메인 서사방 로그 정리</span>
          </div>
          {/* 제목과 같은 줄, 화면 오른쪽 가장자리에 붙는 AU 배너: ANOTHER / UNIVERSE?  >>> */}
          <Link to={to("au")} className="st-au display" aria-label="AU 칩 라이브러리로">
            <span className="st-au-text">
              ANOTHER
              <br />
              UNIVERSE?
            </span>
            <span className="st-au-head" aria-hidden="true">
              &gt;&gt;&gt;
            </span>
          </Link>
        </div>
        <div className="st-grid">
          {stories.map((s) => (
            <Link key={s.id} to={to("story", s.id)} className="st-card">
              <span className="st-card-top mono muted">
                <span>VOL. {pad2(s.vol)}</span>
                <span>pp. {s.pages || "—"}</span>
              </span>
              <span className="st-card-mid">
                <span className="st-card-title display">{s.title}</span>
                <span className="muted st-authors">
                  {subjects.map((sub, j) => (
                    <span key={sub.id}>
                      {j > 0 ? ", " : ""}
                      {sub.name}
                      <sup>{j + 1}</sup>
                    </span>
                  ))}
                </span>
              </span>
              <span className="st-card-bottom">
                <span className="display st-abs-k">Abstract</span>
                <span className="st-abs">{s.abstract}</span>
              </span>
            </Link>
          ))}
        </div>
        {stories.length === 0 ? <p className="muted center-note">아직 등록된 스토리가 없어요.</p> : null}

      </div>
    </div>
  );
}

