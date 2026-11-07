import { useState } from "react";
import { Figure } from "../components/Figure";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { Markdown } from "../components/Markdown";
import { useJson } from "../lib/data";
import { useRouter } from "../lib/router";
import { pairPath, useSite, useSubjectColors } from "../lib/site";
import type { Person, SubjectsFile } from "../lib/types";
import { publicUrl } from "../lib/url";

/** § 01 Profile — 캐릭터 상세. 탭(외형/성격/능력/백스토리) · 대사 말풍선 · 스펙 · 주변 인물 */
export function SubjectPage({ id }: { id: string }) {
  const { pair, to } = useSite();
  const { navigate } = useRouter();
  const { subjects, people } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const colors = useSubjectColors(subjects);
  const idx = Math.max(0, subjects.findIndex((s) => s.id === id));
  const cur = subjects[idx];
  const [q, setQ] = useState(0);
  const [tab, setTab] = useState(0);
  const [p, setP] = useState<number | null>(null);
  useTitle(`${cur?.name ?? "Profile"} — ${pair.name}`);

  if (!cur) return <div className="page"><Header back={{ to: to("profile"), label: "Pair" }} /></div>;

  // 스펙 맨 위에 NAME 칸 — 노션 스펙에 NAME 을 직접 적으면 그 값을, 없으면 이름을 쓴다
  const specs = cur.specs.some((x) => /^name$|^이름$/i.test(x.k.trim())) ? cur.specs : [{ k: "NAME", v: cur.name }, ...cur.specs];
  const sets = cur.quotes.length ? cur.quotes : [["[대사]"]];
  const lines = sets[q % sets.length];
  const sec = cur.sections[tab] ?? cur.sections[0];
  const withKey = idx === 0 ? "A" : "B";
  const mine = people.filter((x) => x.with === withKey);
  const open: Person | null = p !== null ? mine[p] ?? null : null;
  const tagOf = (x: Person) => x.relation;
  const tagColor = (x: Person) => colors[x.with === "B" ? 1 : 0];
  // 상대가 이 인물을 부르는 말 — A 페이지에는 "B → A" 와 B 의 호칭
  const other = subjects.length > 1 ? subjects[idx === 0 ? 1 : 0] : null;
  const rel = other ? `${other.big.toUpperCase()} → ${cur.big.toUpperCase()}` : "";

  return (
    <div className="page subject">
      <Header back={{ to: to("profile"), label: "Pair" }} />
      <section className="sj-grid">
        {/* 왼쪽 — 탭 + 이름 */}
        <div className="sj-left">
          <div className="sj-tabs-wrap">
            <div role="tablist" aria-label="항목" className="dot-tabs sj-tabs">
              {cur.sections.map((s, i) => (
                <button key={s.no} type="button" role="tab" aria-selected={i === tab} className="dot-tab sans" onClick={() => setTab(i)}>
                  {s.ko}
                </button>
              ))}
            </div>
            {sec ? (
              <div role="tabpanel" className="sj-panel">
                <span aria-hidden="true" className="vrule" />
                <div className="sj-panel-body">
                  <span className="display sj-sec-title">
                    <span className="mono muted">{sec.no}</span>  {sec.en}
                  </span>
                  <Markdown md={sec.md} className="small" />
                </div>
              </div>
            ) : null}
          </div>
          <div className="sj-name">
            <span className="muted">{cur.role}</span>
            <h1 className="display narrow sj-h1">
              {cur.name}
              <span className="accent">.</span>
            </h1>
            {cur.keywords?.length ? (
              <span className="sj-keys">
                {cur.keywords.map((k) => (
                  <span key={k} className="sj-key display">
                    {k}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        </div>

        {/* 가운데 — 인물 + 말풍선 */}
        <div className="sj-center">
          <div className="sj-fig-wrap">
            <button type="button" aria-label={`${cur.name}에게 말 걸기`} className="sj-fig-btn" onClick={() => setQ((q + 1) % sets.length)}>
              <Figure src={cur.image} label={`[${cur.name} · 투명 PNG]`} width={260} height={600} radius={130} ground={false} />
            </button>
            <span aria-hidden="true" className="figure-ground" style={{ width: 210, height: 16, marginTop: 6 }} />
            <div role="log" aria-live="polite" className="sj-bubbles">
              {lines.map((t, i) => (
                // key 에 q 를 넣어 대사가 바뀔 때마다 새로 올라오게 한다
                <span key={`${q}-${i}`} className={`bubble left sj-bubble ${i === lines.length - 1 ? "last" : ""}`} style={{ maxWidth: "100%", fontSize: 14, animationDelay: `${i * 120}ms` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div role="group" aria-label="캐릭터 선택" className="sj-dots">
            {subjects.map((s, i) => (
              <button key={s.id} type="button" aria-label={`${s.name} 보기`} onClick={() => navigate(to("profile", s.id))}>
                <span className={i === idx ? "on" : ""} />
              </button>
            ))}
          </div>
        </div>

        {/* 오른쪽 — 스펙 + 호칭 + 주변 인물 */}
        <div className="sj-right">
          <div className="sj-right-top">
            <dl className="sj-specs">
              {specs.map((s) => (
                <div key={s.k}>
                  <dt className="tag" style={{ padding: "1px 5px", fontSize: 10 }}>
                    {s.k}
                  </dt>
                  <dd>{s.v}</dd>
                </div>
              ))}
            </dl>
            {rel ? (
              <div className="sj-call">
                <span className="mono muted">{rel}</span>
                <span>“{other?.call}”</span>
              </div>
            ) : null}
          </div>

          <section aria-label="주변 인물" className="sj-people">
            {open ? (
              <div className="sj-person-card">
                <span className="sj-person-head">
                  <span>{open.name}</span>
                  <button type="button" aria-label="닫기" onClick={() => setP(null)}>
                    ×
                  </button>
                </span>
                <span className="mono" style={{ fontSize: 9, color: tagColor(open) }}>
                  {tagOf(open)}
                </span>
                <Markdown md={open.md} className="small" />
              </div>
            ) : null}
            <span className="mono muted">Associates — {String(mine.length).padStart(2, "0")}</span>
            <div className="sj-people-row">
              {mine.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  aria-label={`${x.name} 자세히 보기`}
                  aria-expanded={i === p}
                  onClick={() => setP(i === p ? null : i)}
                  className="sj-avatar"
                  style={{ borderColor: i === p ? "var(--fg)" : "transparent" }}
                >
                  {x.image ? <img src={publicUrl(x.image)} alt="" /> : null}
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* 모바일 — 전체 섹션 펼침 */}
        <div className="sj-sections-m mobile-only">
          {cur.sections.map((s) => (
            <article key={s.no} className="sj-section-m">
              <span aria-hidden="true" className="vrule" />
              <div>
                <h2 className="sj-section-h">
                  <span className="mono muted">{s.no}</span>
                  <span className="display">{s.en}</span>
                  <span className="muted">{s.ko}</span>
                </h2>
                <Markdown md={s.md} className="body14" />
              </div>
            </article>
          ))}
        </div>

        {/* 모바일 — 인물 목록 */}
        <section aria-label="주변 인물" className="sj-people-m mobile-only">
          <h2 className="display sj-people-title">
            Associates<sup>[{String(mine.length).padStart(2, "0")}]</sup>
          </h2>
          {mine.map((x) => (
            <div key={x.id} className="sj-person-row">
              <span className="sj-avatar static">{x.image ? <img src={publicUrl(x.image)} alt="" /> : null}</span>
              <span className="sj-person-text">
                <span className="sj-person-name">{x.name}</span>
                <span className="mono" style={{ fontSize: 9, color: tagColor(x) }}>
                  {tagOf(x)}
                </span>
                <Markdown md={x.md} className="small" />
              </span>
            </div>
          ))}
        </section>
      </section>
    </div>
  );
}
