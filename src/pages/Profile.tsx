import { Figure } from "../components/Figure";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { useJson } from "../lib/data";
import { Link } from "../lib/router";
import { pairPath, useSite, useSubjectColors } from "../lib/site";
import type { SubjectsFile } from "../lib/types";

/** § 01 Profile — 두 인물 카드 + 가운데 Relation / Address */
export function Profile() {
  const { pair, to } = useSite();
  useTitle(`Profile — ${pair.name}`);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const [a, b] = subjects;
  const colors = useSubjectColors(subjects);
  // 스펙의 HEIGHT(cm) 로 키 차이를 그림 크기에 반영 — 가장 큰 인물이 1, 나머지는 비율(0.75 이상)
  const heightOf = (s: SubjectsFile["subjects"][number]) => {
    const v = s.specs.find((x) => /height|키/i.test(x.k))?.v ?? "";
    const n = parseFloat(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const tallest = Math.max(...subjects.map((s) => heightOf(s) ?? 0));
  const scaleOf = (s: SubjectsFile["subjects"][number]) => {
    const h = heightOf(s);
    return h && tallest && s.image ? Math.max(0.75, h / tallest) : 1;
  };

  return (
    <div className="page profile">
      <Header />
      <section className="pf-grid">
        {subjects.slice(0, 2).map((s, i) => (
          <Link key={s.id} to={to("profile", s.id)} aria-label={`${s.name} 프로필 보기`} className={`pf-col ${i === 0 ? "a" : "b"}`}>
            {/* 한자·한글·가나는 세로쓰기에서 글자가 바로 서므로 돌리지 않는다 (돌리면 거꾸로 뒤집힌다) */}
            <span aria-hidden="true" className={`pf-big display${/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(s.big) ? " cjk" : ""}`}>
              {s.big}
            </span>
            <Figure
              src={s.image}
              label={`[${s.name} · 투명 PNG]`}
              width={240}
              height={Math.round(720 * scaleOf(s))}
              alt={i === 0}
              labelAt="top"
              className="pf-fig"
              style={{ "--fig-scale": scaleOf(s) } as React.CSSProperties}
            />
            <span className="pf-card">
              <span className="pf-card-head">
                <span className="pf-card-name display narrow">
                  {s.name}
                  <span className="accent">.</span>
                </span>
                <span className="pf-card-no display accent">{s.no}</span>
              </span>
              <span className="muted pf-card-role">{s.role}</span>
              <span className="pf-specs">
                {s.specs.slice(0, 3).map((sp) => (
                  <span key={sp.k}>
                    <span className="mono muted">{sp.k}</span>
                    <span className="pf-spec-line" />
                    {sp.v}
                  </span>
                ))}
              </span>
              <span className="pf-card-cta">
                <span>View profile</span>
                <span aria-hidden="true">↗</span>
              </span>
            </span>
          </Link>
        ))}

        <div className="pf-mid">
          <div className="pf-block">
            <div className="rule-label">
              <span>Relation</span>
            </div>
            <div className="pf-keywords">
              {pair.relation.keywords.map((k) => (
                <span key={k} className="tag">
                  {k}
                </span>
              ))}
            </div>
            <p className="muted pf-rel-text">{pair.relation.text}</p>
          </div>
          {a && b ? (
            <div className="pf-block">
              <div className="rule-label">
                <span>Address</span>
              </div>
              <div className="pf-addr">
                <span className="mono" style={{ color: colors[0] }}>
                  {a.big.toUpperCase()} → {b.big.toUpperCase()}
                </span>
                <span className="pf-call">“{a.call}”</span>
              </div>
              <div className="pf-addr right">
                <span className="mono" style={{ color: colors[1] }}>
                  {b.big.toUpperCase()} → {a.big.toUpperCase()}
                </span>
                <span className="pf-call">“{b.call}”</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
