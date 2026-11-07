import { useEffect, useState } from "react";
import { Blocks } from "../components/Blocks";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { stripFrontmatter, useJson, useText } from "../lib/data";
import { dotDate } from "../lib/format";
import { decryptText, recallPassword, rememberPassword } from "../lib/lock";
import { Link } from "../lib/router";
import { pairPath, useSite } from "../lib/site";
import type { LogMeta, SubjectsFile } from "../lib/types";
import { publicUrl } from "../lib/url";

/** § 04 Log — 뷰어 (사진 유무에 따라 figure 생략) */
export function LogView({ id }: { id: string }) {
  const { pair, to } = useSite();
  const logs = useJson<LogMeta[]>(pairPath(pair, "logs.json"), []);
  const { subjects } = useJson<SubjectsFile>(pairPath(pair, "subjects.json"), { subjects: [], people: [] });
  const idx = logs.findIndex((l) => l.id === id || String(l.no) === id);
  const l = logs[idx];
  const raw = useText(l && !l.locked ? `${pair.id}/${l.path}` : null);
  useTitle(`${l ? `No.${l.no} ${l.title}` : "Log"} — ${pair.name}`);
  // 목록은 번호 내림차순: 이전 = 더 작은 번호(idx+1), 다음 = 더 큰 번호(idx-1)
  const prev = logs[idx + 1];
  const next = logs[idx - 1];
  const tags = l ? l.tags.map((t) => `#${t}`).join(" ") : "";
  const meta = l ? [dotDate(l.date), l.kind, tags].filter(Boolean).join(" · ") : "";

  return (
    <div className="page log-view">
      <Header back={{ to: to("log"), label: "Log" }} />
      {l ? (
        <article className="lv">
          <div className="lv-head">
            <span className="display lv-no" style={{ color: l.photo ? "var(--accent)" : "var(--fg)" }}>
              {l.no}
            </span>
            <div className="lv-head-text">
              <h1 className="lv-title">{l.title}</h1>
              {l.subtitle ? <span className="lv-subtitle muted">{l.subtitle}</span> : null}
              <span className="mono muted">{meta}</span>
            </div>
          </div>

          {l.photo ? (
            <figure className="lv-figure">
              {l.photo === "placeholder" ? <div className="lv-photo-ph mono muted">[로그 사진 / 스크린샷]</div> : <img src={publicUrl(l.photo)} alt={l.caption || ""} />}
              {l.caption ? <figcaption className="mono muted">Fig. 1 — {l.caption}</figcaption> : null}
            </figure>
          ) : null}

          {l.locked ? (
            <LockedBody key={`${pair.id}/${l.id}`} lockId={`${pair.id}/${l.id}`} cipher={l.cipher ?? ""} subjects={subjects} />
          ) : raw === null ? null : (
            <Blocks md={stripFrontmatter(raw)} subjects={subjects} />
          )}

          <div aria-hidden="true" className="dots">
            ···
          </div>

          <div className="lv-foot">
            <span />
            <span className="lv-nav">
              {prev ? <Link to={to("log", prev.id)}>← No.{prev.no}</Link> : <span />}
              {next ? <Link to={to("log", next.id)}>No.{next.no} →</Link> : null}
            </span>
          </div>
        </article>
      ) : null}
    </div>
  );
}

/** 잠금 글 본문 — 비밀번호를 받아 복호화한다. key 로 글마다 새로 만들어지므로 상태가 섞이지 않는다 */
function LockedBody({ lockId, cipher, subjects }: { lockId: string; cipher: string; subjects: SubjectsFile["subjects"] }) {
  const [plain, setPlain] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "wrong">("idle");

  // 이 세션에서 이미 푼 적이 있으면 바로 연다
  useEffect(() => {
    const saved = recallPassword(lockId);
    if (!saved || !cipher) return;
    let alive = true;
    decryptText(cipher, saved).then((t) => alive && t !== null && setPlain(t));
    return () => {
      alive = false;
    };
  }, [lockId, cipher]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cipher || !pw) return;
    setState("busy");
    const t = await decryptText(cipher, pw);
    if (t === null) {
      setState("wrong");
      return;
    }
    rememberPassword(lockId, pw);
    setPlain(t);
    setState("idle");
  };

  if (plain !== null) return <Blocks md={plain} subjects={subjects} />;
  return (
    <form className="lv-lock" onSubmit={unlock} aria-label="잠긴 글">
      <span className="mono muted lv-lock-k">LOCKED</span>
      <p className="lv-lock-text muted">비밀번호가 있어야 읽을 수 있는 글이에요.</p>
      <div className="lv-lock-row">
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            if (state === "wrong") setState("idle");
          }}
          placeholder="비밀번호"
          className="field"
          autoComplete="off"
          aria-invalid={state === "wrong" || undefined}
        />
        <button type="submit" className="btn-solid" disabled={!pw || state === "busy"}>
          열기
        </button>
      </div>
      {state === "wrong" ? <span className="mono lv-lock-err">비밀번호가 맞지 않아요.</span> : null}
    </form>
  );
}
