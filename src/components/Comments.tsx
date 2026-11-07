import type { Comment } from "../lib/types";

/**
 * AI 코멘트 — 논문 여백의 주석처럼. 최상위 코멘트 아래에 답글(↳)이 줄줄이 붙는다.
 * 작성자 뱃지: AI 는 강조색, 사람은 회색.
 */
export function CommentThreads({ comments }: { comments: Comment[] }) {
  const roots = comments.filter((c) => !c.replyTo).sort((a, b) => (a.anchor ?? 99) - (b.anchor ?? 99) || a.date.localeCompare(b.date));
  const replies = (id: string) => comments.filter((c) => c.replyTo === id).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      {roots.map((c, i) => (
        <div className="comment" key={c.id}>
          <span aria-hidden="true" className="comment-rule" />
          <div className="comment-body">
            <span className={`comment-by mono ${c.source === "AI" ? "ai" : ""}`}>
              {c.anchor ?? i + 1} — {c.author}
              {c.source === "AI" ? <span className="comment-badge">AI</span> : null}
            </span>
            <span>{c.content}</span>
            {replies(c.id).map((r) => (
              <span key={r.id} className="comment-reply">
                <span className={`comment-by mono ${r.source === "AI" ? "ai" : ""}`}>↳ {r.author}</span>
                <span className="muted">{r.content}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
