import { useMemo, useState } from "react";
import { useTitle } from "../components/Head";
import { Header } from "../components/Header";
import { useJson } from "../lib/data";
import { dotDate, today } from "../lib/format";
import { useSite } from "../lib/site";
import type { Comment, GuestEntry, LinkRef, Neighbor } from "../lib/types";
import { publicUrl } from "../lib/url";

const PENDING_KEY = "guestbook-pending";

function readPending(): GuestEntry[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** § 07 Links — 이웃 배너 · Elsewhere · Our banner · 방명록(쓰기 가능) */
export function Links() {
  const { pair, site } = useSite();
  useTitle(`Links — ${pair.name}`);
  const neighbors = useJson<Neighbor[]>("neighbors.json", []);
  const refs = useJson<LinkRef[]>("links.json", []);
  const guestbook = useJson<GuestEntry[]>("guestbook.json", []);
  const comments = useJson<Comment[]>("comments.json", []);
  const [pending, setPending] = useState<GuestEntry[]>(readPending);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [hp, setHp] = useState(""); // 허니팟
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const aiOn = site.aiBoards.includes("guestbook");

  // 동기화로 서버에 반영된 글은 대기 목록에서 뺀다 (파생값)
  const entries = useMemo(() => {
    const ids = new Set(guestbook.map((g) => g.id));
    const left = pending.filter((p) => !ids.has(p.id));
    if (left.length !== pending.length) {
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(left));
      } catch {
        /* 저장 불가 */
      }
    }
    return [...left, ...guestbook].sort((a, b) => b.date.localeCompare(a.date));
  }, [pending, guestbook]);
  const replyOf = (id: string) => comments.filter((c) => c.target === "guestbook" && c.targetId === id).sort((a, b) => a.date.localeCompare(b.date));

  const sign = async () => {
    const t = msg.trim();
    if (!t || status === "sending") return;
    if (hp) return;
    const entry: GuestEntry = { id: `local-${Date.now()}`, who: name.trim() || "[익명]", date: today(), text: t, pending: true };
    if (!site.guestbookEndpoint) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch(site.guestbookEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: entry.who, text: entry.text, pair: pair.id, website: hp }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      if (data.id) entry.id = data.id;
      const nextPending = [entry, ...pending];
      setPending(nextPending);
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(nextPending));
      } catch {
        /* 저장 불가 */
      }
      setName("");
      setMsg("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const bannerCode = site.banner.code || `<a href="https://vance.zip"><img src="https://vance.zip/${site.banner.image.replace(/^\/+/, "")}"></a>`;

  return (
    <div className="page links">
      <Header />
      <div className="lk-wrap">
        <div className="lk-main">
          <h1 className="page-title">
            Links
            <sup aria-hidden="true" className="star">
              *
            </sup>
          </h1>

          <section className="lk-section">
            <h2 className="lk-h2">
              Neighbors
            </h2>
            <div className="lk-banners">
              {neighbors.map((n) => (
                <a key={n.url + n.name} href={n.url} target="_blank" rel="noreferrer" className="lk-banner mono" title={n.name}>
                  {n.image ? <img src={publicUrl(n.image)} alt={n.name} loading="lazy" /> : n.name}
                </a>
              ))}
            </div>
          </section>

          <section className="lk-section">
            <h2 className="lk-h2">Elsewhere</h2>
            {refs.map((r) => (
              <a key={r.url + r.name} href={r.url} target="_blank" rel="noreferrer" className="lk-ref">
                <span aria-hidden="true" className="lk-ref-dot" />
                <span className="lk-ref-name">{r.name}</span>
                <span className="muted">{r.desc}</span>
                <span className="lk-ref-arrow">↗</span>
              </a>
            ))}
          </section>

          <section className="lk-section">
            <h2 className="lk-h2">Our banner</h2>
            <div className="lk-our">
              {site.banner.image ? (
                <img src={publicUrl(site.banner.image)} alt={pair.name} width={200} height={60} className="lk-our-img" />
              ) : (
                <div className="lk-our-ph display wide">
                  {pair.name}
                  <span className="lk-our-dot" />
                </div>
              )}
              <label htmlFor="code" className="sr-only">
                배너 코드
              </label>
              <input id="code" readOnly value={bannerCode} className="field mono lk-code" onFocus={(e) => e.currentTarget.select()} />
            </div>
          </section>
        </div>

        <section aria-label="방명록" className="lk-gb">
          <span aria-hidden="true" className="vrule desktop-only" />
          <div className="lk-gb-body">
            <div className="lk-gb-head">
              <h2 className="display lk-gb-title">
                Guestbook<sup>[{String(entries.length).padStart(2, "0")}]</sup>
              </h2>
              <span className="muted">방명록을 남겨주세요.{aiOn ? " (p.s. 캐릭터가 답글을 달기도 해요.)" : ""}</span>
            </div>

            <form
              className="lk-form"
              onSubmit={(e) => {
                e.preventDefault();
                sign();
              }}
            >
              <label htmlFor="gb-name" className="mono muted">
                NAME
              </label>
              <input id="gb-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="닉네임" className="field" maxLength={40} />
              <label htmlFor="gb-msg" className="mono muted">
                NOTE
              </label>
              <textarea id="gb-msg" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="한 마디" className="field" maxLength={500} />
              <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} className="sr-only" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="lk-form-foot">
                <span className="mono muted lk-form-status">
                  {status === "sent" ? "남겼어요 — 반영까지 잠시 걸려요" : status === "error" ? (site.guestbookEndpoint ? "전송에 실패했어요" : "아직 쓰기 경로가 연결되지 않았어요") : status === "sending" ? "보내는 중…" : ""}
                </span>
                <button type="submit" className="btn-solid" disabled={status === "sending" || !msg.trim()}>
                  Sign ↵
                </button>
              </div>
            </form>

            <ol className="lk-entries">
              {entries.map((g) => (
                <li key={g.id} className="lk-entry">
                  <span className="lk-entry-head">
                    <b>{g.who}</b>
                    <span className="mono muted">
                      {dotDate(g.date)}
                      {g.pending ? " · 반영 대기" : ""}
                    </span>
                  </span>
                  <span className="lk-entry-text">{g.text}</span>
                  {replyOf(g.id).map((r) => (
                    <span key={r.id} className="lk-reply muted">
                      <span className={`mono ${r.source === "AI" ? "accent" : ""}`}>↳ {r.author}</span>  {r.content}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
